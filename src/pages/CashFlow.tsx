import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Select } from '../components/ui/FormField'
import { SearchInput } from '../components/ui/SearchInput'
import { MonthYearSelector } from '../components/ui/MonthYearSelector'
import { CashFlowChart } from '../components/charts/CashFlowChart'
import { TransactionsTable } from '../components/transactions/TransactionsTable'
import { TransactionFormModal, type TransactionFormValues } from '../components/transactions/TransactionFormModal'
import { TransferFormModal, type TransferFormValues } from '../components/transactions/TransferFormModal'
import { TransferDeleteChoiceModal } from '../components/transactions/TransferDeleteChoiceModal'
import { TransferSuggestionsModal } from '../components/transactions/TransferSuggestionsModal'
import { BulkClassifyModal } from '../components/transactions/BulkClassifyModal'
import { BulkAccountModal } from '../components/transactions/BulkAccountModal'
import { BulkStatusModal } from '../components/ui/BulkStatusModal'
import { BulkActionBar } from '../components/ui/BulkActionBar'
import { ImportWizard, type ImportRowToInsert } from '../components/import/ImportWizard'
import { StatTile } from '../components/ui/StatTile'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/Confirm'
import { useData } from '../context/DataContext'
import { usePeriod } from '../context/PeriodContext'
import { monthlyCashFlowSeries, dailyCashFlowSeries, monthKey, monthTotals, todayIso } from '../lib/aggregations'
import { formatCurrency, parseCurrencyInput } from '../lib/format'
import { useSelection } from '../lib/useSelection'
import { groupByNormalizedCounterparty } from '../lib/importRules'
import { findTransferCandidates } from '../lib/transferDetection'
import { detectDuplicates } from '../lib/importDedup'
import { matchesQuery, transactionSearchFields } from '../lib/textSearch'
import { sortTransactions, useTransactionSort } from '../lib/sorting'
import { accountTypeLabel } from '../components/accounts/AccountCard'
import { TrendingUp, TrendingDown, Scale, Plus, ArrowLeftRight, Upload, Repeat } from 'lucide-react'
import type { Transaction } from '../db/models'
import type { ParsedStatementRow } from '../lib/importParsers'
import type { TransactionDirection } from '../data/types'

const periods = [
  { id: 'mensal', label: 'Últimos 6 meses' },
  { id: 'diario', label: 'Últimos 6 dias' },
] as const

export default function CashFlow() {
  const {
    accounts,
    transactions,
    costCenters,
    classificationRules,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addTransactionsBatch,
    bulkUpdateTransactions,
    bulkDeleteTransactions,
    createTransfer,
    updateTransferAmount,
    deleteTransferBoth,
    unlinkTransfer,
    linkAsTransfer,
    saveClassificationRule,
    registerRuleUsage,
    updateAccount,
  } = useData()
  const { period: selectedPeriod, label: periodLabel, setPeriod } = usePeriod()
  const toast = useToast()
  const confirm = useConfirm()
  const selection = useSelection()

  const [chartPeriod, setChartPeriod] = useState<(typeof periods)[number]['id']>('mensal')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [newTransactionPrefill, setNewTransactionPrefill] = useState<Partial<TransactionFormValues> | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [deletingTransfer, setDeletingTransfer] = useState<Transaction | null>(null)
  const [suggestionCandidates, setSuggestionCandidates] = useState<ReturnType<typeof findTransferCandidates> | null>(null)

  const [bulkModal, setBulkModal] = useState<'categoria' | 'centroDeCusto' | 'conta' | 'status' | null>(null)

  const [filterAccount, setFilterAccount] = useState('')
  const [search, setSearch] = useState('')
  const sort = useTransactionSort()

  const data = chartPeriod === 'mensal' ? monthlyCashFlowSeries(accounts, transactions) : dailyCashFlowSeries(accounts, transactions)

  // Cards (Entradas/Saídas/Resultado) usam SEMPRE a data do lançamento (nunca createdAt/importação)
  // e o mesmo período mensal escolhido no seletor global — reaproveita `monthTotals`, que já trata
  // lançamentos manuais e importados igualmente e já exclui transferências entre contas próprias.
  const periodTotals = useMemo(() => monthTotals(transactions, selectedPeriod), [transactions, selectedPeriod])
  const periodResultado = periodTotals.entradas - periodTotals.saidas

  // A tabela usa o MESMO período dos cards acima, mais o filtro de conta e a pesquisa — nunca um
  // período diferente do selecionado globalmente.
  const periodTransactions = useMemo(() => transactions.filter((t) => monthKey(t.date) === selectedPeriod), [transactions, selectedPeriod])

  const filteredTransactions = useMemo(
    () =>
      periodTransactions.filter(
        (t) =>
          (!filterAccount || t.accountId === filterAccount) &&
          matchesQuery(transactionSearchFields(t, costCenters, accounts), search),
      ),
    [periodTransactions, filterAccount, search, costCenters, accounts],
  )

  const sortedTransactions = useMemo(
    () => sortTransactions(filteredTransactions, sort.sortKey, sort.sortDir, costCenters),
    [filteredTransactions, sort.sortKey, sort.sortDir, costCenters],
  )

  const selectedTransactions = useMemo(
    () => transactions.filter((t) => selection.selected.has(t.id)),
    [transactions, selection.selected],
  )

  const openNew = () => {
    setEditing(null)
    setNewTransactionPrefill(null)
    setModalOpen(true)
  }
  const openEdit = (t: Transaction) => {
    setEditing(t)
    setNewTransactionPrefill(null)
    setModalOpen(true)
  }

  // Permite chegar aqui a partir de um resultado clicável da busca geral (/buscar), já abrindo o
  // lançamento correspondente para edição — sem navegação quebrada.
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    const targetId = (location.state as { openTransactionId?: string } | null)?.openTransactionId
    if (!targetId) return
    const tx = transactions.find((t) => t.id === targetId)
    if (tx) openEdit(tx)
    navigate(location.pathname, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])

  /** Abre o formulário existente de lançamento já preenchido a partir de uma "possível movimentação"
   * de PDF que não foi reconhecida automaticamente — reaproveita a mesma dedicação/lógica de
   * deduplicação usada na importação, avisando antes se parecer duplicada. */
  const handleCreateFromCandidate = async (
    candidateAccountId: string,
    prefill: {
      date: string
      description: string
      originalDescription: string
      counterparty: string
      document: string
      direction: TransactionDirection | ''
      amount: string
    },
  ) => {
    const amountNum = parseCurrencyInput(prefill.amount)
    if (prefill.date && !Number.isNaN(amountNum) && amountNum > 0) {
      const syntheticRow: ParsedStatementRow = {
        index: 0,
        date: prefill.date || null,
        description: prefill.originalDescription,
        friendlyDescription: prefill.description,
        counterparty: prefill.counterparty || undefined,
        amount: amountNum,
        direction: (prefill.direction || null) as 'entrada' | 'saida' | null,
        document: prefill.document || undefined,
        rawFields: {},
      }
      const dedup = detectDuplicates([syntheticRow], candidateAccountId, transactions)
      if (dedup[0]?.isPossibleDuplicate) {
        const ok = await confirm({
          title: 'Possível duplicidade',
          description: `${dedup[0].reason || 'Já existe um lançamento parecido nesta conta.'} Deseja continuar mesmo assim?`,
          confirmLabel: 'Continuar mesmo assim',
        })
        if (!ok) return
      }
    }

    setEditing(null)
    setNewTransactionPrefill({
      direction: (prefill.direction || 'saida') as TransactionDirection,
      date: prefill.date || todayIso(),
      description: prefill.description,
      originalDescription: prefill.originalDescription,
      counterparty: prefill.counterparty,
      document: prefill.document,
      accountId: candidateAccountId,
      amount: prefill.amount,
    })
    setModalOpen(true)
  }

  const handleSubmit = async (values: TransactionFormValues, saveAsRule: boolean) => {
    const payload = {
      direction: values.direction,
      kind: values.kind,
      amount: parseCurrencyInput(values.amount),
      date: values.date,
      description: values.description.trim(),
      originalDescription: values.originalDescription.trim() || undefined,
      counterparty: values.counterparty.trim() || undefined,
      document: values.document.trim() || undefined,
      accountId: values.accountId,
      costCenterId: values.costCenterId || null,
      categoryId: values.categoryId || null,
      note: values.note.trim() || undefined,
    }

    if (editing) {
      if (editing.transferId && payload.amount !== editing.amount) {
        const ok = await confirm({
          title: 'Atualizar transferência vinculada',
          description: `Esta movimentação faz parte de uma transferência vinculada. Deseja atualizar as duas pontas para ${formatCurrency(payload.amount)}?`,
          confirmLabel: 'Atualizar as duas',
        })
        if (!ok) return
        await updateTransferAmount(editing.transferId, payload.amount)
      }
      await updateTransaction(editing.id, payload)
      toast.show('Lançamento atualizado.')
    } else {
      await addTransaction(payload)
      toast.show('Lançamento adicionado.')
    }

    if (saveAsRule && payload.counterparty && payload.costCenterId) {
      await saveClassificationRule({ counterparty: payload.counterparty, categoryId: payload.categoryId, costCenterId: payload.costCenterId })
      toast.show('Regra de classificação salva.', 'info')
    }
  }

  const handleDelete = async (t: Transaction) => {
    if (t.transferId) {
      setDeletingTransfer(t)
      return
    }
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
    setModalOpen(false)
    await handleDelete(editing)
  }

  const handleConfirmImport = async (importAccountId: string, rows: ImportRowToInsert[]) => {
    const created = await addTransactionsBatch(
      rows.map((r) => ({
        date: r.date,
        description: r.description,
        originalDescription: r.originalDescription,
        counterparty: r.counterparty,
        document: r.document,
        sourceFile: r.sourceFile,
        kind: r.kind,
        direction: r.direction,
        amount: r.amount,
        accountId: importAccountId,
        costCenterId: r.categoryId ? r.costCenterId ?? null : null,
        categoryId: r.categoryId ?? null,
        source: 'importado' as const,
      })),
    )
    toast.show(`${rows.length} lançamento${rows.length === 1 ? '' : 's'} importado${rows.length === 1 ? '' : 's'}.`)
    // Depois de confirmar a importação, muda o período selecionado para o mês do primeiro
    // lançamento importado — assim a usuária vê imediatamente o que acabou de importar, em vez de
    // continuar olhando para um mês (ex.: o mês atual) onde nada apareceria.
    if (created.length > 0) setPeriod(monthKey(created[0].date))
    return created
  }

  const handleTransferSubmit = async (values: TransferFormValues) => {
    await createTransfer({
      fromAccountId: values.fromAccountId,
      toAccountId: values.toAccountId,
      amount: parseCurrencyInput(values.amount),
      date: values.date,
      note: values.note.trim() || undefined,
    })
    toast.show('Transferência registrada.')
  }

  // ---------- Ações em massa ----------
  const handleBulkClassify = async (value: { costCenterId: string | null; categoryId: string | null }, saveAsRule: boolean) => {
    const ids = selection.selectedIds
    await bulkUpdateTransactions(ids, value)
    toast.show(`${ids.length} lançamento${ids.length === 1 ? '' : 's'} atualizado${ids.length === 1 ? '' : 's'}.`)

    if (saveAsRule && value.costCenterId) {
      const groups = groupByNormalizedCounterparty(selectedTransactions, (t) => t.counterparty)
      for (const group of groups.values()) {
        const counterparty = group[0].counterparty
        if (!counterparty) continue
        await saveClassificationRule({ counterparty, categoryId: value.categoryId, costCenterId: value.costCenterId })
      }
      if (groups.size > 0) toast.show(`${groups.size} regra${groups.size === 1 ? '' : 's'} de classificação salva${groups.size === 1 ? '' : 's'}.`, 'info')
    }
    selection.clear()
  }

  const handleBulkAccount = async (accountId: string) => {
    const ids = selection.selectedIds
    await bulkUpdateTransactions(ids, { accountId })
    toast.show(`Conta alterada em ${ids.length} lançamento${ids.length === 1 ? '' : 's'}. Saldos recalculados.`)
    selection.clear()
  }

  const handleBulkStatusChange = async (value: string) => {
    const ids = selection.selectedIds
    await bulkUpdateTransactions(ids, { status: value as Transaction['status'] })
    toast.show(`Status atualizado em ${ids.length} lançamento${ids.length === 1 ? '' : 's'}.`)
    selection.clear()
  }

  const handleBulkDelete = async () => {
    const ids = selection.selectedIds
    const ok = await confirm({
      title: 'Excluir lançamentos',
      description: `Tem certeza de que deseja excluir ${ids.length} lançamento${ids.length === 1 ? '' : 's'}? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    })
    if (!ok) return
    await bulkDeleteTransactions(ids)
    toast.show(`${ids.length} lançamento${ids.length === 1 ? '' : 's'} excluído${ids.length === 1 ? '' : 's'}.`, 'info')
    selection.clear()
  }

  const handleBulkTransferPair = async () => {
    if (selection.selectedIds.length !== 2) return
    const [idA, idB] = selection.selectedIds
    const a = transactions.find((t) => t.id === idA)
    const b = transactions.find((t) => t.id === idB)
    if (!a || !b) return
    setSuggestionCandidates([{ a, b, daysApart: 0, score: 100 }])
  }

  const handleIdentifyTransfers = () => {
    // Procura entre todo o histórico — a seleção é só o gatilho; assim também encontramos o par de
    // uma movimentação que a usuária esqueceu de selecionar.
    const candidates = findTransferCandidates(transactions)
    setSuggestionCandidates(candidates)
  }

  const handleUnlinkTransfer = async () => {
    if (!editing?.transferId) return
    await unlinkTransfer(editing.transferId)
    setModalOpen(false)
    toast.show('Transferência desvinculada.', 'info')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fluxo de Caixa"
        subtitle="Acompanhe entradas, saídas e a evolução do seu saldo ao longo do tempo."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <MonthYearSelector />
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload size={16} /> Importar extrato
            </Button>
            <Button variant="secondary" onClick={() => setTransferOpen(true)}>
              <Repeat size={16} /> Transferência
            </Button>
            <Button onClick={openNew}>
              <Plus size={16} /> Novo lançamento
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label={`Entradas · ${periodLabel}`} value={formatCurrency(periodTotals.entradas)} icon={TrendingUp} accent="var(--color-cat-teal)" />
        <StatTile label={`Saídas · ${periodLabel}`} value={formatCurrency(periodTotals.saidas)} icon={TrendingDown} accent="var(--color-cat-rose)" />
        <StatTile
          label={`Resultado · ${periodLabel}`}
          value={formatCurrency(periodResultado)}
          icon={Scale}
          accent={periodResultado >= 0 ? 'var(--color-status-good)' : 'var(--color-status-critical)'}
        />
      </div>

      <Card>
        <CardTitle
          hint={
            <div className="flex rounded-full bg-[var(--color-neutral-100)] p-1">
              {periods.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setChartPeriod(p.id)}
                  className={[
                    'rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                    chartPeriod === p.id ? 'bg-white text-rose-800 shadow-sm' : 'text-neutral-500 hover:text-neutral-700',
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
        <p className="-mt-3 mb-4 text-[12px] text-neutral-400">
          Este gráfico mostra uma janela de tendência ({chartPeriod === 'mensal' ? 'últimos 6 meses' : 'últimos 6 dias'}), independente do
          período selecionado acima — os cards e a tabela abaixo mostram especificamente {periodLabel}.
        </p>
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
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-0 lg:px-6">
          <CardTitle>Lançamentos · {periodLabel}</CardTitle>
          {transactions.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <SearchInput
                placeholder="Pesquisar lançamentos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="!w-[220px] !py-1.5 !text-[12.5px]"
              />
              <Select value={filterAccount} onChange={(e) => setFilterAccount(e.target.value)} className="!w-auto !py-1.5 !text-[12.5px]">
                <option value="">Todas as contas</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.nickname || acc.bank} · {accountTypeLabel[acc.type]}
                  </option>
                ))}
              </Select>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="rounded-full px-2.5 py-1.5 text-[12.5px] font-medium text-rose-700 hover:underline"
                >
                  Limpar
                </button>
              )}
            </div>
          )}
        </div>
        <div className="p-5 pt-0 lg:p-6 lg:pt-0">
          {transactions.length === 0 ? (
            <EmptyState
              icon={ArrowLeftRight}
              title="Nenhum lançamento cadastrado"
              description="Comece registrando sua primeira entrada ou saída."
              actionLabel="+ Novo lançamento"
              onAction={openNew}
            />
          ) : sortedTransactions.length === 0 ? (
            <p className="py-10 text-center text-[14px] text-neutral-500">
              {search ? (
                <>Nenhum resultado encontrado para "{search}" em {periodLabel}.</>
              ) : (
                <>Nenhum lançamento em {periodLabel} com esse filtro.</>
              )}
            </p>
          ) : (
            <TransactionsTable
              transactions={sortedTransactions}
              costCenters={costCenters}
              onEdit={openEdit}
              onDelete={handleDelete}
              selectable
              selectedIds={selection.selected}
              onToggleOne={selection.toggle}
              sortKey={sort.sortKey}
              sortDir={sort.sortDir}
              onSortChange={sort.onSortChange}
              onToggleAll={selection.toggleAll}
            />
          )}
        </div>
      </Card>

      <BulkActionBar count={selection.selectedCount} onClear={selection.clear}>
        <Button size="sm" variant="secondary" onClick={() => setBulkModal('categoria')}>
          Categoria
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setBulkModal('centroDeCusto')}>
          Centro de custo
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setBulkModal('conta')}>
          Conta
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setBulkModal('status')}>
          Status
        </Button>
        <Button size="sm" variant="secondary" onClick={handleBulkTransferPair} disabled={selection.selectedCount !== 2}>
          Transferência interna
        </Button>
        <Button size="sm" variant="secondary" onClick={handleIdentifyTransfers}>
          Identificar transferências
        </Button>
        <Button size="sm" className="!bg-[var(--color-status-critical)] hover:!bg-[var(--color-status-critical)]" onClick={handleBulkDelete}>
          Excluir
        </Button>
      </BulkActionBar>

      <TransferFormModal open={transferOpen} onClose={() => setTransferOpen(false)} onSubmit={handleTransferSubmit} accounts={accounts} />

      <TransferDeleteChoiceModal
        open={deletingTransfer !== null}
        onClose={() => setDeletingTransfer(null)}
        transaction={deletingTransfer}
        onDeleteBoth={async () => {
          if (!deletingTransfer?.transferId) return
          await deleteTransferBoth(deletingTransfer.transferId)
          setDeletingTransfer(null)
          toast.show('Transferência excluída.', 'info')
        }}
        onUnlinkAndDeleteOne={async () => {
          if (!deletingTransfer) return
          await deleteTransaction(deletingTransfer.id)
          setDeletingTransfer(null)
          toast.show('Lançamento excluído e transferência desvinculada.', 'info')
        }}
      />

      <TransferSuggestionsModal
        open={suggestionCandidates !== null}
        onClose={() => setSuggestionCandidates(null)}
        candidates={suggestionCandidates ?? []}
        accounts={accounts}
        onConfirmPair={async (idA, idB) => {
          const result = await linkAsTransfer(idA, idB)
          if (result.ok) {
            toast.show('Transferência vinculada.')
            selection.clear()
          }
          return result
        }}
      />

      <BulkClassifyModal
        open={bulkModal === 'categoria' || bulkModal === 'centroDeCusto'}
        onClose={() => setBulkModal(null)}
        mode={bulkModal === 'categoria' ? 'categoria' : 'centroDeCusto'}
        count={selection.selectedCount}
        costCenters={costCenters}
        ruleGroupsCount={groupByNormalizedCounterparty(selectedTransactions, (t) => t.counterparty).size}
        onConfirm={handleBulkClassify}
      />

      <BulkAccountModal
        open={bulkModal === 'conta'}
        onClose={() => setBulkModal(null)}
        count={selection.selectedCount}
        accounts={accounts}
        onConfirm={handleBulkAccount}
      />

      <BulkStatusModal
        open={bulkModal === 'status'}
        onClose={() => setBulkModal(null)}
        count={selection.selectedCount}
        options={[
          { value: 'classificado', label: 'Classificado' },
          { value: 'aguardando_classificacao', label: 'Aguardando classificação' },
        ]}
        onConfirm={handleBulkStatusChange}
      />

      <ImportWizard
        open={importOpen}
        onClose={() => setImportOpen(false)}
        accounts={accounts}
        costCenters={costCenters}
        transactions={transactions}
        classificationRules={classificationRules}
        onConfirmImport={handleConfirmImport}
        onRuleUsed={registerRuleUsage}
        onLinkTransfer={linkAsTransfer}
        onUseReferenceBalance={(accountId, amount, asOfDate) => updateAccount(accountId, { openingBalance: amount, openingDate: asOfDate })}
        onCreateFromCandidate={handleCreateFromCandidate}
      />

      {/* Renderizado depois do ImportWizard para poder abrir "por cima" dele quando disparado a
          partir de uma possível movimentação não reconhecida na prévia de importação. */}
      <TransactionFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setNewTransactionPrefill(null)
        }}
        onSubmit={handleSubmit}
        onDelete={editing ? handleDeleteFromModal : undefined}
        onUnlinkTransfer={editing?.transferId ? handleUnlinkTransfer : undefined}
        accounts={accounts}
        costCenters={costCenters}
        transaction={editing}
        initialValues={newTransactionPrefill ?? undefined}
      />
    </div>
  )
}
