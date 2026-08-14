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
      className="group flex min-w-[220px] flex-1 flex-col justify-between rounded-2xl border border-[var(--border-hairline)] bg-white p-5 text-left shadow-[0_1px_2px_rgba(42,34,34,0.04)] transition-shadow hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white"
          style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
        >
          {accountInitials(account.bank)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-neutral-800">
            {account.nickname || account.bank}
          </p>
          <p className="truncate text-[12px] text-neutral-500">
            {account.nickname ? account.bank + ' · ' : ''}
            {accountTypeLabel[account.type]}
          </p>
        </div>
        <Pencil size={14} className="shrink-0 text-neutral-300 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      <p className="mt-5 font-display text-[19px] font-semibold tabular-nums text-neutral-900">
        {formatCurrency(balance)}
      </p>
    </button>
  )
}
