import { useEffect, useRef, useState } from 'react'

type ToastMsg = { id: number; text: string; action?: { label: string; run: () => void } }
let listeners: ((t: ToastMsg) => void)[] = []
let next = 1

export function toast(text: string, action?: ToastMsg['action']) {
  const t = { id: next++, text, action }
  listeners.forEach((l) => l(t))
}

export function Toaster() {
  const [msg, setMsg] = useState<ToastMsg | null>(null)
  useEffect(() => {
    const l = (t: ToastMsg) => setMsg(t)
    listeners.push(l)
    return () => {
      listeners = listeners.filter((x) => x !== l)
    }
  }, [])
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 3500)
    return () => clearTimeout(t)
  }, [msg])
  // Shown as a manual popover so it sits in the top layer, above an open <dialog> sheet
  // (otherwise "Added … · Undo" is hidden behind the sheet you're adding from).
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    try {
      if (el && !el.matches(':popover-open')) el.showPopover()
    } catch {
      /* Older browsers without the Popover API: it still shows, just under any open sheet. */
    }
  }, [msg])
  if (!msg) return null
  return (
    <div className="toast" role="status" key={msg.id} ref={ref} popover="manual">
      <span>{msg.text}</span>
      {msg.action && (
        <button
          onClick={() => {
            msg.action!.run()
            setMsg(null)
          }}
        >
          {msg.action.label}
        </button>
      )}
    </div>
  )
}
