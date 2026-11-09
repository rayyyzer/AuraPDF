import { useCallback, useEffect, useRef, useState } from "react"
import { isTauriContext } from "../services/tauri"

export function useWindowFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const rafRef = useRef<number | null>(null)

  const reconcile = useCallback(async () => {
    try {
      if (isTauriContext()) {
        const { getCurrentWindow } = await import("@tauri-apps/api/window")
        const fs = await getCurrentWindow().isFullscreen()
        setIsFullscreen(fs)
      } else {
        setIsFullscreen(document.fullscreenElement != null)
      }
    } catch {
      // Ignore transient window query errors
    }
  }, [])

  useEffect(() => {
    let active = true
    let unlistenResize: (() => void) | undefined
    let unlistenFocus: (() => void) | undefined

    void reconcile()

    if (isTauriContext()) {
      import("@tauri-apps/api/window")
        .then(async ({ getCurrentWindow }) => {
          if (!active) return
          const win = getCurrentWindow()
          const unResize = await win.onResized(() => {
            if (rafRef.current != null) return
            rafRef.current = window.requestAnimationFrame(() => {
              rafRef.current = null
              if (active) void reconcile()
            })
          })
          const unFocus = await win.onFocusChanged(({ payload }) => {
            if (payload && active) void reconcile()
          })
          if (!active) {
            unResize()
            unFocus()
            return
          }
          unlistenResize = unResize
          unlistenFocus = unFocus
        })
        .catch(() => {})
    } else {
      document.addEventListener("fullscreenchange", reconcile)
    }

    const onCustomFullscreen = (e: Event) => {
      const custom = e as CustomEvent<boolean>
      if (typeof custom.detail === "boolean") {
        setIsFullscreen(custom.detail)
      } else if (active) {
        void reconcile()
      }
    }
    window.addEventListener("aura:fullscreen-change", onCustomFullscreen)

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "F11") {
        window.setTimeout(() => {
          if (active) void reconcile()
        }, 60)
        window.setTimeout(() => {
          if (active) void reconcile()
        }, 220)
      }
    }
    window.addEventListener("keyup", onKeyUp)

    return () => {
      active = false
      unlistenResize?.()
      unlistenFocus?.()
      document.removeEventListener("fullscreenchange", reconcile)
      window.removeEventListener("aura:fullscreen-change", onCustomFullscreen)
      window.removeEventListener("keyup", onKeyUp)
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current)
      }
    }
  }, [reconcile])

  const setFullscreen = useCallback(
    async (next: boolean) => {
      try {
        if (isTauriContext()) {
          const { getCurrentWindow } = await import("@tauri-apps/api/window")
          const win = getCurrentWindow()
          await win.setFullscreen(next)
          setIsFullscreen(next)
          window.dispatchEvent(
            new CustomEvent("aura:fullscreen-change", { detail: next }),
          )
        } else if (next) {
          await document.documentElement.requestFullscreen()
          setIsFullscreen(true)
          window.dispatchEvent(
            new CustomEvent("aura:fullscreen-change", { detail: true }),
          )
        } else if (document.fullscreenElement) {
          await document.exitFullscreen()
          setIsFullscreen(false)
          window.dispatchEvent(
            new CustomEvent("aura:fullscreen-change", { detail: false }),
          )
        }
      } catch (err) {
        console.warn("[Fullscreen] Failed to set fullscreen:", err)
      } finally {
        await reconcile()
      }
    },
    [reconcile],
  )

  const toggleFullscreen = useCallback(async () => {
    try {
      if (isTauriContext()) {
        const { getCurrentWindow } = await import("@tauri-apps/api/window")
        const win = getCurrentWindow()
        const current = await win.isFullscreen()
        const next = !current
        await win.setFullscreen(next)
        setIsFullscreen(next)
        window.dispatchEvent(
          new CustomEvent("aura:fullscreen-change", { detail: next }),
        )
        return
      }
    } catch (err) {
      console.warn("[Fullscreen] Failed to toggle Tauri fullscreen:", err)
    }
    return setFullscreen(!isFullscreen)
  }, [isFullscreen, setFullscreen])

  return { isFullscreen, setFullscreen, toggleFullscreen }
}
