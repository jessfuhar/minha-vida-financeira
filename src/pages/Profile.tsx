import { useRef, useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardTitle } from '../components/ui/Card'
import { TextInput } from '../components/ui/FormField'
import { useToast } from '../components/ui/Toast'
import { useData } from '../context/DataContext'
import { Camera, Palette, Bell, Eye, Pencil, Check, X, Trash2 } from 'lucide-react'

const preferenceRows = [
  { icon: Palette, label: 'Tema visual', value: 'Rosa suave (padrão)' },
  { icon: Bell, label: 'Notificações', value: 'Ativadas' },
  { icon: Eye, label: 'Mostrar saldo na tela inicial', value: 'Sim' },
]

const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024

export default function Profile() {
  const { profile, updateProfile } = useData()
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(profile.name)

  const startEditName = () => {
    setNameDraft(profile.name)
    setEditingName(true)
  }

  const saveName = () => {
    const trimmed = nameDraft.trim()
    if (!trimmed) {
      setEditingName(false)
      return
    }
    updateProfile({ name: trimmed })
    setEditingName(false)
    toast.show('Nome atualizado.')
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.show('Escolha um arquivo de imagem.', 'error')
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.show('Imagem muito grande. Escolha um arquivo de até 1,5MB.', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      updateProfile({ photoDataUrl: String(reader.result) })
      toast.show('Foto atualizada.')
    }
    reader.readAsDataURL(file)
  }

  const removePhoto = () => {
    updateProfile({ photoDataUrl: undefined })
    toast.show('Foto removida.', 'info')
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Perfil" subtitle="Suas informações e preferências dentro do sistema." />

      <Card className="flex flex-wrap items-center gap-5">
        <div className="relative">
          {profile.photoDataUrl ? (
            <img src={profile.photoDataUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-rose-300 to-rose-600 font-display text-[26px] font-semibold text-white">
              {profile.name.charAt(0).toUpperCase()}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-rose-700 text-white shadow-sm hover:bg-rose-800"
            aria-label="Alterar foto"
          >
            <Camera size={13} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        </div>

        <div className="flex-1">
          {editingName ? (
            <div className="flex items-center gap-2">
              <TextInput
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveName()
                  if (e.key === 'Escape') setEditingName(false)
                }}
                autoFocus
                className="max-w-[220px]"
              />
              <button
                onClick={saveName}
                className="rounded-lg p-1.5 text-[var(--color-status-good)] hover:bg-[var(--color-status-good-bg)]"
                aria-label="Salvar nome"
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => setEditingName(false)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100"
                aria-label="Cancelar"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button type="button" onClick={startEditName} className="group flex items-center gap-2">
              <p className="font-display text-[19px] font-semibold text-neutral-900">{profile.name}</p>
              <Pencil size={14} className="text-neutral-300 opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
          )}
          {profile.photoDataUrl && (
            <button
              type="button"
              onClick={removePhoto}
              className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-neutral-400 hover:text-[var(--color-status-critical)]"
            >
              <Trash2 size={12} /> Remover foto
            </button>
          )}
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
          O login e a autenticação ainda não fazem parte desta fase. Seu nome e sua foto ficam salvos apenas neste
          navegador.
        </p>
      </Card>
    </div>
  )
}
