import { Suspense, lazy, useEffect, useState } from 'react'
import { AddFoodSheet, type Tab as AddTab } from './components/AddFoodSheet'
import { IconChart, IconChevronLeft, IconHome, IconScale, IconScan, IconUser } from './components/Icons'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Toaster, toast } from './components/toast'
import { formatDayLabel, fromDateKey, today } from './lib/date'
import { loggingStreak } from './lib/nutrition'
import type { DateKey, MealSlot } from './lib/types'
import { store, useAppData } from './lib/useStore'
import { Diary } from './screens/Diary'
import { Settings, type SettingsPage } from './screens/Settings'

// Chart-heavy screens are code-split so the diary loads fast.
const Progress = lazy(() => import('./screens/Progress').then((m) => ({ default: m.Progress })))
const Weight = lazy(() => import('./screens/Weight').then((m) => ({ default: m.Weight })))

type Tab = 'diary' | 'progress' | 'weight' | 'settings'

const TABS: { id: Tab; label: string; Icon: typeof IconHome }[] = [
  { id: 'diary', label: 'Today', Icon: IconHome },
  { id: 'progress', label: 'Progress', Icon: IconChart },
  { id: 'weight', label: 'Weight', Icon: IconScale },
  { id: 'settings', label: 'Settings', Icon: IconUser },
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
  const [addTab, setAddTab] = useState<AddTab | undefined>(undefined)
  const [lastSlot, setLastSlot] = useState<MealSlot>(slotForNow())
  const [settingsPage, setSettingsPage] = useState<SettingsPage | null>(null)

  // Surface storage problems instead of silently losing changes, and ask the
  // browser not to evict our data under storage pressure (matters on iOS).
  useEffect(() => {
    store.setSaveErrorHandler(() =>
      toast("Couldn't save. Storage may be full or blocked (private browsing?). Download a backup from Settings."),
    )
    navigator.storage?.persist?.().catch(() => {})
  }, [])

  // Let the phone's back gesture / browser back close a settings sub-page.
  useEffect(() => {
    const onPop = () => setSettingsPage(null)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const openSettingsPage = (p: SettingsPage) => {
    history.pushState({ settingsPage: p }, '')
    setSettingsPage(p)
    window.scrollTo(0, 0)
  }
  const closeSettingsPage = () => (history.state?.settingsPage ? history.back() : setSettingsPage(null))
  const switchTab = (t: Tab) => {
    if (settingsPage) closeSettingsPage()
    setTab(t)
    window.scrollTo(0, 0)
  }

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

  const openAdd = (slot: MealSlot, tab?: AddTab) => {
    setLastSlot(slot)
    setAddTab(tab)
    setAddSlot(slot)
  }
  const streak = loggingStreak(data, today())
  const title =
    tab === 'diary'
      ? date === today()
        ? 'Today'
        : formatDayLabel(date)
      : tab === 'settings'
        ? 'Settings'
        : TABS.find((t) => t.id === tab)!.label
  const subtitle =
    tab === 'diary' ? fromDateKey(date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) : null

  return (
    <div className="app">
      <header className="topbar">
        {tab === 'settings' && settingsPage ? (
          <button className="topbar-back" onClick={closeSettingsPage} aria-label="Back to Settings">
            <IconChevronLeft size={26} strokeWidth={2.6} />
            Settings
          </button>
        ) : (
          <div className="title-block">
            {subtitle && <p className="eyebrow">{subtitle}</p>}
            <h1>{title}</h1>
          </div>
        )}
        <div className="topbar-pill">
          <span className="streak-count" title={`${streak}-day logging streak`}>
            <span aria-hidden>🔥</span> {streak}
          </span>
          <span className="divider" />
          <button
            className="avatar-btn"
            aria-label="Settings"
            onClick={() => {
              if (tab !== 'settings') switchTab('settings')
            }}
          >
            <IconUser size={20} />
          </button>
        </div>
      </header>
      <main>
        <ErrorBoundary key={tab}>
        <Suspense fallback={<div className="screen muted">Loading…</div>}>
        <div className="tab-view" key={tab}>
        {tab === 'diary' && <Diary
            data={data}
            date={date}
            setDate={setDate}
            onAdd={openAdd}
            onOpenCalculator={() => {
              setTab('settings')
              openSettingsPage('calculator')
            }}
          />}
        {tab === 'progress' && <Progress data={data} />}
        {tab === 'weight' && <Weight data={data} />}
        {tab === 'settings' && (
          <Settings data={data} page={settingsPage} onOpen={openSettingsPage} key={settingsPage ?? 'menu'} />
        )}
        </div>
        </Suspense>
        </ErrorBoundary>
      </main>

      {tab === 'diary' && (
        <div className="action-pill">
          <button className="action-pill-main" onClick={() => openAdd(slotForNow())}>
            <span className="action-title">Log food</span>
            <span className="action-sub">Search hawker food, meals or quick add</span>
          </button>
          <button className="action-pill-btn" aria-label="Scan barcode" onClick={() => openAdd(slotForNow(), 'scan')}>
            <IconScan size={24} />
          </button>
        </div>
      )}

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={t.id === tab ? 'active' : ''} onClick={() => switchTab(t.id)}>
            <t.Icon size={24} strokeWidth={t.id === tab ? 2.4 : 2} />
            {t.label}
          </button>
        ))}
      </nav>

      <AddFoodSheet
        open={addSlot !== null}
        onClose={() => setAddSlot(null)}
        date={date}
        initialSlot={addSlot ?? lastSlot}
        initialTab={addTab}
        data={data}
      />
      <Toaster />
    </div>
  )
}
