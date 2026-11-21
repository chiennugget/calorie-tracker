import { Component, type ReactNode } from 'react'
import { downloadBackup } from '../lib/backup'
import { store } from '../lib/useStore'

/**
 * Last line of defence: if a screen crashes, show a way out instead of a blank
 * page, and always offer to download the data first.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Screen crashed', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="screen">
        <section className="card" role="alert">
          <h3>Something went wrong</h3>
          <p className="small">
            This screen hit an error. Your data is still saved on this device. Download a backup to be safe, then reload.
          </p>
          <p className="muted small">{this.state.error.message}</p>
          <div className="row gap wrap">
            <button className="btn" onClick={() => downloadBackup(store.getState())}>
              Download backup
            </button>
            <button className="btn primary" onClick={() => location.reload()}>
              Reload
            </button>
          </div>
        </section>
      </div>
    )
  }
}
