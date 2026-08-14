import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { UploadCloud, FileWarning, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, Select } from '../ui/FormField'
import { accountTypeLabel } from '../accounts/AccountCard'
import type { Account, Transaction } from '../../db/models'
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
} from '../../lib/importParsers'
import { guessMapping, isMappingConfident, mappableFieldLabel, type MappableField } from '../../lib/importMapping'
import { inferTransactionKind } from '../../lib/importKind'
import { detectDuplicates } from '../../lib/importDedup'
import { formatCurrency, formatDate } from '../../lib/format'
import { transactionKindMeta } from '../../lib/transactionKind'

export interface ImportRowToInsert {
  date: string
  description: string
  originalDescription: string
  document?: string
  amount: number
  direction: TransactionDirection
  kind: TransactionKind
}

interface ImportWizardProps {
  open: boolean
  onClose: () => void
  accounts: Account[]
  transactions: Transaction[]
  onConfirmImport: (accountId: string, rows: ImportRowToInsert[]) => Promise<void>
}

type Step = 'account' | 'file' | 'mapping' | 'preview'

interface PreviewRow {
  row: ParsedStatementRow
  kind: TransactionKind
  isDuplicate: boolean
  duplicateReason?: string
  isValid: boolean
}

const REQUIRED_FIELDS: MappableField[] = ['date', 'description', 'amount']
const OPTIONAL_FIELDS: MappableField[] = ['direction', 'document', 'balance']

function buildPreviewRows(rows: ParsedStatementRow[], accountId: string, existingTransactions: Transaction[]): PreviewRow[] {
  const dedup = detectDuplicates(rows, accountId, existingTransactions)
  return rows.map((row, i) => {
    const isValid = row.date !== null && row.amount !== null && row.direction !== null
    const { kind } = inferTransactionKind(row.description, row.direction)
    return {
      row,
      kind,
      isDuplicate: dedup[i].isPossibleDuplicate,
      duplicateReason: dedup[i].reason,
      isValid,
    }
  })
}

export function ImportWizard({ open, onClose, accounts, transactions, onConfirmImport }: ImportWizardProps) {
  const [step, setStep] = useState<Step>('account')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [fileError, setFileError] = useState('')
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parsed, setParsed] = useState<ParsedStatement | null>(null)
  const [manualMapping, setManualMapping] = useState<Partial<Record<MappableField, number>>>({})
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([])
  const [included, setIncluded] = useState<Record<number, boolean>>({})
  const [confirming, setConfirming] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setStep('account')
    setAccountId(accounts[0]?.id ?? '')
    setFileError('')
    setFileName('')
    setParsing(false)
    setParsed(null)
    setManualMapping({})
    setPreviewRows([])
    setIncluded({})
    setConfirming(false)
    setDragOver(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const goToPreviewFromParsed = (statement: ParsedStatement) => {
    const rows = buildPreviewRows(statement.rows, accountId, transactions)
    setPreviewRows(rows)
    const initialIncluded: Record<number, boolean> = {}
    rows.forEach((r, i) => {
      initialIncluded[i] = r.isValid && !r.isDuplicate
    })
    setIncluded(initialIncluded)
    setStep('preview')
  }

  const handleFile = async (file: File) => {
    setFileError('')
    const kind = detectFileKind(file.name)
    if (!kind) {
      setFileError(`Formato não suportado. Envie um arquivo nos formatos aceitos: ${supportedExtensionsLabel()}.`)
      return
    }
    setFileName(file.name)
    setParsing(true)
    try {
      let statement: ParsedStatement
      if (kind === 'ofx' || kind === 'ofc') {
        const text = await file.text()
        statement = parseOfx(text, kind)
      } else if (kind === 'xls' || kind === 'xlsx') {
        statement = await parseWorkbookFile(file, kind)
      } else {
        const text = await file.text()
        statement = parseDelimitedText(text, kind)
      }

      setParsed(statement)

      if (statement.error) {
        setFileError(statement.error)
        return
      }

      if (statement.autoIdentified) {
        goToPreviewFromParsed(statement)
      } else if (statement.headers && statement.rawRows) {
        setManualMapping(guessMapping(statement.headers))
        setStep('mapping')
      } else {
        setFileError('Não foi possível identificar os dados deste arquivo.')
      }
    } catch (err) {
      console.error('[import] falha ao processar arquivo', err)
      setFileError('Não foi possível ler este arquivo. Verifique se o formato está correto.')
    } finally {
      setParsing(false)
    }
  }

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const confirmMapping = () => {
    if (!parsed || !parsed.headers || !parsed.rawRows) return
    const rows = buildRowsFromMapping(parsed.rawRows, parsed.headers, manualMapping)
    goToPreviewFromParsed({ ...parsed, rows, autoIdentified: true })
  }

  const summary = useMemo(() => {
    const total = previewRows.length
    const entradas = previewRows.filter((r) => r.row.direction === 'entrada').length
    const saidas = previewRows.filter((r) => r.row.direction === 'saida').length
    const duplicates = previewRows.filter((r) => r.isDuplicate).length
    const invalid = previewRows.filter((r) => !r.isValid).length
    const selected = Object.values(included).filter(Boolean).length
    return { total, entradas, saidas, duplicates, invalid, selected }
  }, [previewRows, included])

  const handleConfirm = async () => {
    const rowsToInsert: ImportRowToInsert[] = previewRows
      .map((r, i) => ({ r, i }))
      .filter(({ i }) => included[i])
      .filter(({ r }) => r.isValid)
      .map(({ r }) => ({
        date: r.row.date as string,
        description: r.row.description,
        originalDescription: r.row.description,
        document: r.row.document,
        amount: r.row.amount as number,
        direction: r.row.direction as TransactionDirection,
        kind: r.kind,
      }))
    if (rowsToInsert.length === 0) return
    setConfirming(true)
    try {
      await onConfirmImport(accountId, rowsToInsert)
      handleClose()
    } finally {
      setConfirming(false)
    }
  }

  const noAccounts = accounts.length === 0

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Importar extrato"
      subtitle={
        step === 'account'
          ? 'Passo 1 de 3 · Selecione a conta bancária'
          : step === 'file'
            ? 'Passo 2 de 3 · Envie o arquivo do extrato'
            : step === 'mapping'
              ? 'Não identificamos as colunas automaticamente — confirme o mapeamento'
              : 'Passo 3 de 3 · Revise antes de confirmar'
      }
      width="lg"
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
                Os lançamentos importados serão associados a esta conta. O saldo de referência da conta não é alterado
                automaticamente pela importação.
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
                  'flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors',
                  dragOver ? 'border-rose-400 bg-rose-50/60' : 'border-[var(--border-hairline)] bg-[var(--color-neutral-100)]',
                ].join(' ')}
              >
                <UploadCloud size={28} className="text-rose-500" />
                <p className="text-[13.5px] font-medium text-neutral-700">Arraste o arquivo aqui ou clique para selecionar</p>
                <p className="text-[12px] text-neutral-400">Formatos aceitos: {supportedExtensionsLabel()}</p>
                <Button variant="secondary" size="sm" className="mt-2" onClick={() => fileInputRef.current?.click()}>
                  Escolher arquivo
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ofx,.ofc,.csv,.xls,.xlsx,.txt"
                  className="hidden"
                  onChange={onFileInputChange}
                />
              </div>

              {parsing && <p className="text-center text-[13px] text-neutral-500">Lendo {fileName}…</p>}

              {fileError && (
                <div className="flex items-start gap-2.5 rounded-xl bg-[var(--color-status-critical-bg)] px-3.5 py-3 text-[13px]" style={{ color: 'var(--color-status-critical)' }}>
                  <FileWarning size={16} className="mt-0.5 shrink-0" />
                  <p>{fileError}</p>
                </div>
              )}
            </div>
          )}

          {step === 'mapping' && parsed?.headers && (
            <div className="space-y-4">
              <p className="text-[13px] text-neutral-500">
                Não conseguimos identificar todas as colunas automaticamente neste arquivo. Indique qual coluna corresponde
                a cada campo do sistema.
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
                      {parsed.headers!.map((h, idx) => (
                        <option key={idx} value={idx}>
                          {h}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ))}
              </div>
              {parsed.rawRows && parsed.rawRows.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-[var(--border-hairline)]">
                  <table className="w-full min-w-[600px] border-collapse text-left text-[12.5px]">
                    <thead>
                      <tr className="bg-[var(--color-neutral-100)] text-neutral-500">
                        {parsed.headers!.map((h, i) => (
                          <th key={i} className="whitespace-nowrap px-3 py-2 font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rawRows.slice(0, 3).map((row, i) => (
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
            <div className="space-y-4">
              {parsed?.statementBalance && (
                <div className="flex items-start gap-2.5 rounded-xl bg-[var(--color-neutral-100)] px-3.5 py-3 text-[12.5px] text-neutral-600">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-neutral-400" />
                  <p>
                    Saldo informado no extrato
                    {parsed.statementBalance.asOfDate ? ` (referência ${formatDate(parsed.statementBalance.asOfDate)})` : ''}:{' '}
                    <strong className="font-semibold text-neutral-800">{formatCurrency(parsed.statementBalance.amount)}</strong>.
                    Apenas informativo — o saldo de referência da conta não é alterado automaticamente pela importação.
                  </p>
                </div>
              )}

              <div className="rounded-xl bg-rose-50/60 px-3.5 py-3 text-[13px] text-rose-800">
                {summary.total} {summary.total === 1 ? 'movimentação encontrada' : 'movimentações encontradas'} ·{' '}
                {summary.entradas} entrada{summary.entradas === 1 ? '' : 's'} · {summary.saidas} saída{summary.saidas === 1 ? '' : 's'}
                {summary.duplicates > 0 && ` · ${summary.duplicates} possível${summary.duplicates === 1 ? '' : 'is'} duplicidade${summary.duplicates === 1 ? '' : 's'}`}
                {summary.invalid > 0 && ` · ${summary.invalid} com dados incompletos (não serão importados)`}
              </div>

              <div className="max-h-[360px] overflow-auto rounded-xl border border-[var(--border-hairline)]">
                <table className="w-full min-w-[760px] border-collapse text-left text-[12.5px]">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-[var(--border-hairline)] text-neutral-500">
                      <th className="px-3 py-2 font-medium">Importar</th>
                      <th className="px-3 py-2 font-medium">Data</th>
                      <th className="px-3 py-2 font-medium">Descrição</th>
                      <th className="px-3 py-2 font-medium">Valor</th>
                      <th className="px-3 py-2 font-medium">Entrada/Saída</th>
                      <th className="px-3 py-2 font-medium">Tipo identificado</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, i) => (
                      <tr key={i} className="border-b border-[var(--border-hairline)] last:border-0">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={Boolean(included[i])}
                            disabled={!r.isValid}
                            onChange={(e) => setIncluded((prev) => ({ ...prev, [i]: e.target.checked }))}
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-neutral-600">{r.row.date ? formatDate(r.row.date) : '—'}</td>
                        <td className="max-w-[220px] truncate px-3 py-2 text-neutral-700" title={r.row.description}>
                          {r.row.description}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums text-neutral-700">
                          {r.row.amount !== null ? formatCurrency(r.row.amount) : '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-neutral-600">
                          {r.row.direction === 'entrada' ? 'Entrada' : r.row.direction === 'saida' ? 'Saída' : '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-neutral-600">{transactionKindMeta[r.kind]?.label ?? r.kind}</td>
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
                      </tr>
                    ))}
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
