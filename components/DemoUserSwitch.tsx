'use client'

import { setDemoUser } from '@/lib/demo-actions'

// Demo-only persona switcher: CEO (full access) vs Rachel (office, no finance).
export default function DemoUserSwitch({ activeRole }: { activeRole: string }) {
  const isCeo = activeRole === 'owner'
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink3)', marginBottom: 6 }}>
        Demo — viewing as
      </div>
      <div style={{ display: 'flex', gap: 6, background: 'var(--surface2)', padding: 3, borderRadius: 9 }}>
        <form action={setDemoUser.bind(null, 'ceo')} style={{ flex: 1 }}>
          <button type="submit" style={tab(isCeo)}>CEO</button>
        </form>
        <form action={setDemoUser.bind(null, 'rachel')} style={{ flex: 1 }}>
          <button type="submit" style={tab(!isCeo)}>Rachel</button>
        </form>
      </div>
    </div>
  )
}

function tab(active: boolean): React.CSSProperties {
  return {
    width: '100%', padding: '6px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: 'none', borderRadius: 7,
    background: active ? 'var(--surface)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--ink2)',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
  }
}
