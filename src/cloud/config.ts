// Cloud backup is switched on by two build-time variables (both public by design;
// row-level security in supabase/migrations is what protects the data).
// Without them the cloud UI is hidden and the app stays local-only.
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? ''
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
export const cloudConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY)
