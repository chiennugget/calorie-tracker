import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Segmented, fmt, kcal } from '../components/ui'
import { formatShort, fromDateKey, lastNDays, today } from '../lib/date'
import { daySummary, entriesFor, loggingStreak, sumEntries, trendWeights } from '../lib/nutrition'
import { displayWeight } from '../lib/units'
import type { AppData } from '../lib/types'
import { MEAL_SLOTS, SLOT_LABELS } from '../lib/types'

export function Progress({ data }: { data: AppData }) {
  const [range, setRange] = useState<'7' | '30' | '90'>('7')
  const days = useMemo(() => lastNDays(today(), Number(range)), [range])
  const summaries = useMemo(() => days.map((d) => daySummary(data, d)), [data, days])
  const logged = summaries.filter((s) => s.logged)
  const goal = data.settings.goals.calories

  const avg = (f: (s: (typeof summaries)[number]) => number) =>
    logged.length ? logged.reduce((a, s) => a + f(s), 0) / logged.length : 0
  const avgCal = avg((s) => s.food.calories)
  const avgP = avg((s) => s.food.protein)
  const avgC = avg((s) => s.food.carbs)
  const avgF = avg((s) => s.food.fat)
  const avgEx = avg((s) => s.exercise)
  const daysUnder = logged.filter((s) => s.remaining >= 0).length

  const chart = summaries.map((s) => ({
    date: s.date,
    calories: Math.round(s.food.calories),
    over: s.remaining < 0,
  }))

  const macroPie = [
    { name: 'Protein', value: avgP * 4, cls: 'var(--protein)' },
    { name: 'Carbs', value: avgC * 4, cls: 'var(--carbs)' },
    { name: 'Fat', value: avgF * 9, cls: 'var(--fat)' },
  ]
  const pieTotal = macroPie.reduce((a, m) => a + m.value, 0)

  const bySlot = MEAL_SLOTS.map((slot) => {
    const total = logged.reduce((a, s) => a + sumEntries(entriesFor(data, s.date, slot)).calories, 0)
    return { slot, avg: logged.length ? total / logged.length : 0 }
  })

  // Estimated actual TDEE from intake vs trend weight change (needs ~2+ weeks of data).
  const tdeeEstimate = useMemo(() => {
    const trend = trendWeights(data.weighIns).filter((p) => p.date >= days[0])
    if (trend.length < 2 || logged.length < 10) return null
    const spanDays = (fromDateKey(trend.at(-1)!.date).getTime() - fromDateKey(trend[0].date).getTime()) / 864e5
    if (spanDays < 14) return null
    const kgPerDay = (trend.at(-1)!.trend - trend[0].trend) / spanDays
    return Math.round(avgCal - kgPerDay * 7700)
  }, [data.weighIns, days, logged.length, avgCal])

  return (
    <div className="screen">
      <Segmented
        value={range}
        onChange={setRange}
        options={[
          { value: '7', label: '7 days' },
          { value: '30', label: '30 days' },
          { value: '90', label: '90 days' },
        ]}
      />

      <section className="card">
        <div className="stats">
          <div>
            <b>{logged.length ? kcal(avgCal) : '—'}</b>
            <span>Avg kcal/day</span>
          </div>
          <div>
            <b>
              {daysUnder}/{logged.length}
            </b>
            <span>Days on target</span>
          </div>
          <div>
            <b>{loggingStreak(data, today())}</b>
            <span>Day streak</span>
          </div>
          <div>
            <b>{kcal(avgEx)}</b>
            <span>Avg exercise</span>
          </div>
        </div>
        <h3>Calories</h3>
        <div className="chart">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chart} margin={{ top: 10, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => (range === '7' ? fromDateKey(d).toLocaleDateString(undefined, { weekday: 'short' }) : formatShort(d))}
                tick={{ fontSize: 11, fill: 'var(--muted)' }}
                minTickGap={16}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--muted)' }}
                axisLine={false}
                tickLine={false}
                domain={[0, (max: number) => Math.ceil(Math.max(max, goal * 1.08) / 100) * 100]}
              />
              <Tooltip
                labelFormatter={(l) => formatShort(String(l))}
                formatter={(v) => [`${v} kcal`, 'Eaten']}
                cursor={{ fill: 'var(--grid)' }}
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }}
              />
              <ReferenceLine y={goal} stroke="var(--muted)" strokeDasharray="4 4" label={{ value: 'Goal', position: 'insideTopRight', fontSize: 11, fill: 'var(--muted)' }} />
              <Bar dataKey="calories" radius={[8, 8, 8, 8]} isAnimationActive={false}>
                {chart.map((c) => (
                  <Cell key={c.date} fill={c.over ? 'var(--bad)' : 'var(--accent)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card">
        <h3>Average macros</h3>
        {pieTotal > 0 ? (
          <div className="row gap macro-pie">
            <ResponsiveContainer width={130} height={130}>
              <PieChart>
                <Pie data={macroPie} dataKey="value" innerRadius={38} outerRadius={60} strokeWidth={0} isAnimationActive={false}>
                  {macroPie.map((m) => (
                    <Cell key={m.name} fill={m.cls} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <ul className="legend grow">
              {[
                { n: 'Protein', g: avgP, goal: data.settings.goals.protein, i: 0 },
                { n: 'Carbs', g: avgC, goal: data.settings.goals.carbs, i: 1 },
                { n: 'Fat', g: avgF, goal: data.settings.goals.fat, i: 2 },
              ].map((m) => (
                <li key={m.n}>
                  <i style={{ background: macroPie[m.i].cls }} />
                  <span className="grow">{m.n}</span>
                  <b>{fmt(m.g)} g</b>
                  <span className="muted small">
                    {' '}
                    / {m.goal} · {Math.round((macroPie[m.i].value / pieTotal) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="muted">Log some food to see your macro split.</p>
        )}
      </section>

      <section className="card">
        <h3>Calories by meal (avg)</h3>
        <ul className="list">
          {bySlot.map((b) => (
            <li key={b.slot} className="list-item row between">
              <span>{SLOT_LABELS[b.slot]}</span>
              <span className="kcal">{kcal(b.avg)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h3>Weight</h3>
        {(() => {
          const t = trendWeights(data.weighIns).filter((p) => p.date >= days[0])
          if (t.length < 2) return <p className="muted">Log weigh-ins on the Weight tab to see changes here.</p>
          const diff = t.at(-1)!.trend - t[0].trend
          const unit = data.settings.weightUnit
          return (
            <p>
              Trend weight {diff <= 0 ? 'down' : 'up'} <b>{Math.abs(displayWeight(diff, unit))} {unit}</b> over this period.
            </p>
          )
        })()}
        {tdeeEstimate && (
          <p className="muted small">
            Based on your intake and weight trend, your estimated real maintenance is about <b>{kcal(tdeeEstimate)} kcal/day</b>.
          </p>
        )}
      </section>
    </div>
  )
}
