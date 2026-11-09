export function formatFileSize(value: string | number): string {
  const bytes = typeof value === "number" ? value : Number(value)

  if (!Number.isFinite(bytes) || bytes <= 0) return "Size unavailable"

  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`

  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function formatLastOpened(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  const now = new Date()

  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime()

  const day = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime()

  const days = Math.round((start - day) / 86400000)

  if (days <= 0) return "Today"

  if (days === 1) return "Yesterday"

  if (days < 7) return `${days} days ago`

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}
