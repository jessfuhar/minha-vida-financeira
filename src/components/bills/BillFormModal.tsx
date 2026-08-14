import { useEffect, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Field, TextInput, Select } from '../ui/FormField'
import { accountTypeLabel } from '../accounts/AccountCard'
import type { Account, CostCenter, Bill } from '../../db/models'
import { todayIso } from '../../lib/aggregations'
import { isValidCurrencyInput, parseCurrencyInput, formatCurrency } from '../../lib/format'

export interface BillFormValues {
  name: string
  originalDescription: string
  amount: string
  dueDate: string
  accountId: string
  costCenterId: string
  categoryId: string
  recurring: boolean
}

function emptyValues(): BillFormValues {
  return {
    name: '',
    originalDescription: '',
    amount: '',
    dueDate: todayIso(),
    accountId: '',
    costCenterId: '',
    categoryId: '',
    recurring: false,
  }
}

interface BillFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (values: BillFormValues) => Promise<void>
  onDelete?: () => void
  accounts: Account[]
  costCenters: CostCenter[]
  bill?: Bill | null
}

export function BillFormModal({ open, onClose, onSubmit, onDelete, accounts, costCenters, bill }: BillFormModalProps) {
  const [values, setValues] = useState<BillFormValues>(emptyValues)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (bill) {
      setValues({
        name: bill.name,
        originalDescription: bill.originalDescription ?? '',
        amount: String(bill.amount),
        dueDate: bill.dueDate,
        accountId: bill.accountId ?? '',
        costCenterId: bill.costCenterId ?? '',
        categoryId: bill.categoryId ?? '',
        recurring: bill.recurring,
      })
    } else {
      setValues(emptyValues())
    }
    setError('')
  }, [open, bill])

  const selectedCostCenter = costCenters.find((c) => c.id === values.costCenterId)

  const handleSubmit = async () => {
    if (!values.name.trim()) return setError('Descreva a conta.')
    if (!isValidCurrencyInput(values.amount) || parseCurrencyInput(values.amount) <= 0) {
      return setError('Informe um valor válido.')
    }
    setError('')
    setSaving(true)
    try {
      await onSubmit(values)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={bill ? 'Editar conta a pagar' : 'Nova conta a pagar'}
      width="lg"
      footer={
        <>
          {bill && onDelete && (
            <Button variant="ghost" size="sm" onClick={onDelete} className="mr-auto !text-[var(--color-status-critical)]">
              Excluir
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Descrição" required error={error.includes('Descreva') ? error : undefined}>
            <TextInput
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              placeholder="Ex.: Internet, Aluguel, Cartão de crédito…"
              autoFocus
            />
          </Field>
          <Field label="Descrição/origem original (opcional)" hint="Como aparece no boleto ou fatura">
            <TextInput
              value={values.originalDescription}
              onChange={(e) => setValues((v) => ({ ...v, originalDescription: e.target.value }))}
              placeholder="Ex.: CLARO S.A."
            />
          </Field>
        </div>

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
            />
          </Field>
          <Field label="Vencimento" required>
            <TextInput type="date" value={values.dueDate} onChange={(e) => setValues((v) => ({ ...v, dueDate: e.target.value }))} />
          </Field>
        </div>

        <Field label="Conta bancária" hint="Usada se você gerar o lançamento automaticamente ao pagar">
          <Select value={values.accountId} onChange={(e) => setValues((v) => ({ ...v, accountId: e.target.value }))}>
            <option value="">Escolher depois</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.nickname || acc.bank} · {accountTypeLabel[acc.type]}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Centro de custo">
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

        <label className="flex items-center gap-2.5 text-[13.5px] text-neutral-700">
          <input
            type="checkbox"
            checked={values.recurring}
            onChange={(e) => setValues((v) => ({ ...v, recurring: e.target.checked }))}
            className="h-4 w-4 rounded border-neutral-300 text-rose-600 focus:ring-rose-300"
          />
          Conta recorrente (repete todo mês)
        </label>
      </div>
    </Modal>
  )
}
