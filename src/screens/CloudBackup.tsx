import { useState } from 'react'
import { toast } from '../components/toast'
import { applySnapshot, backupNow, cloudSummary, fetchSnapshot, listSnapshots, sendCode, signOut, useCloud, verifyCode, type CloudState } from '../cloud/cloud'
import { BLOCK_MESSAGES, describeBackup, type SnapshotInfo } from '../lib/cloudBackup'
import { formatAgo, formatDayLabel } from '../lib/date'
import { store } from '../lib/useStore'

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')

export function CloudBackupCard() {
  const cloud = useCloud()
  if (cloud.loading) return <section className="card muted">Checking sign-in…</section>
  return cloud.email ? <SignedIn cloud={cloud} /> : <SignIn />
}

function SignIn() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      toast(errMsg(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="card">
      <p className="small">
        Back up your diary automatically, so clearing the browser or losing your phone doesn’t lose it. Sign in once with your email
        and we’ll send a 6-digit code. No password.
      </p>
      {!sent ? (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            void run(async () => {
              await sendCode(email)
              setSent(true)
            })
          }}
        >
          <label className="field">
            <span>Email</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="btn primary" disabled={busy || !email.includes('@')}>
            {busy ? 'Sending…' : 'Send code'}
          </button>
        </form>
      ) : (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            void run(async () => {
              await verifyCode(email, code)
              toast('Signed in. Cloud backup is on')
            })
          }}
        >
          <p className="hint ok">Code sent to {email}. Check your inbox (and spam).</p>
          <label className="field">
            <span>6-digit code</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,8}"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <button className="btn primary" disabled={busy || code.replace(/\s/g, '').length < 6}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <button
            type="button"
            className="link muted"
            onClick={() => {
              setSent(false)
              setCode('')
            }}
          >
            Use a different email
          </button>
        </form>
      )}
    </section>
  )
}

function SignedIn({ cloud }: { cloud: CloudState }) {
  const [snapshots, setSnapshots] = useState<SnapshotInfo[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const blocked = cloud.status === 'blocked' && cloud.block
  const bad = cloud.status === 'error' || (blocked && cloud.block !== 'not-onboarded')

  const loadSnapshots = async () => {
    setBusy('list')
    try {
      setSnapshots(await listSnapshots())
    } catch (e) {
      toast(errMsg(e))
    } finally {
      setBusy(null)
    }
  }

  const restore = async (s: SnapshotInfo) => {
    setBusy(s.day)
    try {
      const data = await fetchSnapshot(s.day)
      if (!confirm(`Replace all data on this device with the backup from ${formatDayLabel(s.day)}?\n\n${describeBackup(data)}`)) return
      const previous = applySnapshot(data)
      toast(`Restored backup from ${formatDayLabel(s.day)}`, { label: 'Undo', run: () => store.replaceAll(previous) })
    } catch (e) {
      toast(/newer/.test(errMsg(e)) ? errMsg(e) : `Couldn't restore that backup. ${errMsg(e)}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <section className="card stack" aria-labelledby="cloud-status">
        <p id="cloud-status" className={`hint ${bad ? 'warn' : 'ok'}`} role="status" aria-live="polite">
          <b>
            {cloudSummary(cloud)}
            {(blocked || (cloud.status === 'error' && cloud.error)) && '.'}
          </b>
          {blocked && <> {BLOCK_MESSAGES[blocked]}</>}
          {cloud.status === 'error' && cloud.error && <> {cloud.error}</>}
        </p>
        <p className="muted small">
          Signed in as <b>{cloud.email}</b>. Changes back up automatically a few seconds after you make them.
        </p>
        <div className="row gap wrap">
          <button
            className="btn primary"
            disabled={busy !== null || cloud.status === 'uploading'}
            onClick={async () => {
              const force =
                cloud.status === 'blocked' &&
                confirm('Replace today’s cloud backup with the data on this device? Older daily backups are kept.')
              if (cloud.status === 'blocked' && !force) return
              if (await backupNow(force)) toast('Backed up')
            }}
          >
            {blocked && cloud.block !== 'not-onboarded' ? 'Back up anyway' : 'Back up now'}
          </button>
          <button
            className="btn ghost"
            disabled={busy !== null}
            onClick={async () => {
              try {
                await signOut()
                toast('Signed out. Your data stays on this device')
              } catch (e) {
                toast(errMsg(e))
              }
            }}
          >
            Sign out
          </button>
        </div>
      </section>

      <section className="card">
        <h3>Restore</h3>
        <p className="muted small">One backup is kept for each day of the last 30 days, then one per month.</p>
        {snapshots === null ? (
          <button className="btn" disabled={busy !== null} onClick={loadSnapshots}>
            {busy === 'list' ? 'Loading…' : 'Show backups'}
          </button>
        ) : snapshots.length === 0 ? (
          <p className="small">No backups yet.</p>
        ) : (
          <ul className="list" aria-label="Cloud backups">
            {snapshots.map((s) => (
              <li key={s.day} className="list-item row between">
                <div>
                  <div className="item-name">{formatDayLabel(s.day)}</div>
                  <div className="muted small">
                    {s.entryCount.toLocaleString()} entries · {s.weighInCount.toLocaleString()} weigh-ins · saved {formatAgo(s.updatedAt)}
                  </div>
                </div>
                <button className="btn ghost" disabled={busy !== null} onClick={() => restore(s)}>
                  {busy === s.day ? 'Loading…' : 'Restore'}
                  <span className="sr-only"> backup from {formatDayLabel(s.day)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
