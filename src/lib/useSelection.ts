import { useCallback, useMemo, useState } from 'react'

/**
 * Hook genérico de seleção múltipla, reutilizado em qualquer tabela que precise de checkboxes +
 * "selecionar todos". "Selecionar todos" sempre respeita a lista de ids que a tela atual está
 * exibindo (já filtrada) — nunca seleciona silenciosamente itens fora do filtro ativo.
 */
export function useSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  /** Marca/desmarca todos os ids informados (tipicamente: os da lista já filtrada em tela). */
  const toggleAll = useCallback((ids: string[], checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) ids.forEach((id) => next.add(id))
      else ids.forEach((id) => next.delete(id))
      return next
    })
  }, [])

  const clear = useCallback(() => setSelected(new Set()), [])

  const isAllSelected = useCallback((ids: string[]) => ids.length > 0 && ids.every((id) => selected.has(id)), [selected])
  const isSomeSelected = useCallback((ids: string[]) => ids.some((id) => selected.has(id)), [selected])

  const selectedIds = useMemo(() => Array.from(selected), [selected])

  return {
    selected,
    selectedIds,
    selectedCount: selected.size,
    toggle,
    toggleAll,
    clear,
    isAllSelected,
    isSomeSelected,
  }
}
