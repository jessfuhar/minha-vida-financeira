import { useEffect, useState } from 'react'
import { ArrowRight, Check, X } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { formatCurrency, formatDate } from '../../lib/format'
import type { Account } from '../../db/models'
import type { TransferCandidatePair } from '../../lib/transferDetection'

interface TransferSuggestionsModalProps {
  open: boolean
  onClose: () => void
  candidates: TransferCandidatePair[]
  accounts: Account[]
  onConfirmPair: (idA: string, idB: string) => Promise<{ ok: boolean; reason?: string }>
}

export function TransferSuggestionsModal({ open, onClose, candidates, accounts, onConfirmPair }: TransferSuggestionsModalProps) {
  const [resolved, setResolved] = useState<Record<number, 'confirmed' | 'ignored'>>({})
  const [error, setError] = useState('')

  // Cada nova rodada de sugestões (novo array de `candidates`, tipicamente ao reabrir o modal) começa
  // sem nada resolvido — senão um índice antes "ignorado" ficaria preso nesse estado para sempre,
  // mesmo quando os candidatos mudam, impedindo a usuária de revisar/confirmar aquele par depois.
  useEffect(() => {
    if (!open) return
    setResolved({})
    setError('')
  }, [open, candidates])

  const accountName = (id: string) => {
    const acc = accounts.find((a) => a.id === id)
    return acc ? acc.nickname || acc.bank : '—'
  }

  const handleConfirm = async (index: number) => {
    const c = candidates[index]
    const outTx = c.a.direction === 'saida' ? c.a : c.b
    const inTx = c.a.direction === 'entrada' ? c.a : c.b
    const result = await onConfirmPair(outTx.id, inTx.id)
    if (!result.ok) {
      setError(result.reason || 'Não foi possível vincular essa dupla.')
      return
    }
    setError('')
    setResolved((prev) => ({ ...prev, [index]: 'confirmed' }))
  }

  const handleIgnore = (index: number) => {
    setResolved((prev) => ({ ...prev, [index]: 'ignored' }))
  }

  const pending = candidates.filter((_, i) => !resolved[i]).length

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Possíveis transferências entre suas contas"
      subtitle={
        candidates.length === 0
          ? 'Nenhum par provável encontrado nesta seleção.'
          : `${pending} de ${candidates.length} ainda aguardando revisão — nada é vinculado automaticamente.`
      }
      width="lg"
      footer={
        <Button size="sm" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      {error && (
        <div className="mb-3 rounded-xl bg-[var(--color-status-critical-bg)] px-3.5 py-2.5 text-[12.5px]" style={{ color: 'var(--color-status-critical)' }}>
          {error}
        </div>
      )}

      {candidates.length === 0 ? (
        <p className="py-8 text-center text-[13.5px] text-neutral-500">
          Nenhuma combinação de entrada/saída com valores e datas compatíveis foi encontrada entre contas diferentes.
        </p>
      ) : (
        <ul className="space-y-3">
          {candidates.map((c, i) => {
            const outTx = c.a.direction === 'saida' ? c.a : c.b
            const inTx = c.a.direction === 'entrada' ? c.a : c.b
            const status = resolved[i]
            return (
              <li
                key={outTx.id + inTx.id}
                className={[
                  'rounded-xl border px-4 py-3',
                  status === 'confirmed'
                    ? 'border-[var(--color-status-good)] bg-[var(--color-status-good-bg)]'
                    : status === 'ignored'
                      ? 'border-[var(--border-hairline)] bg-[var(--color-neutral-100)] opacity-60'
                      : 'border-[var(--border-hairline)] bg-white',
                ].join(' ')}
              >
                <div className="flex flex-wrap items-center gap-2 text-[13.5px]">
                  <span className="font-medium text-neutral-800">{accountName(outTx.accountId)}</span>
                  <ArrowRight size={14} className="text-neutral-400" />
                  <span className="font-medium text-neutral-800">{accountName(inTx.accountId)}</span>
                  <span className="ml-auto font-semibold tabular-nums text-neutral-900">{formatCurrency(outTx.amount)}</span>
                </div>
                <p className="mt-1 text-[12px] text-neutral-500">
                  {formatDate(outTx.date)}
                  {outTx.date !== inTx.date ? ` → ${formatDate(inTx.date)}` : ''} · {outTx.description}
                  {outTx.counterparty ? ` (${outTx.counterparty})` : ''} · {inTx.description}
                  {inTx.counterparty ? ` (${inTx.counterparty})` : ''}
                </p>

                {!status && (
                  <div className="mt-2.5 flex gap-2">
                    <Button size="sm" onClick={() => handleConfirm(i)}>
                      <Check size={13} /> Confirmar transferência
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleIgnore(i)}>
                      <X size={13} /> Ignorar
                    </Button>
                  </div>
                )}
                {status === 'confirmed' && (
                  <p className="mt-2 text-[12px] font-medium" style={{ color: 'var(--color-status-good)' }}>
                    Vinculada como transferência.
                  </p>
                )}
                {status === 'ignored' && <p className="mt-2 text-[12px] text-neutral-400">Ignorada.</p>}
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
