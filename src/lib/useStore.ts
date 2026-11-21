import { useSyncExternalStore } from 'react'
import { Store } from './store'
import { localStorageAdapter } from './storage'

export const store = new Store(localStorageAdapter)

export function useAppData() {
  return useSyncExternalStore(store.subscribe, store.getState)
}
