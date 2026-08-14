import { transactionKindMeta } from '../../lib/transactionKind'
import type { TransactionKind } from '../../data/types'

export function TransactionTypeBadge({ kind }: { kind: TransactionKind }) {
  const meta = transactionKindMeta[kind]
  const Icon = meta.icon
  return (
    <span
      className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium"
      style={{ background: `color-mix(in srgb, ${meta.colorVar} 12%, white)`, color: meta.colorVar }}
    >
      <Icon size={13} />
      {meta.label}
    </span>
  )
}
