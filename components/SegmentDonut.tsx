'use client'

import { useId } from 'react'
import { kes } from '@/lib/format'

export type Seg = { label: string; value: number; color: string }

// A segmented donut with a big center total and — optionally — small numbered
// badges sitting on the ring at each segment (the "168 Total / 118 Working"
// look). Neutral chrome, colour lives entirely in the data. SVG, no deps.
export default function SegmentDonut({
  data,
  centerValue,
  centerLabel,
  badges = false,
  size = 216,
  thickness = 15,
  centerSize = 30,
  money = false,
}: {
  data: Seg[]
  centerValue: string
  centerLabel?: string
  badges?: boolean
  size?: number
  thickness?: number
  centerSize?: number
  money?: boolean
}) {
  const format = (n: number) => (money ? kes(n) : String(n))
  const uid = useId().replace(/[:]/g, '')
  const anim = `segIn_${uid}`
  const shown = data.filter((s) => s.value > 0)
  const total = shown.reduce((a, s) => a + s.value, 0)

  const cx = size / 2
  const r = size / 2 - thickness / 2 - (badges ? 15 : 4)
  const c = 2 * Math.PI * r
  const gap = shown.length > 1 ? 10 : 0

  let acc = 0
  const segs = shown.map((s) => {
    const frac = s.value / total
    const startFrac = acc
    acc += frac
    // Badge sits at the segment's mid-angle, measured from the top (−90°).
    const midAngle = (startFrac + frac / 2) * 2 * Math.PI - Math.PI / 2
    return {
      ...s, frac, startFrac,
      len: Math.max(0.5, frac * c - gap),
      offset: startFrac * c,
      bx: cx + r * Math.cos(midAngle),
      by: cx + r * Math.sin(midAngle),
    }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--surface2)" strokeWidth={thickness} />
          <g transform={`rotate(-90 ${cx} ${cx})`}>
            {segs.map((s, i) => (
              <circle
                key={i} cx={cx} cy={cx} r={r} fill="none"
                stroke={s.color} strokeWidth={thickness} strokeLinecap="round"
                strokeDasharray={`${s.len} ${c}`} strokeDashoffset={-s.offset}
                style={{ animation: `${anim} .7s var(--ease) ${i * 0.09}s both` }}
              />
            ))}
          </g>
          <text x={cx} y={cx} textAnchor="middle">
            <tspan x={cx} dy={centerLabel ? '-2' : '6'} style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: centerSize, fill: 'var(--ink)' }}>{centerValue}</tspan>
            {centerLabel && <tspan x={cx} dy="20" style={{ fontSize: 12, fill: 'var(--ink3)', letterSpacing: '0.02em' }}>{centerLabel}</tspan>}
          </text>
        </svg>

        {badges && segs.map((s, i) => (
          <span key={i} title={`${s.label}: ${format(s.value)}`}
            style={{
              position: 'absolute', left: s.bx, top: s.by, transform: 'translate(-50%, -50%)',
              minWidth: 30, height: 30, padding: '0 6px', borderRadius: 999,
              background: 'var(--surface)', border: `2px solid ${s.color}`, color: s.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-display)',
              boxShadow: 'var(--shadow-sm)',
            }}>
            {format(s.value)}
          </span>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: shown.length > 3 ? '1fr 1fr' : '1fr', gap: '6px 18px', width: '100%' }}>
        {segs.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1, color: 'var(--ink2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
            <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{format(s.value)}</span>
            <span style={{ color: 'var(--ink3)', fontSize: 12, width: 34, textAlign: 'right' }}>{Math.round(s.frac * 100)}%</span>
          </div>
        ))}
      </div>

      <style>{`@keyframes ${anim} { from { stroke-dashoffset: ${c}; opacity: 0 } to { opacity: 1 } }`}</style>
    </div>
  )
}
