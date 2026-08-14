import type { Bill } from './types'

export const bills: Bill[] = [
  { id: 'b1', name: 'Internet', amount: 100, dueDate: '2026-08-15', category: 'Internet', costCenter: 'Casa', status: 'pendente' },
  { id: 'b2', name: 'Aluguel', amount: 1450, dueDate: '2026-08-15', category: 'Moradia', costCenter: 'Casa', status: 'pendente' },
  { id: 'b3', name: 'Cartão de crédito Nubank', amount: 980, dueDate: '2026-08-18', category: 'Cartão', costCenter: 'Pessoal', status: 'pendente' },
  { id: 'b4', name: 'Academia', amount: 130, dueDate: '2026-08-10', category: 'Academia', costCenter: 'Fitness', status: 'vencida' },
  { id: 'b5', name: 'Seguro do carro', amount: 220, dueDate: '2026-08-22', category: 'Seguro', costCenter: 'Carro', status: 'pendente' },
  { id: 'b6', name: 'Energia elétrica', amount: 180, dueDate: '2026-08-05', category: 'Energia', costCenter: 'Casa', status: 'paga' },
  { id: 'b7', name: 'Streaming — Netflix', amount: 44.9, dueDate: '2026-08-05', category: 'Streaming', costCenter: 'Lazer', status: 'paga' },
  { id: 'b8', name: 'IPTU (parcela)', amount: 210, dueDate: '2026-08-28', category: 'Impostos', costCenter: 'Casa', status: 'pendente' },
  { id: 'b9', name: 'Plano de saúde', amount: 390, dueDate: '2026-08-02', category: 'Saúde', costCenter: 'Pessoal', status: 'paga' },
  { id: 'b10', name: 'Financiamento do carro', amount: 890, dueDate: '2026-08-20', category: 'Financiamento', costCenter: 'Carro', status: 'pendente' },
]
