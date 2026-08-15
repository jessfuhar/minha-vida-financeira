import { Pencil } from 'lucide-react'
import type { Account, AccountType } from '../../db/models'
import { formatCurrency } from '../../lib/format'
import { accountGradient, accountInitials } from '../../lib/aggregations'

export const accountTypeLabel: Record<AccountType, string> = {
  corrente: 'Conta corrente',
  poupanca: 'Poupança',
  digital: 'Conta digital',
  carteira_digital: 'Carteira digital',
  investimento: 'Investimento',
  outro: 'Outro',
}

interface AccountCardProps {
  account: Account
  balance: number
  onEdit: () => void
}

export function AccountCard({ account, balance, onEdit }: AccountCardProps) {
  const [from, to] = accountGradient(account.id)
  return (
    <button
      type="button"
      onClick={onEdit}
      className="card-interactive group flex min-w-[196px] flex-1 flex-col justify-between rounded-xl border border-[var(--border-hairline)] bg-white p-4 text-left shadow-[var(--shadow-card)]"
    >
      <div className="flex items-center gap-2.5">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12.5px] font-semibold text-white"
          style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
        >
          {accountInitials(account.bank)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold text-neutral-800">
            {account.nickname || account.bank}
          </p>
          <p className="truncate text-[11.5px] text-neutral-500">
            {account.nickname ? account.bank + ' · ' : ''}
            {accountTypeLabel[account.type]}
          </p>
        </div>
        <Pencil size={13} className="shrink-0 text-neutral-300 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <p className="mt-3 font-display text-[18px] font-semibold tabular-nums text-neutral-900">
        {formatCurrency(balance)}
      </p>
    </button>
  )
}
