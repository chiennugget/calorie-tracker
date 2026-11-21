import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from '../components/toast'
import { NumberField, Segmented, toNum } from '../components/ui'
import { addDays, formatDayLabel, formatShort, today } from '../lib/date'
import { trendWeights } from '../lib/nutrition'
import { displayWeight, inputWeightToKg } from '../lib/units'
import { store } from '../lib/useStore'
import type { AppData } from '../lib/types'

type Range = '30' | '90' | '365' | 'all'

export function Weight({ data }: { data: AppData }) {
  const unit = data.settings.weightUnit
  const todays = data.weighIns.find((w) => w.date === today())
  const [date, setDate] = useState(today())
  const [value, setValue] = useState(todays ? String(displayWeight(todays.weightKg, unit)) : '')
  const [note, setNote] = useState('')
  const [range, setRange] = useState<Range>('90')

  const series = useMemo(() => trendWeights(data.weighIns), [data.weighIns])
  const visible = useMemo(() => {
    if (range === 'all') return series
    const from = addDays(today(), -Number(range))
    return series.filter((p) => p.date >= from)
  }, [series, range])
  const chart = visible.map((p) => ({
    date: p.date,
    weight: displayWeight(p.weight, unit),
    trend: displayWeight(p.trend, unit),
  }))

  const latest = series.at(-1)
  const first = series[0]
  const weekAgo = [...series].reverse().find((p) => p.date <= addDays(latest?.date ?? today(), -7))
  const goalKg = data.settings.profile?.goalWeightKg

  const change = (from?: number, to?: number) =>
    from === undefined || to === undefined ? '—' : `${to - from > 0 ? '+' : ''}${displayWeight(to - from, unit)} ${unit}`

  return (
    <div className="screen">
      <section className="card">
        <h3>Log weigh-in</h3>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            const v = toNum(value)
            if (v <= 0) return
            store.logWeight({ date, weightKg: inputWeightToKg(v, unit), note: note.trim() || undefined })
            setNote('')
            toast(`Logged ${v} ${unit} for ${formatDayLabel(date).toLowerCase()}`)
          }}
        >
          <div className="grid-2">
            <NumberField label="Weight" value={value} onChange={setValue} suffix={unit} step="0.1" />
            <label className="field">
              <span>Date</span>
              <input type="date" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </label>
          </div>
          <label className="field">
            <span>Note (optional)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. after holiday" />
          </label>
          <button className="btn primary" disabled={toNum(value) <= 0}>
            {data.weighIns.some((w) => w.date === date) ? 'Update weigh-in' : 'Save weigh-in'}
          </button>
          <p className="muted small">Tip: weigh in first thing in the morning, after the bathroom, for consistent numbers.</p>
        </form>
      </section>

      {latest && (
        <section className="card">
          <div className="stats">
            <div>
              <b>{displayWeight(latest.weight, unit)}</b>
              <span>Current ({unit})</span>
            </div>
            <div>
              <b>{displayWeight(latest.trend, unit)}</b>
              <span>Trend</span>
            </div>
            <div>
              <b>{change(weekAgo?.trend, latest.trend)}</b>
              <span>7-day change</span>
            </div>
            <div>
              <b>{change(first?.weight, latest.weight)}</b>
              <span>Total change</span>
            </div>
            {goalKg && (
              <div>
                <b>{change(latest.trend, goalKg).replace('+', '')}</b>
                <span>To goal</span>
              </div>
            )}
          </div>
          <Segmented
            value={range}
            onChange={setRange}
            options={[
              { value: '30', label: '30d' },
              { value: '90', label: '90d' },
              { value: '365', label: '1y' },
              { value: 'all', label: 'All' },
            ]}
          />
          {chart.length > 1 ? (
            <div className="chart">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chart} margin={{ top: 10, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatShort} tick={{ fontSize: 11, fill: 'var(--muted)' }} minTickGap={24} axisLine={false} tickLine={false} />
                  <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 11, fill: 'var(--muted)' }} allowDecimals={false} axisLine={false} tickLine={false} />
                  <Tooltip
                    labelFormatter={(l) => formatShort(String(l))}
                    formatter={(v, n) => [`${v} ${unit}`, n === 'trend' ? 'Trend' : 'Weight']}
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }}
                  />
                  {goalKg && <ReferenceLine y={displayWeight(goalKg, unit)} stroke="var(--good)" strokeDasharray="4 4" />}
                  <Line type="monotone" dataKey="weight" stroke="var(--muted)" strokeWidth={0} dot={{ r: 2.5, fill: 'var(--muted)' }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="trend" stroke="var(--accent)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
              <p className="muted small">Dots are daily weigh-ins; the line is your smoothed trend, which ignores day-to-day water swings.</p>
            </div>
          ) : (
            <p className="muted">Log at least two weigh-ins to see your chart.</p>
          )}
        </section>
      )}

      {series.length > 0 && (
        <section className="card">
          <h3>History</h3>
          <ul className="list">
            {[...data.weighIns]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((w) => (
                <li key={w.date} className="list-item row between">
                  <div>
                    <div className="item-name">{formatDayLabel(w.date)}</div>
                    {w.note && <div className="muted small">{w.note}</div>}
                  </div>
                  <div className="row gap">
                    <span className="kcal">
                      {displayWeight(w.weightKg, unit)} {unit}
                    </span>
                    <button
                      className="icon-btn small"
                      aria-label="Delete weigh-in"
                      onClick={() => {
                        store.deleteWeight(w.date)
                        toast('Weigh-in deleted', { label: 'Undo', run: () => store.logWeight(w) })
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  )
}
