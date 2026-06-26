'use client'

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const t = (document.documentElement.dataset.theme as Theme) || 'light'
    setTheme(t)
  }, [])

  function apply(t: Theme) {
    document.documentElement.dataset.theme = t
    document.cookie = `theme=${t}; path=/; max-age=${60 * 60 * 24 * 365}`
    setTheme(t)
  }

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
          <button key={o.key} type="button" onClick={() => apply(o.key)} style={{
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
