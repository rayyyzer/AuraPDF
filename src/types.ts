export type View = 'dashboard' | 'library' | 'reader' | 'ai' | 'search' | 'settings';
export type ThemeMode = 'system' | 'light' | 'dark' | 'amoled';
export type ColorTheme = 'navy' | 'emerald' | 'moon';
// Legacy aliases kept for migration safety
export type ThemePreference = ThemeMode;
export type AccentColor = ColorTheme;

export type ViewMode = 'single' | 'two-page' | 'continuous';

export interface Doc {
  id: string;
  name: string;
  pages: number;
  size: string;
  lastOpened: string;
  created: string;
  favorite: boolean;
  folder: string;
  tags: string[];
  color: string;
  excerpt: string;
}

export interface Bookmark {
  page: number;
  label: string;
}

export interface TabState {
  doc: Doc;
  page: number;
  zoom: number;
  rotation: number;
  viewMode: ViewMode;
  bookmarks: Bookmark[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
}

export interface Citation {
  page: number;
  excerpt: string;
}

export interface Annotation {
  id: string;
  page: number;
  text: string;
  color: string;
  note?: string;
}
