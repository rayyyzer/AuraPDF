import { useEffect, useState } from "react"

interface Props {
  title: string
  initialName?: string
  submitLabel: string
  onCancel: () => void
  onSubmit: (name: string) => Promise<void>
}

export default function FolderDialog({
  title,
  initialName = "",
  submitLabel,
  onCancel,
  onSubmit,
}: Props) {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const input = document.getElementById(
      "folder-dialog-name",
    ) as HTMLInputElement | null
    input?.focus()
    input?.select()
  }, [])

  async function submit() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError("Enter a folder name.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSubmit(trimmed)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save folder.")
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-[2px] px-4 backdrop-fade"
      onMouseDown={onCancel}
    >
      <form
        className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-2xl modal-pop"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <label
          className="mt-4 block text-xs text-muted-foreground"
          htmlFor="folder-dialog-name"
        >
          Folder name
        </label>
        <input
          id="folder-dialog-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel()
          }}
          disabled={saving}
          className="mt-1.5 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus:border-primary transition-colors"
        />
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Saving..." : submitLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
