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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)

