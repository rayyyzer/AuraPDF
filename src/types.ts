export type View = "dashboard" | "library" | "reader" | "search" | "settings"
export type ThemeMode = "system" | "light" | "dark"
export type ColorTheme = "navy" | "emerald" | "moon" | "ember" | "burgundy"

export type ViewMode = "single" | "two-page" | "continuous" | "two-page-continuous"

export interface Doc {
  id: string
  name: string
  pages: number
  size: string
  lastOpened: string
  created: string
  favorite: boolean
  folder: string
  folderId?: string
  tags: string[]
  color: string
  excerpt: string
  path?: string
  inLibrary?: boolean
}

export interface Bookmark {
  page: number
  label: string
}

export interface TabState {
  doc: Doc
  page: number
  zoom: number
  rotation: number
  viewMode: ViewMode
  bookmarks: Bookmark[]
}
