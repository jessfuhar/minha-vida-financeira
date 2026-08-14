import type { SavingsGoal } from './types'

export const savingsGoals: SavingsGoal[] = [
  {
    id: 'g1',
    name: 'Viagem',
    emoji: '✈️',
    target: 5000,
    saved: 2300,
    color: 'var(--color-cat-rose)',
    monthlyContribution: 400,
    deadline: '2026-12-01',
  },
  {
    id: 'g2',
    name: 'Reserva de emergência',
    emoji: '🛡️',
    target: 10000,
    saved: 4500,
    color: 'var(--color-cat-teal)',
    monthlyContribution: 600,
  },
  {
    id: 'g3',
    name: 'Carro novo',
    emoji: '🚗',
    target: 8000,
    saved: 1500,
    color: 'var(--color-cat-amber)',
    monthlyContribution: 350,
    deadline: '2027-06-01',
  },
]
