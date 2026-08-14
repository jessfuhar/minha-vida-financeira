import type { BankAccount } from './types'

// Dados fictícios — nenhuma integração bancária real nesta fase.
export const accounts: BankAccount[] = [
  {
    id: 'bb',
    bank: 'Banco do Brasil',
    type: 'corrente',
    balance: 8500,
    colorFrom: '#F5D97A',
    colorTo: '#D9A441',
    logoInitial: 'BB',
  },
  {
    id: 'nubank',
    bank: 'Nubank',
    type: 'digital',
    balance: 4250,
    colorFrom: '#8B5CF6',
    colorTo: '#6021C4',
    logoInitial: 'Nu',
  },
  {
    id: 'itau',
    bank: 'Itaú',
    type: 'corrente',
    balance: 3700,
    colorFrom: '#FF9A6C',
    colorTo: '#E8632B',
    logoInitial: 'It',
  },
  {
    id: 'caixa',
    bank: 'Caixa',
    type: 'poupanca',
    balance: 2000,
    colorFrom: '#6FB2E8',
    colorTo: '#2E6CAE',
    logoInitial: 'CX',
  },
]

export const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0)
