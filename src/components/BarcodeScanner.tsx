import { useEffect, useRef, useState } from 'react'

interface DetectorLike {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => DetectorLike
  }
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']

/**
 * Uses the native BarcodeDetector API where available (Chrome/Android, Safari 17+)
 * and falls back to ZXing (lazy-loaded) elsewhere.
 */
export function BarcodeScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [manual, setManual] = useState('')
  const done = useRef(false)

  useEffect(() => {
    let stream: MediaStream | undefined
    let raf = 0
    let stopZxing: (() => void) | undefined
    let cancelled = false

    const finish = (code: string) => {
      if (done.current) return
      done.current = true
      navigator.vibrate?.(50)
      onDetected(code)
    }

    async function start() {
      const video = videoRef.current
      if (!video) return
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera not available in this browser. Enter the barcode manually below.')
        return
      }
      try {
        if (window.BarcodeDetector) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
          if (cancelled) return
          video.srcObject = stream
          await video.play()
          const detector = new window.BarcodeDetector({ formats: FORMATS })
          const tick = async () => {
            if (cancelled || done.current) return
            try {
              const codes = await detector.detect(video)
              if (codes[0]?.rawValue) return finish(codes[0].rawValue)
            } catch {
              /* frame not ready */
            }
            raf = requestAnimationFrame(tick)
          }
          tick()
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser')
          if (cancelled) return
          const reader = new BrowserMultiFormatReader()
          const controls = await reader.decodeFromConstraints(
            { video: { facingMode: 'environment' } },
            video,
            (result) => {
              if (result) finish(result.getText())
            },
          )
          stopZxing = () => controls.stop()
        }
      } catch (e) {
        setError(
          e instanceof DOMException && e.name === 'NotAllowedError'
            ? 'Camera permission denied. Allow camera access or enter the barcode below.'
            : 'Could not start the camera. Enter the barcode manually below.',
        )
      }
    }
    start()
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      stopZxing?.()
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onDetected])

  return (
    <div className="stack">
      {!error && (
        <div className="scanner">
          <video ref={videoRef} muted playsInline />
          <div className="scan-frame" />
        </div>
      )}
      {error && <p className="hint warn">{error}</p>}
      <form
        className="row gap"
        onSubmit={(e) => {
          e.preventDefault()
          if (manual.trim()) onDetected(manual.trim())
        }}
      >
        <input
          className="grow"
          inputMode="numeric"
          placeholder="Or type barcode number"
          value={manual}
          onChange={(e) => setManual(e.target.value.replace(/\D/g, ''))}
        />
        <button className="btn" disabled={!manual}>
          Look up
        </button>
      </form>
    </div>
  )
}
