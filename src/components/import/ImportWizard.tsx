import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { UploadCloud, FileWarning, CheckCircle2, AlertTriangle, ArrowRight, Sparkles, HelpCircle, X as XIcon } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Select } from '../ui/FormField'
import { accountTypeLabel } from '../accounts/AccountCard'
import type { Account, Transaction, CostCenter, ClassificationRule } from '../../db/models'
import type { TransactionDirection, TransactionKind } from '../../data/types'
import {
  detectFileKind,
  supportedExtensionsLabel,
  parseOfx,
  parseDelimitedText,
  parseWorkbookFile,
  buildRowsFromMapping,
  type ParsedStatement,
  type ParsedStatementRow,
  type ImportFileKind,
  type PdfUnrecognizedCandidate,
} from '../../lib/importParsers'
import { parsePdf } from '../../lib/importPdf'
import { guessMapping, isMappingConfident, mappableFieldLabel, type MappableField } from '../../lib/importMapping'
import { inferTransactionKind } from '../../lib/importKind'
import { detectDuplicates } from '../../lib/importDedup'
import { findMatchingRule } from '../../lib/importRules'
import { findPartnerForNewRow } from '../../lib/transferDetection'
import { formatCurrency, formatDate, parseCurrencyInput, isValidCurrencyInput } from '../../lib/format'
import { transactionKindMeta } from '../../lib/transactionKind'

export interface ImportRowToInsert {
  date: string
  description: string
  originalDescription: string
  counterparty?: string
  document?: string
  sourceFile?: string
  amount: number
  direction: TransactionDirection
  kind: TransactionKind
  costCenterId?: string | null
  categoryId?: string | null
}

interface ImportWizardProps {
  open: boolean
  onClose: () => void
  accounts: Account[]
  costCenters: CostCenter[]
  transactions: Transaction[]
  classificationRules: ClassificationRule[]
  /** Cria as transações e devolve as criadas (mesma ordem de `rows`) — usado para, em seguida, vincular
   * como transferência as linhas confirmadas como tal na prévia. */
  onConfirmImport: (accountId: string, rows: ImportRowToInsert[]) => Promise<Transaction[]>
  /** Chamado (fire-and-forget) para cada regra que foi de fato aplicada numa importação confirmada. */
  onRuleUsed?: (ruleId: string) => void
  /** Vincula duas transações como transferência entre contas — chamado após a criação, para cada par
   * confirmado na prévia. */
  onLinkTransfer?: (idA: string, idB: string) => Promise<{ ok: boolean; reason?: string }>
  /** Aplica um "saldo anterior" encontrado num PDF como novo saldo de referência da conta — só
   * chamado quando a usuária confirma explicitamente na prévia (nunca automático). */
  onUseReferenceBalance?: (accountId: string, amount: number, asOfDate: string) => Promise<void>
  /** Abre o formulário de lançamento já preenchido a partir de uma possível movimentação de PDF que
   * não foi reconhecida automaticamente — a usuária revisa/edita e decide se salva. */
  onCreateFromCandidate?: (
    accountId: string,
    prefill: {
      date: string
      description: string
      originalDescription: string
      counterparty: string
      document: string
      direction: TransactionDirection | ''
      amount: string
    },
  ) => void
}

type Step = 'account' | 'file' | 'mapping' | 'preview'

interface FileParseResult {
  file: File
  statement: ParsedStatement
}

interface PreviewRow {
  row: ParsedStatementRow
  kind: TransactionKind
  isDuplicate: boolean
  duplicateReason?: string
  isValid: boolean
  costCenterId: string
  categoryId: string
  appliedRuleId?: string
  transferPartner?: Transaction
  transferConfirmed: boolean
  // Campos editáveis na prévia (a interpretação do PDF pode ser imperfeita) — inicializados a
  // partir do que foi reconhecido, mas nunca obrigam a usuária a importar um valor errado.
  editDate: string
  editDescription: string
  editCounterparty: string
  editAmountText: string
  editDirection: TransactionDirection | ''
}

const REQUIRED_FIELDS: MappableField[] = ['date', 'description', 'amount']
const OPTIONAL_FIELDS: MappableField[] = ['direction', 'document', 'balance']

function computeRowValid(date: string, amountText: string, direction: string): boolean {
  return Boolean(date) && isValidCurrencyInput(amountText) && (direction === 'entrada' || direction === 'saida')
}

export function ImportWizard({
  open,
  onClose,
  accounts,
  costCenters,
  transactions,
  classificationRules,
  onConfirmImport,
  onRuleUsed,
  onLinkTransfer,
  onUseReferenceBalance,
  onCreateFromCandidate,
}: ImportWizardProps) {
  const [step, setStep] = useState<Step>('account')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [fileError, setFileError] = useState('')
  const [failedFilesNotice, setFailedFilesNotice] = useState('')
  const [fileNames, setFileNames] = useState<string[]>([])
  const [parsing, setParsing] = useState(false)
  const [fileResults, setFileResults] = useState<FileParseResult[]>([])
  const [manualMapping, setManualMapping] = useState<Partial<Record<MappableField, number>>>({})
  const [mappingHeaders, setMappingHeaders] = useState<string[]>([])
  const [mappingSampleRows, setMappingSampleRows] = useState<string[][]>([])
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [included, setIncluded] = useState<Record<number, boolean>>({})
  const [confirming, setConfirming] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [referenceBalanceApplied, setReferenceBalanceApplied] = useState(false)
  const [applyingReferenceBalance, setApplyingReferenceBalance] = useState(false)
  const [dismissedCandidates, setDismissedCandidates] = useState<Record<string, boolean>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setStep('account')
    setAccountId(accounts[0]?.id ?? '')
    setFileError('')
    setFailedFilesNotice('')
    setFileNames([])
    setParsing(false)
    setFileResults([])
    setManualMapping({})
    setMappingHeaders([])
    setMappingSampleRows([])
    setPreviewRows([])
    setIncluded({})
    setConfirming(false)
    setDragOver(false)
    setReferenceBalanceApplied(false)
    setApplyingReferenceBalance(false)
    setDismissedCandidates({})
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const updateRow = (index: number, patch: Partial<PreviewRow>) => {
    setPreviewRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  const buildPreviewFromResults = (results: FileParseResult[]) => {
    const taggedRows: ParsedStatementRow[] = []
    results.forEach((r) => {
      r.statement.rows.forEach((row) => taggedRows.push({ ...row, sourceFile: r.file.name }))
    })

    const dedup = detectDuplicates(taggedRows, accountId, transactions)

    const preview: PreviewRow[] = taggedRows.map((row, i) => {
      const isValid = row.date !== null && row.amount !== null && row.direction !== null
      const { kind } = inferTransactionKind(row.friendlyDescription || row.description, row.direction)
      const rule = row.counterparty ? findMatchingRule(row.counterparty, classificationRules) : undefined
      const transferPartner =
        isValid && row.direction
          ? findPartnerForNewRow({ date: row.date as string, amount: row.amount as number, direction: row.direction, counterparty: row.counterparty }, accountId, transactions)
          : undefined

      return {
        row,
        kind,
        isDuplicate: dedup[i].isPossibleDuplicate,
        duplicateReason: dedup[i].reason,
        isValid,
        costCenterId: transferPartner ? '' : rule?.costCenterId ?? '',
        categoryId: transferPartner ? '' : rule?.categoryId ?? '',
        appliedRuleId: transferPartner ? undefined : rule?.id,
        transferPartner,
        transferConfirmed: false,
        editDate: row.date ?? '',
        editDescription: row.friendlyDescription || row.description,
        editCounterparty: row.counterparty ?? '',
        editAmountText: row.amount !== null ? row.amount.toFixed(2).replace('.', ',') : '',
        editDirection: row.direction ?? '',
      }
    })

    setPreviewRows(preview)
    const initialIncluded: Record<number, boolean> = {}
    preview.forEach((r, i) => {
      initialIncluded[i] = r.isValid && !r.isDuplicate
    })
    setIncluded(initialIncluded)
    setReferenceBalanceApplied(false)
    setStep('preview')
  }

  const parseOneFile = async (file: File, kind: ImportFileKind): Promise<ParsedStatement> => {
    if (kind === 'ofx' || kind === 'ofc') return parseOfx(await file.text(), kind)
    if (kind === 'xls' || kind === 'xlsx') return parseWorkbookFile(file, kind)
    if (kind === 'pdf') return parsePdf(file)
    return parseDelimitedText(await file.text(), kind)
  }

  const handleFiles = async (files: File[]) => {
    setFileError('')
    setFailedFilesNotice('')
    const withKinds = files.map((file) => ({ file, kind: detectFileKind(file.name) }))
    const unsupported = withKinds.filter((f) => !f.kind)
    if (unsupported.length > 0) {
      setFileError(
        `Formato não suportado para: ${unsupported.map((u) => u.file.name).join(', ')}. Envie apenas arquivos nos formatos aceitos: ${supportedExtensionsLabel()}.`,
      )
      return
    }

    setFileNames(files.map((f) => f.name))
    setParsing(true)
    try {
      const results: FileParseResult[] = []
      for (const { file, kind } of withKinds) {
        const statement = await parseOneFile(file, kind as ImportFileKind)
        results.push({ file, statement })
      }

      // Quando um dos arquivos falha, não descarta silenciosamente os demais: continua com os que
      // deram certo e deixa claro, na prévia, qual arquivo teve problema (nunca inventa dados).
      const succeeded = results.filter((r) => !r.statement.error)
      const withErrors = results.filter((r) => r.statement.error)
      if (withErrors.length > 0) {
        const notice = withErrors.map((r) => `${r.file.name}: ${r.statement.error}`).join(' ')
        if (succeeded.length === 0) {
          setFileError(notice)
          return
        }
        setFailedFilesNotice(notice)
      }

      setFileResults(succeeded)

      const needsMapping = succeeded.filter((r) => !r.statement.autoIdentified && r.statement.kind !== 'pdf')
      if (needsMapping.length > 0) {
        const first = needsMapping[0]
        setManualMapping(guessMapping(first.statement.headers || []))
        setMappingHeaders(first.statement.headers || [])
        setMappingSampleRows(first.statement.rawRows || [])
        setStep('mapping')
      } else {
        buildPreviewFromResults(succeeded)
      }
    } catch (err) {
      console.error('[import] falha ao processar arquivo(s)', err)
      setFileError('Não foi possível ler um dos arquivos selecionados. Verifique se o formato está correto.')
    } finally {
      setParsing(false)
    }
  }

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 0) handleFiles(files)
    e.target.value = ''
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files ?? [])
    if (files.length > 0) handleFiles(files)
  }

  const confirmMapping = () => {
    const updatedResults = fileResults.map((r) => {
      if (r.statement.autoIdentified) return r
      const headers = r.statement.headers?.length ? r.statement.headers : mappingHeaders
      const rawRows = r.statement.rawRows || []
      const rows = buildRowsFromMapping(rawRows, headers, manualMapping)
      return { ...r, statement: { ...r.statement, rows, autoIdentified: true } }
    })
    buildPreviewFromResults(updatedResults)
  }

  const fileBreakdown = useMemo(() => {
    return fileResults.map((r) => ({ name: r.file.name, count: r.statement.rows.length }))
  }, [fileResults])

  interface CandidateEntry {
    key: string
    sourceFile: string
    candidate: PdfUnrecognizedCandidate
  }

  const unrecognizedCandidates: CandidateEntry[] = useMemo(() => {
    const entries: CandidateEntry[] = []
    fileResults.forEach((r) => {
      ;(r.statement.unrecognizedCandidates ?? []).forEach((candidate, idx) => {
        entries.push({ key: `${r.file.name}::${idx}`, sourceFile: r.file.name, candidate })
      })
    })
    return entries
  }, [fileResults])

  const visibleCandidates = unrecognizedCandidates.filter((c) => !dismissedCandidates[c.key])

  const pdfPreviousBalanceInfo = useMemo(() => {
    const withBalance = fileResults.find((r) => r.statement.pdfPreviousBalance)
    if (!withBalance || !withBalance.statement.pdfPreviousBalance) return undefined
    return { fileName: withBalance.file.name, ...withBalance.statement.pdfPreviousBalance }
  }, [fileResults])

  const handleApplyReferenceBalance = async () => {
    if (!pdfPreviousBalanceInfo || !pdfPreviousBalanceInfo.asOfDate || !onUseReferenceBalance) return
    setApplyingReferenceBalance(true)
    try {
      await onUseReferenceBalance(accountId, pdfPreviousBalanceInfo.amount, pdfPreviousBalanceInfo.asOfDate)
      setReferenceBalanceApplied(true)
    } finally {
      setApplyingReferenceBalance(false)
    }
  }

  const dismissCandidate = (key: string) => {
    setDismissedCandidates((prev) => ({ ...prev, [key]: true }))
  }

  const handleCreateFromCandidateClick = (entry: CandidateEntry) => {
    const { candidate } = entry
    onCreateFromCandidate?.(accountId, {
      date: candidate.probableDate ?? '',
      description: candidate.typeLabel ?? '',
      originalDescription: candidate.contextLines.join(' / '),
      counterparty: candidate.probableCounterparty ?? '',
      document: candidate.probableDocument ?? '',
      direction: candidate.probableDirection ?? '',
      amount: candidate.probableAmount !== null ? candidate.probableAmount.toFixed(2).replace('.', ',') : '',
    })
    dismissCandidate(entry.key)
  }

  const summary = useMemo(() => {
    const total = previewRows.length
    const entradas = previewRows.filter((r) => r.row.direction === 'entrada').length
    const saidas = previewRows.filter((r) => r.row.direction === 'saida').length
    const duplicates = previewRows.filter((r) => r.isDuplicate).length
    const invalid = previewRows.filter((r) => !r.isValid).length
    const withTransferSuggestion = previewRows.filter((r) => r.transferPartner).length
    const selected = Object.values(included).filter(Boolean).length
    return { total, entradas, saidas, duplicates, invalid, withTransferSuggestion, selected }
  }, [previewRows, included])

  const handleConfirm = async () => {
    const selectedRows = previewRows.map((r, i) => ({ r, i })).filter(({ i }) => included[i]).filter(({ r }) => r.isValid)
    if (selectedRows.length === 0) return

    const rowsToInsert: ImportRowToInsert[] = selectedRows.map(({ r }) => ({
      date: r.editDate,
      description: r.editDescription || r.row.description,
      originalDescription: r.row.description,
      counterparty: r.editCounterparty || undefined,
      document: r.row.document,
      sourceFile: r.row.sourceFile,
      amount: Math.abs(parseCurrencyInput(r.editAmountText)),
      direction: r.editDirection as TransactionDirection,
      kind: r.kind,
      costCenterId: r.transferConfirmed ? null : r.costCenterId || null,
      categoryId: r.transferConfirmed ? null : r.categoryId || null,
    }))

    setConfirming(true)
    try {
      selectedRows.forEach(({ r }) => {
        if (r.appliedRuleId && !r.transferConfirmed) onRuleUsed?.(r.appliedRuleId)
      })
      const created = await onConfirmImport(accountId, rowsToInsert)

      // Vincula como transferência cada linha confirmada na prévia — feito depois da criação, pois
      // só agora as novas transações têm id.
      if (onLinkTransfer) {
        for (let idx = 0; idx < selectedRows.length; idx++) {
          const { r } = selectedRows[idx]
          const createdTx = created[idx]
          if (r.transferConfirmed && r.transferPartner && createdTx) {
            await onLinkTransfer(createdTx.id, r.transferPartner.id)
          }
        }
      }

      handleClose()
    } finally {
      setConfirming(false)
    }
  }

  const noAccounts = accounts.length === 0
  const selectedAccountCostCenter = (costCenterId: string) => costCenters.find((c) => c.id === costCenterId)

  const selectableCount = previewRows.filter((r) => r.isValid).length
  const allSelected = selectableCount > 0 && summary.selected === selectableCount
  const toggleSelectAll = (checked: boolean) => {
    setIncluded((prev) => {
      const next = { ...prev }
      previewRows.forEach((r, i) => {
        if (r.isValid) next[i] = checked
      })
      return next
    })
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Importar extrato"
      subtitle={
        step === 'account'
          ? 'Passo 1 de 3 · Selecione a conta bancária'
          : step === 'file'
            ? 'Passo 2 de 3 · Envie um ou mais arquivos do extrato'
            : step === 'mapping'
              ? 'Não identificamos as colunas automaticamente — confirme o mapeamento'
              : 'Passo 3 de 3 · Revise antes de confirmar'
      }
      width={step === 'preview' ? 'xl' : 'lg'}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Cancelar
          </Button>
          {step === 'account' && (
            <Button size="sm" onClick={() => setStep('file')} disabled={!accountId || noAccounts}>
              Continuar
            </Button>
          )}
          {step === 'mapping' && (
            <Button size="sm" onClick={confirmMapping} disabled={!isMappingConfident(manualMapping)}>
              Confirmar mapeamento
            </Button>
          )}
          {step === 'preview' && (
            <Button size="sm" onClick={handleConfirm} disabled={confirming || summary.selected === 0}>
              {confirming ? 'Importando…' : `Confirmar importação (${summary.selected})`}
            </Button>
          )}
        </>
      }
    >
      {noAccounts ? (
        <p className="py-6 text-center text-[13.5px] text-neutral-500">
          Cadastre uma conta bancária antes de importar um extrato.
        </p>
      ) : (
        <>
          {step === 'account' && (
            <div className="space-y-4">
              <Field label="Conta bancária" required>
                <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.nickname || acc.bank} · {accountTypeLabel[acc.type]}
                    </option>
                  ))}
                </Select>
              </Field>
              <p className="text-[12.5px] text-neutral-500">
                Todos os arquivos selecionados a seguir serão importados para esta conta. O saldo de referência dela
                não é alterado automaticamente pela importação.
              </p>
            </div>
          )}

          {step === 'file' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={[
                  'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
                  dragOver ? 'border-rose-400 bg-rose-50/60' : 'border-[var(--border-hairline)] bg-[var(--color-neutral-100)]',
                ].join(' ')}
              >
                <UploadCloud size={28} className="text-rose-500" />
                <p className="text-[13.5px] font-medium text-neutral-700">Arraste um ou vários arquivos aqui, ou clique para selecionar</p>
                <p className="text-[12px] text-neutral-400">Formatos aceitos: {supportedExtensionsLabel()}</p>
                <p className="text-[11.5px] text-neutral-400">
                  PDF: nunca importamos direto — extraímos o texto, mostramos uma prévia e só importamos após confirmação.
                </p>
                <Button variant="secondary" size="sm" className="mt-2" onClick={() => fileInputRef.current?.click()}>
                  Escolher arquivo(s)
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".ofx,.ofc,.csv,.xls,.xlsx,.txt,.pdf"
                  className="hidden"
                  onChange={onFileInputChange}
                />
              </div>

              {parsing && (
                <p className="text-center text-[13px] text-neutral-500">
                  Lendo {fileNames.length > 1 ? `${fileNames.length} arquivos…` : fileNames[0]}
                </p>
              )}

              {failedFilesNotice && (
                <div className="flex items-start gap-2.5 rounded-xl bg-[var(--color-status-warning-bg)] px-3.5 py-3 text-[13px]" style={{ color: 'var(--color-status-warning)' }}>
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <p>{failedFilesNotice} Os demais arquivos foram processados normalmente e seguem na prévia abaixo.</p>
                </div>
              )}

              {fileError && (
                <div className="flex items-start gap-2.5 rounded-xl bg-[var(--color-status-critical-bg)] px-3.5 py-3 text-[13px]" style={{ color: 'var(--color-status-critical)' }}>
                  <FileWarning size={16} className="mt-0.5 shrink-0" />
                  <p>{fileError}</p>
                </div>
              )}
            </div>
          )}

          {step === 'mapping' && mappingHeaders.length > 0 && (
            <div className="space-y-4">
              <p className="text-[13px] text-neutral-500">
                Não conseguimos identificar todas as colunas automaticamente
                {fileResults.filter((r) => !r.statement.autoIdentified).length > 1
                  ? ' nestes arquivos. O mapeamento abaixo será aplicado a todos eles'
                  : ' neste arquivo'}
                . Indique qual coluna corresponde a cada campo do sistema.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((field) => (
                  <Field key={field} label={mappableFieldLabel[field]} required={REQUIRED_FIELDS.includes(field)}>
                    <Select
                      value={manualMapping[field] ?? ''}
                      onChange={(e) =>
                        setManualMapping((m) => ({
                          ...m,
                          [field]: e.target.value === '' ? undefined : Number(e.target.value),
                        }))
                      }
                    >
                      <option value="">{REQUIRED_FIELDS.includes(field) ? 'Selecione a coluna…' : 'Não mapear'}</option>
                      {mappingHeaders.map((h, idx) => (
                        <option key={idx} value={idx}>
                          {h}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ))}
              </div>
              {mappingSampleRows.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-[var(--border-hairline)]">
                  <table className="w-full min-w-[600px] border-collapse text-left text-[12.5px]">
                    <thead>
                      <tr className="bg-[var(--color-neutral-100)] text-neutral-500">
                        {mappingHeaders.map((h, i) => (
                          <th key={i} className="whitespace-nowrap px-3 py-2 font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mappingSampleRows.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-t border-[var(--border-hairline)]">
                          {row.map((cell, j) => (
                            <td key={j} className="whitespace-nowrap px-3 py-2 text-neutral-600">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="flex h-full min-h-0 flex-col gap-3">
              <div className="shrink-0 space-y-3">
                <p className="text-[12.5px] text-neutral-500">
                  Conta selecionada: <span className="font-medium text-neutral-700">{accounts.find((a) => a.id === accountId)?.nickname || accounts.find((a) => a.id === accountId)?.bank}</span>
                </p>

                {failedFilesNotice && (
                  <div className="flex items-start gap-2.5 rounded-xl bg-[var(--color-status-warning-bg)] px-3.5 py-3 text-[13px]" style={{ color: 'var(--color-status-warning)' }}>
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <p>{failedFilesNotice} Os demais arquivos foram processados normalmente e seguem abaixo.</p>
                  </div>
                )}

                {fileBreakdown.length > 1 && (
                  <div className="rounded-xl border border-[var(--border-hairline)] px-3.5 py-3 text-[12.5px] text-neutral-600">
                    <p className="mb-1.5 font-medium text-neutral-700">{fileBreakdown.length} arquivos selecionados</p>
                    <ul className="space-y-0.5">
                      {fileBreakdown.map((f) => (
                        <li key={f.name} className="flex items-center justify-between">
                          <span className="truncate">{f.name}</span>
                          <span className="shrink-0 tabular-nums text-neutral-400">{f.count} movimentações</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {pdfPreviousBalanceInfo && (
                  <div className="flex items-start gap-2.5 rounded-xl bg-[var(--color-neutral-100)] px-3.5 py-3 text-[12.5px] text-neutral-600">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0 text-neutral-400" />
                    <div className="flex-1 space-y-1.5">
                      <p>
                        Saldo anterior encontrado no PDF ({pdfPreviousBalanceInfo.fileName}
                        {pdfPreviousBalanceInfo.asOfDate ? `, referência ${formatDate(pdfPreviousBalanceInfo.asOfDate)}` : ''}):{' '}
                        <span className="font-medium text-neutral-700">{formatCurrency(pdfPreviousBalanceInfo.amount)}</span>. Não alteramos o saldo de
                        referência da conta automaticamente.
                      </p>
                      {referenceBalanceApplied ? (
                        <p className="flex items-center gap-1 font-medium" style={{ color: 'var(--color-status-good)' }}>
                          <CheckCircle2 size={13} /> Aplicado como saldo de referência da conta
                        </p>
                      ) : pdfPreviousBalanceInfo.asOfDate && onUseReferenceBalance ? (
                        <button
                          type="button"
                          onClick={handleApplyReferenceBalance}
                          disabled={applyingReferenceBalance}
                          className="rounded-md bg-rose-700 px-2.5 py-1 text-[11.5px] font-medium text-white hover:bg-rose-800 disabled:opacity-60"
                        >
                          {applyingReferenceBalance ? 'Aplicando…' : 'Usar como saldo de referência'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}

                {visibleCandidates.length > 0 && (
                  <div className="space-y-2 rounded-xl bg-[var(--color-status-warning-bg)] px-3.5 py-3 text-[12.5px]" style={{ color: 'var(--color-status-warning)' }}>
                    <p className="flex items-center gap-1.5 font-medium">
                      <HelpCircle size={14} /> {visibleCandidates.length} movimentaç{visibleCandidates.length === 1 ? 'ão precisa' : 'ões precisam'} de revisão (não {visibleCandidates.length === 1 ? 'virou' : 'viraram'} lançamento)
                    </p>
                    <div className="max-h-52 space-y-2 overflow-auto">
                      {visibleCandidates.map((entry) => {
                        const c = entry.candidate
                        return (
                          <div key={entry.key} className="rounded-lg border border-[var(--border-hairline)] bg-white px-3 py-2.5 text-neutral-700">
                            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Possível movimentação não reconhecida</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] sm:grid-cols-3">
                              <p><span className="text-neutral-400">Tipo: </span>{c.typeLabel ?? 'Não identificado'}</p>
                              <p><span className="text-neutral-400">Data provável: </span>{c.probableDate ? formatDate(c.probableDate) : 'Não identificado'}</p>
                              <p><span className="text-neutral-400">Valor provável: </span>{c.probableAmount !== null ? formatCurrency(c.probableAmount) : 'Não identificado'}</p>
                              <p><span className="text-neutral-400">Entrada/Saída: </span>{c.probableDirection === 'entrada' ? 'Entrada' : c.probableDirection === 'saida' ? 'Saída' : 'Não identificado'}</p>
                              <p><span className="text-neutral-400">Contraparte provável: </span>{c.probableCounterparty ?? 'Não identificado'}</p>
                              <p><span className="text-neutral-400">Documento: </span>{c.probableDocument ?? 'Não identificado'}</p>
                              <p className="col-span-2 sm:col-span-3"><span className="text-neutral-400">Arquivo de origem: </span>{entry.sourceFile}</p>
                            </div>
                            <p className="mt-1.5 text-[11px] text-neutral-400">Contexto original: {c.contextLines.join(' / ')}</p>
                            <div className="mt-2 flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleCreateFromCandidateClick(entry)}
                                className="rounded-md bg-rose-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-rose-800"
                              >
                                Criar lançamento
                              </button>
                              <button
                                type="button"
                                onClick={() => dismissCandidate(entry.key)}
                                className="flex items-center gap-1 rounded-md bg-[var(--color-neutral-100)] px-2.5 py-1 text-[11px] font-medium text-neutral-600 hover:bg-neutral-200"
                              >
                                <XIcon size={11} /> Ignorar
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {fileResults.some((r) => r.statement.statementBalance) && (
                  <div className="flex items-start gap-2.5 rounded-xl bg-[var(--color-neutral-100)] px-3.5 py-3 text-[12.5px] text-neutral-600">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0 text-neutral-400" />
                    <p>
                      {fileResults
                        .filter((r) => r.statement.statementBalance)
                        .map(
                          (r) =>
                            `${r.file.name}: saldo informado no extrato ${
                              r.statement.statementBalance!.asOfDate ? `(referência ${formatDate(r.statement.statementBalance!.asOfDate)})` : ''
                            } ${formatCurrency(r.statement.statementBalance!.amount)}`,
                        )
                        .join(' · ')}
                      . Apenas informativo — o saldo de referência da conta não é alterado automaticamente pela importação.
                    </p>
                  </div>
                )}

                <div className="rounded-xl bg-rose-50/60 px-3.5 py-3 text-[13px] text-rose-800">
                  {summary.total} {summary.total === 1 ? 'movimentação encontrada' : 'movimentações encontradas'} ·{' '}
                  {summary.selected} selecionada{summary.selected === 1 ? '' : 's'} para importar ·{' '}
                  {summary.entradas} entrada{summary.entradas === 1 ? '' : 's'} · {summary.saidas} saída{summary.saidas === 1 ? '' : 's'}
                  {summary.duplicates > 0 && ` · ${summary.duplicates} possível${summary.duplicates === 1 ? '' : 'is'} duplicidade${summary.duplicates === 1 ? '' : 's'}`}
                  {summary.withTransferSuggestion > 0 && ` · ${summary.withTransferSuggestion} possível${summary.withTransferSuggestion === 1 ? '' : 'is'} transferência${summary.withTransferSuggestion === 1 ? '' : 's'} entre contas`}
                  {summary.invalid > 0 && ` · ${summary.invalid} com dados incompletos (não serão importados)`}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-[var(--border-hairline)]">
                <table className="w-full min-w-[1500px] border-collapse text-left text-[12.5px]">
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr className="border-b border-[var(--border-hairline)] text-neutral-500">
                      <th className="px-3 py-2 font-medium">
                        <input
                          type="checkbox"
                          aria-label="Selecionar todos"
                          checked={allSelected}
                          disabled={selectableCount === 0}
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                        />
                      </th>
                      <th className="px-3 py-2 font-medium">Data</th>
                      <th className="w-[260px] px-3 py-2 font-medium">Descrição</th>
                      <th className="w-[260px] px-3 py-2 font-medium">Contraparte</th>
                      <th className="px-3 py-2 font-medium">Valor</th>
                      <th className="px-3 py-2 font-medium">E/S</th>
                      <th className="px-3 py-2 font-medium">Centro de custo</th>
                      <th className="px-3 py-2 font-medium">Categoria</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Saldo</th>
                      <th className="px-3 py-2 font-medium">Tipo</th>
                      <th className="px-3 py-2 font-medium">Arquivo de origem</th>
                      <th className="px-3 py-2 font-medium">Transferência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, i) => {
                      const selectedCc = selectedAccountCostCenter(r.costCenterId)
                      return (
                        <tr key={i} className="border-b border-[var(--border-hairline)] last:border-0 align-top">
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={Boolean(included[i])}
                              disabled={!r.isValid}
                              onChange={(e) => setIncluded((prev) => ({ ...prev, [i]: e.target.checked }))}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="date"
                              value={r.editDate}
                              onChange={(e) => updateRow(i, { editDate: e.target.value, isValid: computeRowValid(e.target.value, r.editAmountText, r.editDirection) })}
                              className="w-[128px] rounded-md border border-[var(--border-hairline)] px-1.5 py-1 text-[11.5px]"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={r.editDescription}
                              title={r.row.description}
                              onChange={(e) => updateRow(i, { editDescription: e.target.value })}
                              className="w-full min-w-[220px] rounded-md border border-[var(--border-hairline)] px-1.5 py-1 text-[11.5px]"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={r.editCounterparty}
                              placeholder="—"
                              title={r.editCounterparty}
                              onChange={(e) => updateRow(i, { editCounterparty: e.target.value })}
                              className="w-full min-w-[220px] rounded-md border border-[var(--border-hairline)] px-1.5 py-1 text-[11.5px]"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={r.editAmountText}
                              onChange={(e) => updateRow(i, { editAmountText: e.target.value, isValid: computeRowValid(r.editDate, e.target.value, r.editDirection) })}
                              className="w-[92px] rounded-md border border-[var(--border-hairline)] px-1.5 py-1 text-right text-[11.5px] tabular-nums"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Select
                              value={r.editDirection}
                              onChange={(e) => updateRow(i, { editDirection: e.target.value as TransactionDirection | '', isValid: computeRowValid(r.editDate, r.editAmountText, e.target.value) })}
                              className="!w-[104px] !py-1 !text-[11.5px]"
                            >
                              <option value="">Selecione…</option>
                              <option value="entrada">Entrada</option>
                              <option value="saida">Saída</option>
                            </Select>
                          </td>
                          <td className="min-w-[170px] px-3 py-2">
                            {r.transferConfirmed ? (
                              <span className="text-[11px] text-neutral-400">—</span>
                            ) : (
                              <Select
                                value={r.costCenterId}
                                onChange={(e) => updateRow(i, { costCenterId: e.target.value, categoryId: '' })}
                                className="!py-1 !text-[11.5px]"
                              >
                                <option value="">Sem centro de custo</option>
                                {costCenters.map((cc) => (
                                  <option key={cc.id} value={cc.id}>
                                    {cc.emoji} {cc.name}
                                  </option>
                                ))}
                              </Select>
                            )}
                          </td>
                          <td className="min-w-[170px] px-3 py-2">
                            {r.transferConfirmed ? (
                              <span className="text-[11px] text-neutral-400">—</span>
                            ) : (
                              <div className="space-y-1">
                                <Select
                                  value={r.categoryId}
                                  onChange={(e) => updateRow(i, { categoryId: e.target.value })}
                                  disabled={!selectedCc}
                                  className="!py-1 !text-[11.5px]"
                                >
                                  <option value="">Sem categoria</option>
                                  {selectedCc?.categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                      {cat.name}
                                    </option>
                                  ))}
                                </Select>
                                {r.appliedRuleId && (
                                  <p className="flex items-center gap-1 text-[10.5px] font-medium" style={{ color: 'var(--color-status-good)' }}>
                                    <Sparkles size={10} /> Baseado em classificação anterior
                                  </p>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">
                            {!r.isValid ? (
                              <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-neutral-400">
                                <FileWarning size={12} /> Dados incompletos
                              </span>
                            ) : r.isDuplicate ? (
                              <span
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                                style={{ color: 'var(--color-status-warning)', background: 'var(--color-status-warning-bg)' }}
                                title={r.duplicateReason}
                              >
                                <AlertTriangle size={11} /> Possível duplicidade
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                                style={{ color: 'var(--color-status-good)', background: 'var(--color-status-good-bg)' }}
                              >
                                <CheckCircle2 size={11} /> Pronto
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 tabular-nums text-neutral-500">
                            {r.row.balance !== undefined ? formatCurrency(r.row.balance) : '—'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-neutral-600">{transactionKindMeta[r.kind]?.label ?? r.kind}</td>
                          <td className="max-w-[140px] truncate px-3 py-2 text-neutral-500" title={r.row.sourceFile}>
                            {r.row.sourceFile || '—'}
                          </td>
                          <td className="min-w-[150px] px-3 py-2">
                            {r.transferPartner && !r.transferConfirmed ? (
                              <div className="space-y-1">
                                <p className="flex items-center gap-1 text-[11.5px] font-medium" style={{ color: 'var(--color-status-warning)' }}>
                                  <ArrowRight size={11} /> Possível transferência
                                </p>
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => updateRow(i, { transferConfirmed: true, costCenterId: '', categoryId: '' })}
                                    className="rounded-md bg-rose-700 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-rose-800"
                                  >
                                    Confirmar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateRow(i, { transferPartner: undefined })}
                                    className="rounded-md bg-[var(--color-neutral-100)] px-2 py-0.5 text-[11px] font-medium text-neutral-600 hover:bg-neutral-200"
                                  >
                                    Ignorar
                                  </button>
                                </div>
                              </div>
                            ) : r.transferConfirmed ? (
                              <span className="text-[11.5px] font-medium text-neutral-500">Transferência confirmada</span>
                            ) : (
                              <span className="text-[11px] text-neutral-400">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
