import React, { Component, type ReactNode } from "react"
import { db } from "../services/db"
import { isTauriContext } from "../services/tauri"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[CRASH_CAUGHT]", error, errorInfo)
    this.setState({ errorInfo })
    try {
      localStorage.setItem(
        "aura:lastCrash",
        JSON.stringify({
          time: new Date().toISOString(),
          error: error.toString(),
          stack: error.stack,
          componentStack: errorInfo.componentStack,
        }),
      )
    } catch {
      // Ignore localStorage failures
    }
  }

  handleReload = () => {
    window.location.reload()
  }

  handleResetSession = async () => {
    try {
      localStorage.removeItem("aura:lastCrash")
      if (isTauriContext()) {
        await db.saveSession(0, [])
      }
    } catch (e) {
      console.warn("Failed to reset session:", e)
    } finally {
      window.location.reload()
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#07080E] text-slate-100 flex flex-col items-center justify-center p-6 select-none font-sans">
          <div className="max-w-md w-full bg-[#0D0F1A] border border-[#1F263E] rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-1.5">
              Something went wrong
            </h2>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              AuraPDF encountered an unexpected error while rendering the workspace. You can reload or reset your active tabs to recover.
            </p>

            {this.state.error && (
              <div className="w-full text-left bg-black/40 border border-white/5 rounded-lg p-3 mb-6 max-h-36 overflow-auto font-mono text-[11px] text-red-300">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex items-center gap-3 w-full">
              <button
                onClick={this.handleReload}
                className="flex-1 px-4 py-2 rounded-lg text-xs font-semibold bg-white/10 text-white hover:bg-white/15 transition-colors border border-white/10"
              >
                Reload
              </button>
              <button
                onClick={this.handleResetSession}
                className="flex-1 px-4 py-2 rounded-lg text-xs font-semibold bg-[#7C5CFC] text-white hover:bg-[#6A4BE8] transition-colors shadow-sm"
              >
                Reset Workspace
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
