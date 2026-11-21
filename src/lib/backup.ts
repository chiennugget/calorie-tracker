// Browser-only helpers for downloading backups/exports (DOM code, not part of the portable core).
import { today } from './date'
import { serialiseData } from './storage'
import type { AppData } from './types'
import { store } from './useStore'

export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Downloads a full JSON backup and records when it happened (drives the backup reminder). */
export function downloadBackup(data: AppData) {
  const stamped = { ...data, meta: { ...data.meta, lastBackupAt: Date.now() } }
  downloadFile(`calorie-tracker-backup-${today()}.json`, serialiseData(stamped), 'application/json')
  store.updateMeta({ lastBackupAt: stamped.meta.lastBackupAt })
}

/**
 * "Export backup": on phones, opens the share sheet so the file can go straight
 * to iCloud Drive, Files, Google Drive or a chat with yourself. Elsewhere (or if
 * sharing isn't supported) it downloads the file. Returns false if cancelled.
 */
export async function shareBackup(data: AppData): Promise<boolean> {
  const name = `calorie-tracker-backup-${today()}.json`
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  if (touch && typeof navigator.canShare === 'function' && typeof File === 'function') {
    const stamped = { ...data, meta: { ...data.meta, lastBackupAt: Date.now() } }
    const file = new File([serialiseData(stamped)], name, { type: 'application/json' })
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Calorie Tracker backup' })
        store.updateMeta({ lastBackupAt: stamped.meta.lastBackupAt })
        return true
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return false
        // Some browsers refuse files they claim to support; fall back to a download.
      }
    }
  }
  downloadBackup(data)
  return true
}

/** Whether the browser has promised not to evict our storage. undefined = can't tell. */
export async function storagePersisted(): Promise<boolean | undefined> {
  try {
    return (await navigator.storage?.persisted?.()) ?? undefined
  } catch {
    return undefined
  }
}
