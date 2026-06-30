'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { MONTH_NAMES } from '@/lib/format'

export default function MonthNav({ year, month }: { year: number; month: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function go(y: number, m: number) {
    // Remember the chosen month so pages can reopen on it next time.
    document.cookie = `acw_period=${y}-${m}; path=/; max-age=${60 * 60 * 24 * 180}`
    const next = new URLSearchParams(params)
    next.set('y', String(y))
    next.set('m', String(m))
    router.push(`${pathname}?${next.toString()}`)
  }

  const prev = month === 0 ? { y: year - 1, m: 11 } : { y: year, m: month - 1 }
  const next = month === 11 ? { y: year + 1, m: 0 } : { y: year, m: month + 1 }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button onClick={() => go(prev.y, prev.m)} className="btn-ghost" style={navBtn} aria-label="Previous month">‹</button>
      <div className="font-display" style={{ minWidth: 150, textAlign: 'center', fontWeight: 600, fontSize: 15 }}>
        {MONTH_NAMES[month]} {year}
      </div>
      <button onClick={() => go(next.y, next.m)} className="btn-ghost" style={navBtn} aria-label="Next month">›</button>
    </div>
  )
}

const navBtn: React.CSSProperties = { width: 34, height: 34, fontSize: 18, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
