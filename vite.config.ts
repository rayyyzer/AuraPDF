import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "node:path"

// Vite config — https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const emitSourcemaps = mode === "development"
  const port = parseInt(process.env.PORT || "8443", 10)
  const host = process.env.VITE_HOST || "localhost"

  return {
    base: "/",
    build: {
      target: "es2022",
      sourcemap: emitSourcemaps ? "inline" : false,
      minify: !emitSourcemaps,
      cssMinify: true,
      reportCompressedSize: false,
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
    server: {
      host,
      port,
      strictPort: true,
      watch: {
        ignored: ["**/src-tauri/**"],
      },
    },
    preview: {
      host,
      port,
    },
  }
})
