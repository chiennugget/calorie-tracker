# Cloud backup setup (Supabase)

Cloud backup is off until the app is built with two variables. Without them the
app is local-only and the Cloud backup screen is hidden.

## 1. Create the table

Supabase dashboard → **SQL Editor** → **New query**. Paste the contents of
[`supabase/migrations/0001_backups.sql`](../supabase/migrations/0001_backups.sql)
and click **Run**. Running it again is safe.

It creates one `backups` table with row-level security, so each signed-in user
can only read and write their own snapshots, and signed-out visitors can't read
or write anything.

## 2. Send a code instead of a link

The app signs in with a 6-digit code, because an emailed link opens in Safari
rather than in the iPhone home-screen app.

1. Go to **Authentication** → **Emails** → **Templates** → **Magic Link**.
2. Replace the body with something like:

   ```html
   <h2>Your Calorie Tracker code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   <p>It expires in an hour. If you didn't ask for it, ignore this email.</p>
   ```

3. Save.

While you're there, check that **Authentication** → **Sign In / Providers** →
**Email** is enabled. It is by default.

Supabase's built-in email sender allows only a few emails per hour. That's
plenty for one person signing in once per device. For more, add your own SMTP
under **Authentication** → **Emails** → **SMTP Settings**.

## 3. Add the two values to GitHub

1. In Supabase, go to **Project Settings** → **API Keys** and copy:
   - the **Project URL**, e.g. `https://abcdefgh.supabase.co`
   - the **publishable** key (`sb_publishable_…`), or the legacy **anon** key
2. In GitHub, go to the repo → **Settings** → **Secrets and variables** →
   **Actions** → **Variables** tab → **New repository variable**.
3. Add:
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_ANON_KEY` = the publishable or anon key

Both values end up in the public JavaScript bundle. That's by design: the
row-level security from step 1 is what protects the data. **Never** use the
`secret` or `service_role` key here.

The next push to `main` deploys the app with cloud backup switched on.

## Local development

Create `.env.local` in the repo root. It's ignored by git via `*.local`.

```
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

## How it behaves

- **Uploads:** about 20 seconds after you stop making changes, and immediately
  when the app goes to the background. A snapshot is the whole diary as one
  JSON document. Each day has one snapshot, replaced by later uploads that day.
- **Retention:** every day for the last 30 days, then the newest snapshot of
  each older month.
- **Wipe safeguard:** automatic uploads stop if this device hasn't finished
  setup, has no data while the cloud has some, or has less than half as many
  entries and weigh-ins as the newest snapshot. The app then asks you to
  restore or to "Back up anyway".
- **Restore:** replaces everything on the device after a preview, and you can
  undo it from the toast.
- **Free plan pause:** Supabase pauses free projects after about a week with no
  activity. The data is kept. Restore the project from the Supabase dashboard
  and backups resume.
