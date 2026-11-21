// Supabase client and BackupTarget. Loaded lazily (dynamic import) so supabase-js
// doesn't slow down the first paint. Only cloud/cloud.ts should import this file.
import { createClient } from '@supabase/supabase-js'
import type { BackupTarget, SnapshotInfo } from '../lib/cloudBackup'
import type { AppData, DateKey } from '../lib/types'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config'

// The session (refresh token) is kept in localStorage and refreshed automatically,
// so the user signs in once per device.
const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})

type Row = { day: string; updated_at: string; entry_count: number; weigh_in_count: number; data_version: number }

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message)
}

export async function currentEmail(): Promise<string | null> {
  const { data } = await client.auth.getSession()
  return data.session?.user.email ?? null
}

export function onAuthChange(cb: (email: string | null) => void): void {
  client.auth.onAuthStateChange((_event, session) => cb(session?.user.email ?? null))
}

/** Emails a 6-digit code. A code (not a link) works inside an iPhone home-screen app. */
export async function sendCode(email: string): Promise<void> {
  const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
  fail(error)
}

export async function verifyCode(email: string, token: string): Promise<void> {
  const { error } = await client.auth.verifyOtp({ email, token, type: 'email' })
  fail(error)
}

export async function signOut(): Promise<void> {
  const { error } = await client.auth.signOut()
  fail(error)
}

export const target: BackupTarget = {
  async upsert(day: DateKey, data: AppData) {
    const { data: auth } = await client.auth.getSession()
    if (!auth.session) throw new Error('Not signed in')
    const { error } = await client.from('backups').upsert(
      {
        user_id: auth.session.user.id,
        day,
        data,
        data_version: data.version,
        entry_count: data.entries.length,
        weigh_in_count: data.weighIns.length,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,day' },
    )
    fail(error)
  },

  async list(): Promise<SnapshotInfo[]> {
    const { data, error } = await client
      .from('backups')
      .select('day, updated_at, entry_count, weigh_in_count, data_version')
      .order('day', { ascending: false })
    fail(error)
    return ((data ?? []) as Row[]).map((r) => ({
      day: r.day,
      updatedAt: Date.parse(r.updated_at),
      entryCount: r.entry_count,
      weighInCount: r.weigh_in_count,
      dataVersion: r.data_version,
    }))
  },

  async get(day: DateKey): Promise<string> {
    const { data, error } = await client.from('backups').select('data').eq('day', day).single()
    fail(error)
    return JSON.stringify((data as { data: unknown }).data)
  },

  async remove(days: DateKey[]) {
    if (!days.length) return
    const { error } = await client.from('backups').delete().in('day', days)
    fail(error)
  },
}
