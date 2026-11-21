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
rather than in the iPhone home-screen app. Supabase only lets you edit email
templates once you're using your own SMTP server, so set one up first. Gmail is
free and works fine for one person.

**a. Gmail app password**
1. Turn on 2-Step Verification for the Google account at myaccount.google.com → Security.
2. Go to myaccount.google.com/apppasswords, create one named `Supabase`, and copy the 16 letters.

**b. Supabase SMTP**

Go to **Authentication** → **Emails** → **Set up SMTP** → **Enable custom SMTP**, then fill in:

| Field | Value |
|---|---|
| Sender email / Username | your Gmail address |
| Sender name | Calorie Tracker |
| Host / Port | `smtp.gmail.com` / `465` |
| Password | the app password, without spaces |

**c. Template**

Still on **Authentication** → **Emails**, open the **Magic Link** template.
Do the same for **Confirm signup**, which the very first sign-in may use.

1. Set the subject to `Your Calorie Tracker code`.
2. In **Source**, replace the body with:

   ```html
   <h2>Your Calorie Tracker code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   <p>It expires in an hour. If you didn't ask for it, ignore this email.</p>
   ```

3. Click **Save changes**.

Check that **Authentication** → **Sign In / Providers** → **Email** is enabled.
It is by default.

## 3. Add the two values to GitHub

1. In Supabase, click **Connect** in the top bar, or go to **Project Settings** → **API Keys**, and copy:
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
