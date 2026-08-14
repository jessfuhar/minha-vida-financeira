import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { brand } from '../config/brand'
import {
  Tags,
  Layers,
  Zap,
  Landmark,
  SlidersHorizontal,
  DatabaseBackup,
  FileDown,
  ChevronRight,
} from 'lucide-react'

const sections = [
  {
    title: 'Dados financeiros',
    items: [
      { icon: Tags, label: 'Categorias', description: 'Crie e edite as categorias de gasto e receita.' },
      { icon: Layers, label: 'Centros de custo', description: 'Organize as grandes áreas da sua vida financeira.' },
      { icon: Zap, label: 'Regras automáticas', description: 'Classifique lançamentos futuros automaticamente.' },
      { icon: Landmark, label: 'Contas bancárias', description: 'Gerencie as contas conectadas ao sistema.' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { icon: SlidersHorizontal, label: 'Preferências', description: 'Aparência, moeda e formato de datas.' },
      { icon: DatabaseBackup, label: 'Backup', description: 'Cópias de segurança dos seus dados.' },
      { icon: FileDown, label: 'Exportação', description: 'Exporte seus dados em planilha ou PDF.' },
    ],
  },
]

export default function Settings() {
  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" subtitle={`Estrutura preparada para as próximas fases de ${brand.appName}.`} />

      {sections.map((section) => (
        <Card key={section.title} padded={false}>
          <div className="p-5 pb-3 lg:px-6">
            <h2 className="font-display text-[15px] font-semibold text-neutral-900">{section.title}</h2>
          </div>
          <ul className="divide-y divide-[var(--border-hairline)]">
            {section.items.map((item) => (
              <li key={item.label}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3.5 px-5 py-4 text-left transition-colors hover:bg-rose-50/50 lg:px-6"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
                    <item.icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-neutral-800">{item.label}</p>
                    <p className="mt-0.5 text-[12.5px] text-neutral-500">{item.description}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--color-neutral-100)] px-2.5 py-1 text-[11px] font-medium text-neutral-500">
                    Fase 2
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-neutral-300" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  )
}
