import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  failed: boolean
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    // A redacted support logger will replace this boundary hook before external integrations ship.
  }

  render(): ReactNode {
    if (!this.state.failed) {
      return this.props.children
    }

    return (
      <main className="recovery-screen">
        <div className="logo-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p className="eyebrow">Safe recovery</p>
        <h1>The studio screen needs to restart.</h1>
        <p>
          Your project files were not deleted, and this did not start a cloud GPU or paid action.
        </p>
        <button className="button button-primary" onClick={() => window.location.reload()}>
          Restart the screen
        </button>
      </main>
    )
  }
}
