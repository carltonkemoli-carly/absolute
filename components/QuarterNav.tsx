'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

export default function QuarterNav({ year, quarter }: { year: number; quarter: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function go(y: number, q: number) {
    const next = new URLSearchParams(params)
    next.set('y', String(y))
    next.set('q', String(q))
    router.push(`${pathname}?${next.toString()}`)
  }

  const prev = quarter === 1 ? { y: year - 1, q: 4 } : { y: year, q: quarter - 1 }
  const nxt = quarter === 4 ? { y: year + 1, q: 1 } : { y: year, q: quarter + 1 }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button onClick={() => go(prev.y, prev.q)} className="btn-ghost" style={navBtn} aria-label="Previous quarter">‹</button>
      <div className="font-display" style={{ minWidth: 110, textAlign: 'center', fontWeight: 600, fontSize: 15 }}>Q{quarter} {year}</div>
      <button onClick={() => go(nxt.y, nxt.q)} className="btn-ghost" style={navBtn} aria-label="Next quarter">›</button>
    </div>
  )
}

const navBtn: React.CSSProperties = { width: 34, height: 34, fontSize: 18, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
