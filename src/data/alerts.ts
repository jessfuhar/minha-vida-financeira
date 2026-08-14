import type { AttentionAlert } from './types'

export const attentionAlerts: AttentionAlert[] = [
  {
    id: 'a1',
    level: 'atencao',
    title: '5 lançamentos aguardando classificação',
    description: 'Revise para manter seus relatórios em dia.',
  },
  {
    id: 'a2',
    level: 'urgente',
    title: 'Conta de luz vence amanhã',
    description: 'Copel — R$ 180,00',
  },
  {
    id: 'a3',
    level: 'atencao',
    title: '2 contas estão próximas do vencimento',
    description: 'Internet e Seguro do carro, nos próximos 7 dias.',
  },
  {
    id: 'a4',
    level: 'info',
    title: 'Diferença de R$ 50,00 no saldo',
    description: 'Entre o saldo calculado e o saldo informado da conta Itaú.',
  },
]
