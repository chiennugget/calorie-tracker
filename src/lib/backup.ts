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
