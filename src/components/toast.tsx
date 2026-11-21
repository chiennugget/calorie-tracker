import { useEffect, useState } from 'react'

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
  if (!msg) return null
  return (
    <div className="toast" role="status" key={msg.id}>
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
