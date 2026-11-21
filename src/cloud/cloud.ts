// Automatic cloud backup (web). Watches the store, uploads a snapshot of the
// whole diary a few seconds after changes settle, and exposes sign-in,
// snapshot listing and restore to the UI. The rules about *when* uploading is
// safe live in lib/cloudBackup.ts.
import { useSyncExternalStore } from 'react'
import {
  backupSignature,
  dataSize,
  retryDelayMs,
  shouldAutoUpload,
  snapshotsToPrune,
  type SnapshotInfo,
  type UploadBlock,
} from '../lib/cloudBackup'
import { formatAgo, today } from '../lib/date'
import { parseData } from '../lib/storage'
import type { AppData, DateKey } from '../lib/types'
import { store } from '../lib/useStore'
import { cloudConfigured } from './config'

export type CloudStatus = 'off' | 'checking' | 'idle' | 'pending' | 'uploading' | 'blocked' | 'error'

export interface CloudState {
  configured: boolean
  /** Signed-in email, or null when signed out. */
  email: string | null
  /** True until we know whether there's a saved session. */
  loading: boolean
  status: CloudStatus
  block?: UploadBlock
  error?: string
  /** ms epoch of the newest snapshot in the cloud (uploaded from any device). */
  lastUploadAt?: number
}

/** Wait this long after the last change before uploading. Tests shorten it. */
const debounceMs = () => (globalThis as { __cloudDebounceMs?: number }).__cloudDebounceMs ?? 20_000

let state: CloudState = { configured: cloudConfigured, email: null, loading: cloudConfigured, status: 'off' }
const listeners = new Set<() => void>()
function set(patch: Partial<CloudState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function useCloud(): CloudState {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => state,
  )
}

type Sb = typeof import('./supabase')
let sbPromise: Promise<Sb> | null = null
const sb = () => (sbPromise ??= import('./supabase'))

let timer: ReturnType<typeof setTimeout> | undefined
let lastSig: string | null = null
/** dataSize of the newest cloud snapshot; undefined = none. Known once `remoteReady` resolves. */
let remoteSize: number | undefined
let remoteReady: Promise<void> | null = null
let failures = 0
let pruned = false
let started = false

/** Reads what's in the cloud so the wipe safeguard can compare against it. Shared by concurrent callers. */
function loadRemote(): Promise<void> {
  remoteReady ??= (async () => {
    const list = await (await sb()).target.list()
    remoteSize = list[0] ? list[0].entryCount + list[0].weighInCount : undefined
    set({ lastUploadAt: list.length ? Math.max(...list.map((s) => s.updatedAt)) : undefined })
  })().catch((err) => {
    remoteReady = null // try again next time
    throw err
  })
  return remoteReady
}

function schedule(delay = debounceMs()) {
  if (!state.email) return
  clearTimeout(timer)
  if (state.status !== 'blocked' && state.status !== 'error' && backupSignature(store.getState()) !== lastSig) set({ status: 'pending' })
  timer = setTimeout(() => void upload(), delay)
}

/** Uploads today's snapshot, one at a time. `force` skips the wipe safeguard (the user confirmed). */
let queue: Promise<boolean> = Promise.resolve(true)
function upload(force = false): Promise<boolean> {
  queue = queue.then(() => doUpload(force))
  return queue
}

async function doUpload(force: boolean): Promise<boolean> {
  clearTimeout(timer)
  if (!state.email) return false
  const data = store.getState()
  const sig = backupSignature(data)
  if (!force && sig === lastSig) {
    if (state.status === 'pending') set({ status: 'idle' })
    return true
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    set({ status: 'pending' }) // retried by the 'online' listener
    return false
  }
  set({ status: 'uploading', error: undefined })
  try {
    await loadRemote()
    if (!force) {
      const decision = shouldAutoUpload(data, remoteSize)
      if (!decision.ok) {
        set({ status: 'blocked', block: decision.reason })
        return false
      }
    }
    const { target } = await sb()
    await target.upsert(today(), data)
    lastSig = sig
    remoteSize = dataSize(data)
    failures = 0
    const now = Date.now()
    set({ status: 'idle', block: undefined, lastUploadAt: now })
    // Counts as a backup for the reminder banner. Meta isn't part of the signature, so this doesn't loop.
    store.updateMeta({ lastBackupAt: now })
    if (!pruned) {
      pruned = true
      const old = snapshotsToPrune((await target.list()).map((s) => s.day), today())
      await target.remove(old).catch(() => {})
    }
    return true
  } catch (err) {
    failures++
    set({ status: 'error', error: friendlyError(err) })
    timer = setTimeout(() => void upload(), retryDelayMs(failures))
    return false
  }
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/fetch|network|load failed/i.test(msg)) {
    return "Couldn't reach the backup server. If the app hasn't been used for a week, the free Supabase project may be paused: restore it in the Supabase dashboard."
  }
  return msg
}

/** Starts watching for changes. Call once at app start; does nothing if cloud backup isn't configured. */
export function startCloud() {
  if (!cloudConfigured || started) return
  started = true
  void (async () => {
    try {
      const api = await sb()
      const onEmail = (email: string | null) => {
        if (email === state.email && !state.loading) return
        set({ email, loading: false, status: email ? 'checking' : 'off', error: undefined, block: undefined })
        if (email) {
          remoteReady = null
          lastSig = null
          pruned = false
          loadRemote().then(
            () => {
              set({ status: 'idle' })
              schedule(1000)
            },
            (err) => set({ status: 'error', error: friendlyError(err) }),
          )
        } else clearTimeout(timer)
      }
      onEmail(await api.currentEmail())
      api.onAuthChange(onEmail)
    } catch (err) {
      set({ loading: false, status: 'error', error: friendlyError(err) })
    }
  })()
  store.subscribe(() => schedule())
  window.addEventListener('online', () => schedule(1000))
  // Phones often kill a backgrounded web app, so upload right away when it's hidden.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && state.status === 'pending') void upload()
  })
}

// ---------- Actions for the UI ----------

/** One-line status for the Settings menu and the screen itself. */
export function cloudSummary(c: CloudState): string {
  if (!c.configured) return 'Not available'
  if (c.loading) return 'Checking…'
  if (!c.email) return 'Off'
  if (c.status === 'blocked' && c.block !== 'not-onboarded') return 'Paused: needs your attention'
  if (c.status === 'error') return "Couldn't back up"
  if (c.status === 'checking') return 'Checking your cloud backups…'
  if (c.status === 'uploading') return 'Backing up…'
  if (c.status === 'pending') return 'Changes waiting to back up'
  return c.lastUploadAt ? `Backed up ${formatAgo(c.lastUploadAt)}` : 'On'
}


export async function sendCode(email: string) {
  await (await sb()).sendCode(email.trim())
}

export async function verifyCode(email: string, code: string) {
  await (await sb()).verifyCode(email.trim(), code.replace(/\s/g, ''))
}

export async function signOut() {
  clearTimeout(timer)
  await (await sb()).signOut()
}

/** "Back up now". `force` also overrides the wipe safeguard after the user confirms. */
export function backupNow(force = false): Promise<boolean> {
  return upload(force)
}

export async function listSnapshots(): Promise<SnapshotInfo[]> {
  return (await sb()).target.list()
}

/** Downloads and validates a snapshot, without applying it. */
export async function fetchSnapshot(day: DateKey): Promise<AppData> {
  return parseData(await (await sb()).target.get(day))
}

/** Replaces local data with a snapshot. Returns the previous data so the caller can offer Undo. */
export function applySnapshot(data: AppData): AppData {
  const previous = store.getState()
  store.replaceAll(data)
  // What's on the device now matches the cloud, so don't re-upload it.
  lastSig = backupSignature(store.getState())
  remoteSize = dataSize(data)
  set({ status: 'idle', block: undefined, error: undefined })
  return previous
}
