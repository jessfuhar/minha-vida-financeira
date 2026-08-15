import { openDB, type IDBPDatabase } from 'idb'

/**
 * Camada de persistência local.
 *
 * Tenta usar IndexedDB (via `idb`). Se a API não estiver disponível — por
 * exemplo dentro de um iframe de pré-visualização com origem restrita —
 * cai automaticamente para um armazenamento em memória, para que o app
 * nunca quebre. Nesse modo de fallback os dados não sobrevivem a um
 * recarregamento; `isPersistent()` informa esse estado para a UI poder
 * avisar a usuária, se necessário.
 */

const DB_NAME = 'minha-vida-financeira'
const DB_VERSION = 3

export const STORES = [
  'accounts',
  'transactions',
  'costCenters',
  'bills',
  'goals',
  'goalContributions',
  'plannedItems',
  'classificationRules',
] as const
export type StoreName = (typeof STORES)[number]

interface WithId {
  id: string
}

let dbPromise: Promise<IDBPDatabase> | null = null
let persistent = true

// Fallback em memória — usado somente se IndexedDB não puder ser aberto.
const memoryStores: Record<StoreName, Map<string, WithId>> = {
  accounts: new Map(),
  transactions: new Map(),
  costCenters: new Map(),
  bills: new Map(),
  goals: new Map(),
  goalContributions: new Map(),
  plannedItems: new Map(),
  classificationRules: new Map(),
}

function hasIndexedDb(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

async function getDb(): Promise<IDBPDatabase | null> {
  if (!hasIndexedDb()) {
    persistent = false
    return null
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const store of STORES) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: 'id' })
          }
        }
      },
    }).catch((err) => {
      console.warn('[storage] IndexedDB indisponível, usando memória local nesta sessão.', err)
      persistent = false
      return null as unknown as IDBPDatabase
    })
  }
  return dbPromise
}

export function isPersistent(): boolean {
  return persistent
}

export async function getAll<T extends WithId>(store: StoreName): Promise<T[]> {
  const db = await getDb()
  if (!db) return Array.from(memoryStores[store].values()) as T[]
  try {
    return (await db.getAll(store)) as T[]
  } catch (err) {
    console.warn(`[storage] falha ao ler ${store}, usando memória.`, err)
    persistent = false
    return Array.from(memoryStores[store].values()) as T[]
  }
}

export async function putItem<T extends WithId>(store: StoreName, item: T): Promise<T> {
  const db = await getDb()
  if (!db) {
    memoryStores[store].set(item.id, item)
    return item
  }
  try {
    await db.put(store, item)
  } catch (err) {
    console.warn(`[storage] falha ao gravar em ${store}, usando memória.`, err)
    persistent = false
    memoryStores[store].set(item.id, item)
  }
  return item
}

export async function deleteItem(store: StoreName, id: string): Promise<void> {
  const db = await getDb()
  if (!db) {
    memoryStores[store].delete(id)
    return
  }
  try {
    await db.delete(store, id)
  } catch (err) {
    console.warn(`[storage] falha ao excluir em ${store}, usando memória.`, err)
    persistent = false
    memoryStores[store].delete(id)
  }
}

// --- Perfil: registro único e pequeno, guardado em localStorage. ---

const PROFILE_KEY = 'mvf:profile'

export function loadProfile<T>(fallback: T): T {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return fallback
    return { ...fallback, ...JSON.parse(raw) }
  } catch {
    return fallback
  }
}

export function saveProfile<T>(profile: T): boolean {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
    return true
  } catch (err) {
    console.warn('[storage] falha ao salvar perfil em localStorage.', err)
    return false
  }
}

// --- Limites de gasto: registro único e pequeno, guardado em localStorage. ---

const SPENDING_LIMITS_KEY = 'mvf:spendingLimits'

export function loadSpendingLimits<T>(fallback: T): T {
  try {
    const raw = localStorage.getItem(SPENDING_LIMITS_KEY)
    if (!raw) return fallback
    return { ...fallback, ...JSON.parse(raw) }
  } catch {
    return fallback
  }
}

export function saveSpendingLimits<T>(limits: T): boolean {
  try {
    localStorage.setItem(SPENDING_LIMITS_KEY, JSON.stringify(limits))
    return true
  } catch (err) {
    console.warn('[storage] falha ao salvar limites de gasto em localStorage.', err)
    return false
  }
}

// --- Personalização do painel: registro único e pequeno, guardado em localStorage. ---

const DASHBOARD_LAYOUT_KEY = 'mvf:dashboardLayout'

export function loadDashboardLayout<T>(fallback: T): T {
  try {
    const raw = localStorage.getItem(DASHBOARD_LAYOUT_KEY)
    if (!raw) return fallback
    return { ...fallback, ...JSON.parse(raw) }
  } catch {
    return fallback
  }
}

export function saveDashboardLayout<T>(layout: T): boolean {
  try {
    localStorage.setItem(DASHBOARD_LAYOUT_KEY, JSON.stringify(layout))
    return true
  } catch (err) {
    console.warn('[storage] falha ao salvar personalização do painel em localStorage.', err)
    return false
  }
}

export function generateId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  }
}
