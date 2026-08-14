import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, TextInput, Textarea, Select, PillToggle } from '../ui/FormField'
import { kindsByDirection, transactionKindMeta } from '../../lib/transactionKind'
import { accountTypeLabel } from '../accounts/AccountCard'
import type { Account, CostCenter, Transaction } from '../../db/models'
import type { TransactionDirection, TransactionKind } from '../../data/types'
import { todayIso } from '../../lib/aggregations'
import { isValidCurrencyInput, parseCurrencyInput, formatCurrency } from '../../lib/format'

export interface TransactionFormValues {
  direction: TransactionDirection
  kind: TransactionKind
  amount: string
  date: string
  description: string
  originalDescription: string
  counterparty: string
  document: string
  accountId: string
  costCenterId: string
  categoryId: string
  note: string
}

function emptyValues(accounts: Account[]): TransactionFormValues {
  return {
    direction: 'saida',
    kind: 'outros',
    amount: '',
    date: todayIso(),
    description: '',
    originalDescription: '',
    counterparty: '',
    document: '',
    accountId: accounts[0]?.id ?? '',
    costCenterId: '',
    categoryId: '',
    note: '',
  }
}

interface TransactionFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (values: TransactionFormValues, saveAsRule: boolean) => Promise<void>
  onDelete?: () => void
  onUnlinkTransfer?: () => void
  accounts: Account[]
  costCenters: CostCenter[]
  transaction?: Transaction | null
  /** Valores iniciais para um lançamento NOVO (ignorado quando `transaction` está definido) — usado,
   * por exemplo, para pré-preencher o formulário a partir de uma possível movimentação de PDF que
   * não foi reconhecida automaticamente. Todos os campos continuam editáveis normalmente. */
  initialValues?: Partial<TransactionFormValues>
}

export function TransactionFormModal({
  open,
  onClose,
  onSubmit,
  onDelete,
  onUnlinkTransfer,
  accounts,
  costCenters,
  transaction,
  initialValues,
}: TransactionFormModalProps) {
  const [values, setValues] = useState<TransactionFormValues>(() => emptyValues(accounts))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveAsRule, setSaveAsRule] = useState(false)

  useEffect(() => {
    if (!open) return
    if (transaction) {
      setValues({
        direction: transaction.direction,
        kind: transaction.kind,
        amount: String(transaction.amount),
        date: transaction.date,
        description: transaction.description,
        originalDescription: transaction.originalDescription ?? '',
        counterparty: transaction.counterparty ?? '',
        document: transaction.document ?? '',
        accountId: transaction.accountId,
        costCenterId: transaction.costCenterId ?? '',
        categoryId: transaction.categoryId ?? '',
        note: transaction.note ?? '',
      })
    } else {
      setValues({ ...emptyValues(accounts), ...initialValues })
    }
    setSaveAsRule(false)
    setError('')
  }, [open, transaction, accounts, initialValues])

  const availableKinds = kindsByDirection[values.direction]
  const selectedCostCenter = costCenters.find((c) => c.id === values.costCenterId)

  const setDirection = (direction: TransactionDirection) => {
    setValues((v) => ({
      ...v,
      direction,
      kind: kindsByDirection[direction].includes(v.kind) ? v.kind : kindsByDirection[direction][0],
    }))
  }

  const handleSubmit = async () => {
    if (!values.description.trim()) return setError('Descreva o lançamento.')
    if (!isValidCurrencyInput(values.amount) || parseCurrencyInput(values.amount) <= 0) {
      return setError('Informe um valor válido, maior que zero.')
    }
    if (!values.accountId) return setError('Selecione a conta bancária.')
    setError('')
    setSaving(true)
    try {
      await onSubmit(values, saveAsRule)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const noAccounts = accounts.length === 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={transaction ? 'Editar lançamento' : 'Novo lançamento'}
      width="lg"
      footer={
        <>
          {transaction && onDelete && (
            <Button variant="ghost" size="sm" onClick={onDelete} className="mr-auto !text-[var(--color-status-critical)]">
              Excluir
            </Button>
          )}
          {transaction?.transferId && onUnlinkTransfer && (
            <Button variant="ghost" size="sm" onClick={onUnlinkTransfer}>
              Desvincular transferência
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || noAccounts}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      {noAccounts ? (
        <p className="py-6 text-center text-[13.5px] text-neutral-500">
          Cadastre uma conta bancária antes de lançar entradas ou saídas.
        </p>
      ) : (
        <div className="space-y-4">
          {transaction?.source === 'importado' && (
            <div className="rounded-xl bg-[var(--color-neutral-100)] px-3.5 py-2.5 text-[12.5px] text-neutral-600">
              Origem: Importado de extrato — todos os campos abaixo continuam editáveis normalmente.
            </div>
          )}

          {transaction?.transferId && (
            <div className="rounded-xl bg-[var(--color-neutral-100)] px-3.5 py-2.5 text-[12.5px] text-neutral-600">
              Esta movimentação faz parte de uma transferência entre contas próprias vinculada.
            </div>
          )}

          <Field label="Tipo de movimento" required>
            <PillToggle
              value={values.direction}
              onChange={setDirection}
              options={[
                { value: 'entrada', label: 'Entrada' },
                { value: 'saida', label: 'Saída' },
              ]}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Valor"
              required
              error={error.includes('valor') ? error : undefined}
              hint={isValidCurrencyInput(values.amount) ? formatCurrency(parseCurrencyInput(values.amount)) : undefined}
            >
              <TextInput
                inputMode="decimal"
                value={values.amount}
                onChange={(e) => setValues((v) => ({ ...v, amount: e.target.value }))}
                placeholder="0,00"
                autoFocus
              />
            </Field>
            <Field label="Data" required>
              <TextInput type="date" value={values.date} onChange={(e) => setValues((v) => ({ ...v, date: e.target.value }))} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Descrição" required error={error.includes('Descreva') ? error : undefined}>
              <TextInput
                value={values.description}
                onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
                placeholder="Ex.: Mercado, Salário, Pix da Ana…"
              />
            </Field>
            <Field label="Descrição/origem original (opcional)" hint="Como aparece no extrato, boleto ou comprovante">
              <TextInput
                value={values.originalDescription}
                onChange={(e) => setValues((v) => ({ ...v, originalDescription: e.target.value }))}
                placeholder="Ex.: PIX ENVIADO 02/08 22:36 COPEL DISTRIBUICAO S.A."
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Contraparte (pessoa/empresa, opcional)" hint="Para quem foi enviado ou de quem foi recebido">
              <TextInput
                value={values.counterparty}
                onChange={(e) => setValues((v) => ({ ...v, counterparty: e.target.value }))}
                placeholder="Ex.: COPEL DISTRIBUICAO S.A."
              />
            </Field>
            <Field label="Documento / identificador (opcional)" hint="Nº do documento, comprovante ou identificador do extrato">
              <TextInput
                value={values.document}
                onChange={(e) => setValues((v) => ({ ...v, document: e.target.value }))}
                placeholder="Ex.: 000123456789"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Conta bancária" required error={error.includes('conta') ? error : undefined}>
              <Select value={values.accountId} onChange={(e) => setValues((v) => ({ ...v, accountId: e.target.value }))}>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.nickname || acc.bank} · {accountTypeLabel[acc.type]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo de movimentação" required>
              <Select value={values.kind} onChange={(e) => setValues((v) => ({ ...v, kind: e.target.value as TransactionKind }))}>
                {availableKinds.map((k) => (
                  <option key={k} value={k}>
                    {transactionKindMeta[k].label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Centro de custo" hint="Opcional, mas recomendado">
              <Select
                value={values.costCenterId}
                onChange={(e) => setValues((v) => ({ ...v, costCenterId: e.target.value, categoryId: '' }))}
              >
                <option value="">Sem centro de custo</option>
                {costCenters.map((cc) => (
                  <option key={cc.id} value={cc.id}>
                    {cc.emoji} {cc.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Categoria" hint={selectedCostCenter ? undefined : 'Escolha um centro de custo primeiro'}>
              <Select
                value={values.categoryId}
                onChange={(e) => setValues((v) => ({ ...v, categoryId: e.target.value }))}
                disabled={!selectedCostCenter}
              >
                <option value="">Sem categoria</option>
                {selectedCostCenter?.categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {values.counterparty.trim() && values.costCenterId && (
            <label className="flex items-start gap-2.5 rounded-xl bg-[var(--color-neutral-100)] px-3.5 py-3 text-[13px] text-neutral-600">
              <input type="checkbox" checked={saveAsRule} onChange={(e) => setSaveAsRule(e.target.checked)} className="mt-0.5" />
              <span>
                Salvar como regra para movimentações semelhantes — da próxima vez que{' '}
                <strong className="font-medium text-neutral-800">{values.counterparty.trim()}</strong> aparecer numa importação, a
                categoria e o centro de custo serão sugeridos automaticamente.
              </span>
            </label>
          )}

          <Field label="Observação (opcional)">
            <Textarea
              value={values.note}
              onChange={(e) => setValues((v) => ({ ...v, note: e.target.value }))}
              placeholder="Alguma anotação sobre esse lançamento…"
            />
          </Field>
        </div>
      )}
    </Modal>
  )
}
