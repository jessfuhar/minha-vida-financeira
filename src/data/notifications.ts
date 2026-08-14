import type { AppNotification } from './types'

export const notifications: AppNotification[] = [
  {
    id: 'n1',
    type: 'classificacao',
    title: 'Lançamentos aguardando classificação',
    description: '5 lançamentos novos ainda não têm categoria definida.',
    date: '2026-08-13T09:12:00',
    read: false,
  },
  {
    id: 'n2',
    type: 'vencimento',
    title: 'Conta próxima do vencimento',
    description: 'Internet vence em 2 dias — R$ 100,00.',
    date: '2026-08-13T08:00:00',
    read: false,
  },
  {
    id: 'n3',
    type: 'vencida',
    title: 'Conta vencida',
    description: 'Academia — venceu em 10/08, ainda não paga.',
    date: '2026-08-12T18:45:00',
    read: false,
  },
  {
    id: 'n4',
    type: 'saldo',
    title: 'Alteração importante no saldo',
    description: 'Entrada de R$ 6.500,00 identificada na conta Banco do Brasil.',
    date: '2026-08-09T07:30:00',
    read: true,
  },
  {
    id: 'n5',
    type: 'cofrinho',
    title: 'Meta do cofrinho atualizada',
    description: 'Você já guardou 46% da meta "Viagem".',
    date: '2026-08-07T20:10:00',
    read: true,
  },
]
