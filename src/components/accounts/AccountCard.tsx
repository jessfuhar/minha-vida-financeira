import type { BankAccount } from '../../data/types'
import { formatCurrency } from '../../lib/format'

const typeLabel: Record<BankAccount['type'], string> = {
  corrente: 'Conta corrente',
  poupanca: 'Poupança',
  digital: 'Conta digital',
}

export function AccountCard({ account }: { account: BankAccount }) {
  return (
    <div className="flex min-w-[220px] flex-1 flex-col justify-between rounded-2xl border border-[var(--border-hairline)] bg-white p-5 shadow-[0_1px_2px_rgba(42,34,34,0.04)]">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white"
          style={{ background: `linear-gradient(135deg, ${account.colorFrom}, ${account.colorTo})` }}
        >
          {account.logoInitial}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-neutral-800">{account.bank}</p>
          <p className="text-[12px] text-neutral-500">{typeLabel[account.type]}</p>
        </div>
      </div>
      <p className="mt-5 font-display text-[19px] font-semibold tabular-nums text-neutral-900">
        {formatCurrency(account.balance)}
      </p>
    </div>
  )
}
