import { Suspense, lazy, useEffect, useState } from 'react'
import { AddFoodSheet } from './components/AddFoodSheet'
import { Toaster } from './components/toast'
import { today } from './lib/date'
import type { DateKey, MealSlot } from './lib/types'
import { useAppData } from './lib/useStore'
import { Diary } from './screens/Diary'
import { Settings } from './screens/Settings'

// Chart-heavy screens are code-split so the diary loads fast.
const Progress = lazy(() => import('./screens/Progress').then((m) => ({ default: m.Progress })))
const Weight = lazy(() => import('./screens/Weight').then((m) => ({ default: m.Weight })))

type Tab = 'diary' | 'progress' | 'weight' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'diary', label: 'Diary', icon: '📖' },
  { id: 'progress', label: 'Progress', icon: '📊' },
  { id: 'weight', label: 'Weight', icon: '⚖️' },
  { id: 'settings', label: 'More', icon: '⚙️' },
]

/** Default meal slot based on time of day. */
function slotForNow(): MealSlot {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snacks'
}

export default function App() {
  const data = useAppData()
  const [tab, setTab] = useState<Tab>('diary')
  const [date, setDate] = useState<DateKey>(today())
  const [addSlot, setAddSlot] = useState<MealSlot | null>(null)
  const [lastSlot, setLastSlot] = useState<MealSlot>(slotForNow())

  // Roll the diary over to the new day if the app stays open past midnight.
  useEffect(() => {
    let current = today()
    const id = setInterval(() => {
      const t = today()
      if (t !== current) {
        setDate((d) => (d === current ? t : d))
        current = t
      }
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  const openAdd = (slot: MealSlot) => {
    setLastSlot(slot)
    setAddSlot(slot)
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>{tab === 'settings' ? 'Settings' : TABS.find((t) => t.id === tab)!.label}</h1>
      </header>
      <main>
        <Suspense fallback={<div className="screen muted">Loading…</div>}>
        {tab === 'diary' && <Diary data={data} date={date} setDate={setDate} onAdd={openAdd} />}
        {tab === 'progress' && <Progress data={data} />}
        {tab === 'weight' && <Weight data={data} />}
        {tab === 'settings' && <Settings data={data} />}
        </Suspense>
      </main>

      {tab === 'diary' && (
        <button className="fab" aria-label="Add food" onClick={() => openAdd(slotForNow())}>
          +
        </button>
      )}

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={t.id === tab ? 'active' : ''} onClick={() => setTab(t.id)}>
            <span aria-hidden>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      <AddFoodSheet open={addSlot !== null} onClose={() => setAddSlot(null)} date={date} initialSlot={addSlot ?? lastSlot} data={data} />
      <Toaster />
    </div>
  )
}
