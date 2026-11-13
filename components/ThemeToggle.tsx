'use client'

import { useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark'

const THEME_EVENT = 'absolute-comfort-theme-change'
function subscribeTheme(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange)
  return () => window.removeEventListener(THEME_EVENT, onChange)
}
function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}
function setThemePreference(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.cookie = `theme=${theme}; path=/; max-age=${60 * 60 * 24 * 365}`
  window.dispatchEvent(new Event(THEME_EVENT))
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => 'light')

  const options: { key: Theme; label: string; icon: string }[] = [
    { key: 'light', label: 'Light', icon: '☀' },
    { key: 'dark', label: 'Dark', icon: '☾' },
  ]

  return (
    <div style={{
      position: 'relative', display: 'inline-flex', padding: 4, gap: 4,
      background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
    }}>
      {/* sliding indicator */}
      <div style={{
        position: 'absolute', top: 4, bottom: 4, width: 'calc(50% - 4px)',
        left: theme === 'light' ? 4 : 'calc(50%)',
        background: 'var(--surface)', borderRadius: 'calc(var(--radius-sm) - 3px)',
        boxShadow: 'var(--shadow-sm)', transition: 'left .28s var(--ease)',
      }} />
      {options.map((o) => {
        const active = theme === o.key
        return (
          <button key={o.key} type="button" onClick={() => setThemePreference(o.key)} style={{
            position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 7,
            padding: '8px 18px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: 13.5, fontWeight: 600, fontFamily: 'var(--font-body)',
            color: active ? 'var(--accent)' : 'var(--ink2)', transition: 'color .2s var(--ease)',
          }}>
            <span style={{ fontSize: 14 }}>{o.icon}</span>{o.label}
          </button>
        )
      })}
    </div>
  )
}
