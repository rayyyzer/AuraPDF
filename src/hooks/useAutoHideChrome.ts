import { useCallback, useEffect, useRef, useState } from "react"

export type HoldReason = "hover" | "menu" | "focus"

export type AutoHideOptions = {
  inactiveHoldMs?: number
  leaveDelayMs?: number
  zonePx?: number
}

const DEFAULT_INACTIVE_HOLD_MS = 3500
const DEFAULT_LEAVE_DELAY_MS = 1200
const DEFAULT_ZONE_PX = 80
const MOVE_EPSILON = 2

function isTextEntryElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  )
}

export function useAutoHideChrome(
  edge: "top" | "bottom",
  enabled: boolean,
  options?: AutoHideOptions,
) {
  const inactiveHoldMs = options?.inactiveHoldMs ?? DEFAULT_INACTIVE_HOLD_MS
  const leaveDelayMs = options?.leaveDelayMs ?? DEFAULT_LEAVE_DELAY_MS
  const zonePx = options?.zonePx ?? DEFAULT_ZONE_PX

  const [visible, setVisible] = useState(true)
  const visibleRef = useRef(true)
  visibleRef.current = visible
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const holdsRef = useRef<Set<HoldReason>>(new Set())
  const inZoneRef = useRef(false)
  const lastPtRef = useRef<{ x: number; y: number } | null>(null)
  const hasMovedSinceRevealRef = useRef(false)
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  const clearTimer = useCallback(() => {
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current)
      timerRef.current = undefined
    }
  }, [])

  const startCountdown = useCallback(
    (delayMs: number = inactiveHoldMs) => {
      clearTimer()
      if (!enabledRef.current || holdsRef.current.size > 0) return
      timerRef.current = setTimeout(() => {
        if (enabledRef.current && holdsRef.current.size === 0) {
          setVisible(false)
        }
      }, delayMs)
    },
    [clearTimer, inactiveHoldMs],
  )

  // Mode changes: windowed = always visible; entering fullscreen = show, then count down dedicated timer
  useEffect(() => {
    holdsRef.current.clear()
    inZoneRef.current = false
    lastPtRef.current = null
    hasMovedSinceRevealRef.current = false
    setVisible(true)
    if (enabled) {
      startCountdown(inactiveHoldMs)
    } else {
      clearTimer()
    }
    return clearTimer
  }, [enabled, startCountdown, clearTimer, inactiveHoldMs])

  const onPointerMove = useCallback(
    (e: { clientX: number; clientY: number }) => {
      if (!enabledRef.current) return
      const prev = lastPtRef.current
      if (!prev) {
        lastPtRef.current = { x: e.clientX, y: e.clientY }
        return
      }
      if (
        Math.abs(e.clientX - prev.x) < MOVE_EPSILON &&
        Math.abs(e.clientY - prev.y) < MOVE_EPSILON
      ) {
        return
      }
      lastPtRef.current = { x: e.clientX, y: e.clientY }
      hasMovedSinceRevealRef.current = true

      const nowInZone =
        edge === "top"
          ? e.clientY <= zonePx
          : e.clientY >= window.innerHeight - zonePx

      const entered = nowInZone && !inZoneRef.current
      const left = !nowInZone && inZoneRef.current
      inZoneRef.current = nowInZone

      if (nowInZone) {
        if (!visibleRef.current || entered) {
          setVisible(true)
        }
        startCountdown(inactiveHoldMs)
      } else if (left) {
        if (visibleRef.current && holdsRef.current.size === 0) {
          startCountdown(leaveDelayMs)
        }
      }
    },
    [edge, startCountdown, zonePx, inactiveHoldMs, leaveDelayMs],
  )

  useEffect(() => {
    if (!enabled) return
    const handleMove = (e: PointerEvent) => {
      onPointerMove(e)
    }
    window.addEventListener("pointermove", handleMove, { passive: true })
    return () => window.removeEventListener("pointermove", handleMove)
  }, [enabled, onPointerMove])

  const hold = useCallback(
    (reason: HoldReason) => {
      holdsRef.current.add(reason)
      clearTimer()
      setVisible(true)
    },
    [clearTimer],
  )

  const release = useCallback(
    (reason: HoldReason) => {
      if (!holdsRef.current.delete(reason)) return
      if (holdsRef.current.size === 0) {
        startCountdown(inZoneRef.current ? inactiveHoldMs : leaveDelayMs)
      }
    },
    [startCountdown, inactiveHoldMs, leaveDelayMs],
  )

  const toggleManual = useCallback(() => {
    if (!enabledRef.current) return
    setVisible((cur) => {
      const next = !cur
      if (next) {
        startCountdown(inactiveHoldMs)
      } else {
        clearTimer()
      }
      return next
    })
  }, [startCountdown, clearTimer, inactiveHoldMs])

  const reveal = useCallback(() => {
    holdsRef.current.delete("hover")
    holdsRef.current.delete("focus")
    inZoneRef.current = false
    lastPtRef.current = null
    hasMovedSinceRevealRef.current = false
    setVisible(true)
    startCountdown(inactiveHoldMs)
  }, [startCountdown, inactiveHoldMs])

  const surfaceProps = {
    onPointerEnter: () => {
      if (hasMovedSinceRevealRef.current) {
        hold("hover")
      }
    },
    onPointerMove: () => {
      if (hasMovedSinceRevealRef.current && !holdsRef.current.has("hover")) {
        hold("hover")
      }
    },
    onPointerLeave: () => release("hover"),
    onFocusCapture: (e: React.FocusEvent<HTMLElement>) => {
      if (isTextEntryElement(e.target)) {
        hold("focus")
      }
    },
    onBlurCapture: (e: React.FocusEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
        release("focus")
      }
    },
  }

  return {
    visible: enabled ? visible : true,
    onPointerMove,
    hold,
    release,
    reveal,
    toggleManual,
    surfaceProps,
  }
}
