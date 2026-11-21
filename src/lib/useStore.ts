import { useSyncExternalStore } from 'react'
import { Store } from './store'
import { STORAGE_KEY, localStorageAdapter } from './storage'

export const store = new Store(localStorageAdapter)

// Keep several open tabs/windows in sync so one can't overwrite another's changes.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) store.reload()
  })
}

export function useAppData() {
  return useSyncExternalStore(store.subscribe, store.getState)
}
