import { useMemo, useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { CashFlowChart } from '../components/charts/CashFlowChart'
import { TransactionsTable } from '../components/transactions/TransactionsTable'
import { TransactionFormModal, type TransactionFormValues } from '../components/transactions/TransactionFormModal'
import { ImportWizard, type ImportRowToInsert } from '../components/import/ImportWizard'
import { StatTile } from '../components/ui/StatTile'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/Confirm'
import { useData } from '../context/DataContext'
import { monthlyCashFlowSeries, dailyCashFlowSeries } from '../lib/aggregations'
import { formatCurrency, parseCurrencyInput } from '../lib/format'
import { TrendingUp, TrendingDown, Scale, Plus, ArrowLeftRight, Upload } from 'lucide-react'
import type { Transaction } from '../db/models'

const periods = [
  { id: 'mensal', label: 'Últimos 6 meses' },
  { id: 'diario', label: 'Últimos 6 dias' },
] as const

export default function CashFlow() {
  const { accounts, transactions, costCenters, monthSummary, addTransaction, updateTransaction, deleteTransaction, addTransactionsBatch } =
    useData()
  const toast = useToast()
  const confirm = useConfirm()

  const [period, setPeriod] = useState<(typeof periods)[number]['id']>('mensal')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const data = period === 'mensal' ? monthlyCashFlowSeries(accounts, transactions) : dailyCashFlowSeries(accounts, transactions)

  const sortedTransactions = useMemo(
    () => [...transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt))),
    [transactions],
  )

  const openNew = () => {
    setEditing(null)
    setModalOpen(true)
  }
  const openEdit = (t: Transaction) => {
    setEditing(t)
    setModalOpen(true)
  }

  const handleSubmit = async (values: TransactionFormValues) => {
    const payload = {
      direction: values.direction,
      kind: values.kind,
      amount: parseCurrencyInput(values.amount),
      date: values.date,
      description: values.description.trim(),
      originalDescription: values.originalDescription.trim() || undefined,
      document: values.document.trim() || undefined,
      accountId: values.accountId,
      costCenterId: values.costCenterId || null,
      categoryId: values.categoryId || null,
      note: values.note.trim() || undefined,
    }
    if (editing) {
      await updateTransaction(editing.id, payload)
      toast.show('Lançamento atualizado.')
    } else {
      await addTransaction(payload)
      toast.show('Lançamento adicionado.')
    }
  }

  const handleDelete = async (t: Transaction) => {
    const ok = await confirm({
      title: 'Excluir lançamento',
      description: `Excluir "${t.description}"? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    await deleteTransaction(t.id)
    toast.show('Lançamento excluído.', 'info')
  }

  const handleDeleteFromModal = async () => {
    if (!editing) return
    await handleDelete(editing)
    setModalOpen(false)
  }

  const handleConfirmImport = async (importAccountId: string, rows: ImportRowToInsert[]) => {
    await addTransactionsBatch(
      rows.map((r) => ({
        date: r.date,
        description: r.description,
        originalDescription: r.originalDescription,
        document: r.document,
        kind: r.kind,
        direction: r.direction,
        amount: r.amount,
        accountId: importAccountId,
        costCenterId: null,
        categoryId: null,
        source: 'importado' as const,
      })),
    )
    toast.show(`${rows.length} lançamento${rows.length === 1 ? '' : 's'} importado${rows.length === 1 ? '' : 's'}.`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fluxo de Caixa"
        subtitle="Acompanhe entradas, saídas e a evolução do seu saldo ao longo do tempo."
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload size={16} /> Importar extrato
            </Button>
            <Button onClick={openNew}>
              <Plus size={16} /> Novo lançamento
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Entradas do mês" value={formatCurrency(monthSummary.entradas)} icon={TrendingUp} accent="var(--color-cat-teal)" />
        <StatTile label="Saídas do mês" value={formatCurrency(monthSummary.saidas)} icon={TrendingDown} accent="var(--color-cat-rose)" />
        <StatTile
          label="Resultado do mês"
          value={formatCurrency(monthSummary.resultado)}
          icon={Scale}
          accent={monthSummary.resultado >= 0 ? 'var(--color-status-good)' : 'var(--color-status-critical)'}
        />
      </div>

      <Card>
        <CardTitle
          hint={
            <div className="flex rounded-full bg-[var(--color-neutral-100)] p-1">
              {periods.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={[
                    'rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                    period === p.id ? 'bg-white text-rose-800 shadow-sm' : 'text-neutral-500 hover:text-neutral-700',
                  ].join(' ')}
                >
                  {p.label}
                </button>
              ))}
            </div>
          }
        >
          Entradas, saídas e saldo acumulado
        </CardTitle>
        {transactions.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="Nenhum lançamento ainda"
            description="Registre entradas e saídas para acompanhar sua evolução aqui."
            actionLabel="+ Novo lançamento"
            onAction={openNew}
          />
        ) : (
          <CashFlowChart data={data} height={340} />
        )}
      </Card>

      <Card padded={false}>
        <div className="p-5 pb-0 lg:p-6 lg:pb-0">
          <CardTitle>Todos os lançamentos</CardTitle>
        </div>
        <div className="p-5 pt-0 lg:p-6 lg:pt-0">
          {sortedTransactions.length === 0 ? (
            <EmptyState
              icon={ArrowLeftRight}
              title="Nenhum lançamento cadastrado"
              description="Comece registrando sua primeira entrada ou saída."
              actionLabel="+ Novo lançamento"
              onAction={openNew}
            />
          ) : (
            <TransactionsTable
              transactions={sortedTransactions}
              costCenters={costCenters}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          )}
        </div>
      </Card>

      <TransactionFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        onDelete={editing ? handleDeleteFromModal : undefined}
        accounts={accounts}
        costCenters={costCenters}
        transaction={editing}
      />

      <ImportWizard
        open={importOpen}
        onClose={() => setImportOpen(false)}
        accounts={accounts}
        transactions={transactions}
        onConfirmImport={handleConfirmImport}
      />
    </div>
  )
}
