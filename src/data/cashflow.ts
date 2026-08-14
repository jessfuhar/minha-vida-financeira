// Série fictícia de fluxo de caixa (entradas, saídas e evolução do saldo).
export interface CashFlowPoint {
  label: string
  entradas: number
  saidas: number
  saldo: number
}

export const monthlyCashFlow: CashFlowPoint[] = [
  { label: 'Mar', entradas: 7200, saidas: 5100, saldo: 14200 },
  { label: 'Abr', entradas: 6800, saidas: 5600, saldo: 15400 },
  { label: 'Mai', entradas: 7900, saidas: 6200, saldo: 17100 },
  { label: 'Jun', entradas: 7100, saidas: 6700, saldo: 17500 },
  { label: 'Jul', entradas: 8200, saidas: 5900, saldo: 19800 },
  { label: 'Ago', entradas: 8500, saidas: 5320, saldo: 18450.75 },
]

export const dailyCashFlow: CashFlowPoint[] = [
  { label: '08/08', entradas: 240, saidas: 800, saldo: 17700 },
  { label: '09/08', entradas: 6500, saidas: 0, saldo: 24200 },
  { label: '10/08', entradas: 0, saidas: 320, saldo: 23880 },
  { label: '11/08', entradas: 0, saidas: 150, saldo: 23730 },
  { label: '12/08', entradas: 0, saidas: 180, saldo: 23550 },
  { label: '13/08', entradas: 500, saidas: 0, saldo: 18450.75 },
]

export const monthSummary = {
  entradas: 8500,
  saidas: 5320,
  resultado: 8500 - 5320,
}
