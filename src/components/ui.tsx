import { useEffect, useRef, type ReactNode } from 'react'
import type { Nutrients } from '../lib/types'

/**
 * Locks page scrolling while any sheet is open. iOS Safari ignores
 * `overflow: hidden` on <body>, so the body is pinned with position: fixed
 * and the scroll position is restored afterwards.
 */
let lockCount = 0
let savedScrollY = 0
function lockScroll() {
  if (lockCount++ > 0) return
  savedScrollY = window.scrollY
  const b = document.body.style
  b.position = 'fixed'
  b.top = `-${savedScrollY}px`
  b.left = '0'
  b.right = '0'
  b.overflow = 'hidden'
}
function unlockScroll() {
  if (--lockCount > 0) return
  lockCount = 0
  const b = document.body.style
  b.position = b.top = b.left = b.right = b.overflow = ''
  window.scrollTo(0, savedScrollY)
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  tall = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Fixed near-full height, so content (e.g. a search box) never jumps as results change. */
  tall?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  useEffect(() => {
    if (!open) return
    lockScroll()
    return unlockScroll
  }, [open])
  return (
    <dialog
      ref={ref}
      className={`sheet ${tall ? 'tall' : ''}`}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      {open && (
        <div className="sheet-inner">
          <header className="sheet-head">
            <h2>{title}</h2>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </header>
          <div className="sheet-body">{children}</div>
        </div>
      )}
    </dialog>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  suffix,
  step = 'any',
  min = 0,
  autoFocus,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  suffix?: string
  step?: string
  min?: number
  autoFocus?: boolean
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-wrap">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.target.select()}
        />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  )
}

export function ProgressBar({ value, goal, className = '' }: { value: number; goal: number; className?: string }) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0
  const over = goal > 0 && value > goal * 1.02
  return (
    <div className={`bar ${className} ${over ? 'over' : ''}`}>
      <div style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Ring({
  value,
  goal,
  size = 120,
  stroke = 10,
  className = '',
  children,
}: {
  value: number
  goal: number
  size?: number
  stroke?: number
  className?: string
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = goal > 0 ? Math.min(1, value / goal) : 0
  const over = goal > 0 && value > goal
  return (
    <div className={`ring ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className={`ring-fill ${over ? 'over' : ''}`}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  )
}

export function MacroLine({ n, className = '' }: { n: Nutrients; className?: string }) {
  return (
    <span className={`macro-line ${className}`}>
      <b className="p">P {fmt(n.protein)}</b> <b className="c">C {fmt(n.carbs)}</b> <b className="f">F {fmt(n.fat)}</b>
    </span>
  )
}

export const fmt = (n: number) => (Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10).toLocaleString()
export const kcal = (n: number) => Math.round(n).toLocaleString()

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={o.value === value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function toNum(s: string): number {
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}
