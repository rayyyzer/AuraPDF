import type { ColorTheme, ThemeMode } from './types';

export type Palette = {
  background: string;
  card: string;
  secondary: string;
  muted: string;
  foreground: string;
  mutedForeground: string;
  border: string;
  primary: string;
  ring: string;
};

export type ColorThemeDef = {
  label: string;
  dark: Palette;
  amoled: Palette;
  light: Palette;
  previewBg: string;
  previewSurface: string;
  previewAccent: string;
};

const NAVY: ColorThemeDef = {
  label: 'Navy Mirage',
  previewBg: '#0B111A',
  previewSurface: '#141E30',
  previewAccent: '#35577D',
  dark: {
    background: '#0F1722',
    card: '#141E30',
    secondary: '#1B293D',
    muted: '#22344C',
    foreground: '#E8EDF3',
    mutedForeground: '#718093',
    border: '#263548',
    primary: '#35577D',
    ring: '#35577D',
  },
  amoled: {
    background: '#0B111A',
    card: '#0F1722',
    secondary: '#141E30',
    muted: '#1B293D',
    foreground: '#E8EDF3',
    mutedForeground: '#718093',
    border: '#1C2A3A',
    primary: '#3E6490',
    ring: '#3E6490',
  },
  light: {
    background: '#F0F4F8',
    card: '#FFFFFF',
    secondary: '#E4ECF4',
    muted: '#D8E6F0',
    foreground: '#0F1C2E',
    mutedForeground: '#5B7A99',
    border: '#C8DAEC',
    primary: '#2D5070',
    ring: '#2D5070',
  },
};

const EMERALD: ColorThemeDef = {
  label: 'Emerald Depth',
  previewBg: '#07120E',
  previewSurface: '#0F2027',
  previewAccent: '#28623A',
  dark: {
    background: '#0A1914',
    card: '#0F2027',
    secondary: '#142A25',
    muted: '#1A352D',
    foreground: '#E6EEE9',
    mutedForeground: '#71847A',
    border: '#223A31',
    primary: '#28623A',
    ring: '#28623A',
  },
  amoled: {
    background: '#07120E',
    card: '#0A1914',
    secondary: '#0F2027',
    muted: '#142A25',
    foreground: '#E6EEE9',
    mutedForeground: '#71847A',
    border: '#18302A',
    primary: '#2E7043',
    ring: '#2E7043',
  },
  light: {
    background: '#EEF6F1',
    card: '#FFFFFF',
    secondary: '#DCF0E5',
    muted: '#CEE8DA',
    foreground: '#0A1F14',
    mutedForeground: '#527A63',
    border: '#B8DCCA',
    primary: '#1F5730',
    ring: '#1F5730',
  },
};

const MOON: ColorThemeDef = {
  label: 'Moon',
  previewBg: '#140A1F',
  previewSurface: '#2A1440',
  previewAccent: '#6667AB',
  dark: {
    background: '#210F35',
    card: '#2A1440',
    secondary: '#351A4C',
    muted: '#3D2056',
    foreground: '#F0E8F0',
    mutedForeground: '#827287',
    border: '#432A50',
    primary: '#6667AB',
    ring: '#6667AB',
  },
  amoled: {
    background: '#140A1F',
    card: '#1C0E2C',
    secondary: '#251238',
    muted: '#2E1744',
    foreground: '#F0E8F0',
    mutedForeground: '#827287',
    border: '#341E40',
    primary: '#7172BF',
    ring: '#7172BF',
  },
  light: {
    background: '#F3EFF8',
    card: '#FFFFFF',
    secondary: '#EAE2F4',
    muted: '#E0D6EE',
    foreground: '#1A0A2E',
    mutedForeground: '#7A6890',
    border: '#CBBCE0',
    primary: '#5354A0',
    ring: '#5354A0',
  },
};

export const COLOR_THEMES: Record<ColorTheme, ColorThemeDef> = {
  navy: NAVY,
  emerald: EMERALD,
  moon: MOON,
};

// Legacy compat: used by Settings accent swatch renderer
export const ACCENT_COLORS = COLOR_THEMES;

export function getPalette(mode: ThemeMode, colorTheme: ColorTheme): Palette {
  const theme = COLOR_THEMES[colorTheme];
  if (mode === 'amoled') return theme.amoled;
  if (mode === 'dark') return theme.dark;
  if (mode === 'light') return theme.light;
  const sysDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return sysDark ? theme.dark : theme.light;
}

export function isDarkMode(mode: ThemeMode): boolean {
  if (mode === 'dark' || mode === 'amoled') return true;
  if (mode === 'light') return false;
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}
