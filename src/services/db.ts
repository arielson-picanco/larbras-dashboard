// ============================================================
// MÓDULO 2 — Serviço de Persistência (IndexedDB)
// Salva os dados importados entre sessões, eliminando a
// necessidade de reimportar o arquivo a cada visita.
// ============================================================

import type { SaleRow } from '@/types'

const DB_NAME    = 'larbras-db'
const DB_VERSION = 1
const STORE_NAME = 'sales'

// ── Open DB ───────────────────────────────────────────────────────────────────
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db    = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
      }
    }

    req.onsuccess  = () => resolve(req.result)
    req.onerror    = () => reject(req.error)
  })
}

// ── Save rows ─────────────────────────────────────────────────────────────────
export async function saveRows(rows: SaleRow[]): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    // Clear previous data first
    store.clear()

    // IndexedDB cannot store class instances — serialize dates to ISO strings
    const serializable = rows.map((r) => ({
      ...r,
      _date: r._date ? r._date.toISOString() : null,
      _raw:  JSON.stringify(r._raw),
    }))

    serializable.forEach((row) => store.add(row))

    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror    = () => { db.close(); reject(tx.error) }
  })
}

// ── Load rows ─────────────────────────────────────────────────────────────────
export async function loadRows(): Promise<SaleRow[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req   = store.getAll()

    req.onsuccess = () => {
      db.close()
      // Deserialize dates and raw objects
      const rows: SaleRow[] = (req.result ?? []).map((row: SaleRow & { _raw: string }) => ({
        ...row,
        _date: row._date ? new Date(row._date as unknown as string) : null,
        _raw:  typeof row._raw === 'string' ? JSON.parse(row._raw) : row._raw,
      }))
      resolve(rows)
    }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

// ── Clear stored data ─────────────────────────────────────────────────────────
export async function clearRows(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req   = store.clear()
    req.onsuccess = () => { db.close(); resolve() }
    req.onerror   = () => { db.close(); reject(req.error) }
  })
}

// ── Count stored rows (cheap check on app start) ──────────────────────────────
export async function countRows(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req   = store.count()
    req.onsuccess = () => { db.close(); resolve(req.result) }
    req.onerror   = () => { db.close(); reject(req.error) }
  })
}
