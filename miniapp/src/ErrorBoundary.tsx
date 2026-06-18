import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: string | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(err: unknown): State {
    return { error: err instanceof Error ? err.message : String(err) }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '24px', fontFamily: 'monospace', fontSize: '12px', color: '#dc2626', background: '#fff', minHeight: '100vh' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Помилка запуску</div>
          <div style={{ wordBreak: 'break-all' }}>{this.state.error}</div>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: '16px', padding: '8px 16px', background: '#1a1a1a', color: '#fff', border: 'none', cursor: 'pointer' }}
          >
            Перезавантажити
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
