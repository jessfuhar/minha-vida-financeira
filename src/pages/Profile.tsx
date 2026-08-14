import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardTitle } from '../components/ui/Card'
import { brand } from '../config/brand'
import { Camera, Palette, Bell, Eye } from 'lucide-react'

const preferenceRows = [
  { icon: Palette, label: 'Tema visual', value: 'Rosa suave (padrão)' },
  { icon: Bell, label: 'Notificações', value: 'Ativadas' },
  { icon: Eye, label: 'Mostrar saldo na tela inicial', value: 'Sim' },
]

export default function Profile() {
  return (
    <div className="space-y-6">
      <PageHeader title="Perfil" subtitle="Suas informações e preferências dentro do sistema." />

      <Card className="flex flex-wrap items-center gap-5">
        <div className="relative">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-rose-300 to-rose-600 font-display text-[26px] font-semibold text-white">
            {brand.userName.charAt(0)}
          </div>
          <button
            type="button"
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-rose-700 text-white shadow-sm"
            aria-label="Alterar foto"
          >
            <Camera size={13} />
          </button>
        </div>
        <div>
          <p className="font-display text-[19px] font-semibold text-neutral-900">{brand.userName}</p>
          <p className="text-[13.5px] text-neutral-500">Membro desde agosto de 2026</p>
        </div>
      </Card>

      <Card>
        <CardTitle>Preferências visuais</CardTitle>
        <ul className="divide-y divide-[var(--border-hairline)]">
          {preferenceRows.map((row) => (
            <li key={row.label} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <row.icon size={17} className="text-rose-600" />
              <span className="flex-1 text-[13.5px] text-neutral-700">{row.label}</span>
              <span className="text-[13px] font-medium text-neutral-500">{row.value}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="bg-rose-50/60">
        <p className="text-[13.5px] leading-relaxed text-neutral-700">
          O login e a autenticação ainda não fazem parte desta fase — este perfil é apenas visual, para validar como
          as preferências serão exibidas.
        </p>
      </Card>
    </div>
  )
}
