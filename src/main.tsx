import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import { ErrorBoundary } from "./components/ErrorBoundary"
import "./index.css"

window.addEventListener("error", (event) => {
  console.error("[AURA_GLOBAL_ERROR]", event.error || event.message)
})

window.addEventListener("unhandledrejection", (event) => {
  console.error("[AURA_UNHANDLED_REJECTION]", event.reason)
})

// Prevent WebView2 native page zoom (Ctrl/Meta + wheel or zoom hotkeys) from
// scaling the application shell chrome; PdfReader handles zoom natively inside
// the document viewport without stopping propagation.
window.addEventListener(
  "wheel",
  (event) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
    }
  },
  { capture: true, passive: false },
)

const preventBrowserPinchZoom = (event: TouchEvent) => {
  if (event.touches.length >= 2) {
    event.preventDefault()
  }
}

window.addEventListener("touchstart", preventBrowserPinchZoom, {
  capture: true,
  passive: false,
})

window.addEventListener("touchmove", preventBrowserPinchZoom, {
  capture: true,
  passive: false,
})

window.addEventListener(
  "keydown",
  (event) => {
    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const isZoomKey =
        ["=", "+", "-", "_", "0"].includes(event.key) ||
        ["Equal", "Minus", "Digit0", "NumpadAdd", "NumpadSubtract", "Numpad0"].includes(
          event.code,
        )
      if (isZoomKey) {
        event.preventDefault()
      }
    }
  },
  { capture: true },
)

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

