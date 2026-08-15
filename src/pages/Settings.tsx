import { useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { ClassificationRulesModal } from '../components/settings/ClassificationRulesModal'
import { DashboardPersonalizeModal } from '../components/dashboard/DashboardPersonalizeModal'
import { useData } from '../context/DataContext'
import { brand } from '../config/brand'
import {
  Tags,
  Layers,
  Zap,
  Landmark,
  LayoutDashboard,
  SlidersHorizontal,
  DatabaseBackup,
  FileDown,
  ChevronRight,
} from 'lucide-react'

const sections = [
  {
    title: 'Dados financeiros',
    items: [
      { key: 'categorias', icon: Tags, label: 'Categorias', description: 'Crie e edite as categorias de gasto e receita.' },
      { key: 'centros', icon: Layers, label: 'Centros de custo', description: 'Organize as grandes áreas da sua vida financeira.' },
      { key: 'regras', icon: Zap, label: 'Regras automáticas', description: 'Classifique lançamentos futuros automaticamente.' },
      { key: 'contas', icon: Landmark, label: 'Contas bancárias', description: 'Gerencie as contas conectadas ao sistema.' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { key: 'painel', icon: LayoutDashboard, label: 'Personalizar painel', description: 'Mostre, oculte e reordene as seções do painel inicial.' },
      { key: 'preferencias', icon: SlidersHorizontal, label: 'Preferências', description: 'Aparência, moeda e formato de datas.' },
      { key: 'backup', icon: DatabaseBackup, label: 'Backup', description: 'Cópias de segurança dos seus dados.' },
      { key: 'exportacao', icon: FileDown, label: 'Exportação', description: 'Exporte seus dados em planilha ou PDF.' },
    ],
  },
]

export default function Settings() {
  const {
    classificationRules,
    costCenters,
    updateClassificationRule,
    deleteClassificationRule,
    dashboardLayout,
    updateDashboardLayout,
    toggleFavoriteCostCenter,
    resetDashboardLayout,
  } = useData()
  const [rulesOpen, setRulesOpen] = useState(false)
  const [personalizeOpen, setPersonalizeOpen] = useState(false)

  const handlers: Record<string, () => void> = {
    regras: () => setRulesOpen(true),
    painel: () => setPersonalizeOpen(true),
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" subtitle={`Estrutura preparada para as próximas fases de ${brand.appName}.`} />

      {sections.map((section) => (
        <Card key={section.title} padded={false}>
          <div className="p-4 pb-2 lg:px-5">
            <h2 className="font-display text-[15px] font-semibold text-neutral-900">{section.title}</h2>
          </div>
          <ul className="divide-y divide-[var(--border-hairline)]">
            {section.items.map((item) => (
              <li key={item.label}>
                <button
                  type="button"
                  onClick={handlers[item.key]}
                  className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-rose-50/50 lg:px-5"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-700">
                    <item.icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-neutral-800">{item.label}</p>
                    <p className="mt-0.5 text-[12.5px] text-neutral-500">{item.description}</p>
                  </div>
                  {item.key === 'regras' && classificationRules.length > 0 && (
                    <span className="shrink-0 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-700">
                      {classificationRules.length}
                    </span>
                  )}
                  {item.key !== 'regras' && item.key !== 'painel' && (
                    <span className="shrink-0 rounded-full bg-[var(--color-neutral-100)] px-2.5 py-1 text-[11px] font-medium text-neutral-500">
                      Fase 2
                    </span>
                  )}
                  <ChevronRight size={16} className="shrink-0 text-neutral-300" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      <ClassificationRulesModal
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        rules={classificationRules}
        costCenters={costCenters}
        onUpdate={updateClassificationRule}
        onDelete={deleteClassificationRule}
      />

      <DashboardPersonalizeModal
        open={personalizeOpen}
        onClose={() => setPersonalizeOpen(false)}
        layout={dashboardLayout}
        costCenters={costCenters}
        onUpdateLayout={updateDashboardLayout}
        onToggleFavorite={toggleFavoriteCostCenter}
        onReset={resetDashboardLayout}
      />
    </div>
  )
}
