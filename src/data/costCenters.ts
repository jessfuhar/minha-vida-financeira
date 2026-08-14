import type { CostCenter } from './types'

// Centro de custo = área geral da vida financeira.
// Categoria = tipo específico de gasto dentro de um centro de custo.
export const costCenters: CostCenter[] = [
  {
    id: 'casa',
    name: 'Casa',
    emoji: '🏠',
    categories: ['Energia', 'Internet', 'Alimentação', 'Eletrônicos', 'Limpeza', 'Água'],
    monthlySpend: 1680,
    color: 'var(--color-cat-rose)',
  },
  {
    id: 'pessoal',
    name: 'Pessoal',
    emoji: '💅',
    categories: ['Estética', 'Roupas', 'Sapatos', 'Cosméticos', 'Acessórios'],
    monthlySpend: 890,
    color: 'var(--color-cat-violet)',
  },
  {
    id: 'trabalho',
    name: 'Trabalho',
    emoji: '💼',
    categories: ['Receita', 'Equipamentos', 'Cursos', 'Transporte'],
    monthlySpend: 320,
    color: 'var(--color-cat-blue)',
  },
  {
    id: 'fitness',
    name: 'Fitness',
    emoji: '🧘‍♀️',
    categories: ['Academia', 'Suplementos', 'Roupas esportivas'],
    monthlySpend: 260,
    color: 'var(--color-cat-teal)',
  },
  {
    id: 'carro',
    name: 'Carro',
    emoji: '🚗',
    categories: ['Combustível', 'Manutenção', 'Estacionamento', 'Seguro'],
    monthlySpend: 540,
    color: 'var(--color-cat-amber)',
  },
  {
    id: 'viagens',
    name: 'Viagens',
    emoji: '✈️',
    categories: ['Passagens', 'Hospedagem', 'Passeios'],
    monthlySpend: 0,
    color: 'var(--color-cat-sage)',
  },
  {
    id: 'lazer',
    name: 'Lazer',
    emoji: '🎬',
    categories: ['Streaming', 'Cinema', 'Restaurantes', 'Eventos'],
    monthlySpend: 430,
    color: 'var(--color-rose-800)',
  },
]
