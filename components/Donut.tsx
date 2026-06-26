'use client'

import { useId } from 'react'

export type Slice = { label: string; value: number; color: string }

// A clean animated donut chart (SVG, no dependencies). Apple-ish: soft, rounded
// caps, a draw-in animation, and a center total.
export default function Donut({
  data, size = 168, thickness = 18, centerLabel, centerValue,
}: { data: Slice[]; size?: number; thickness?: number; centerLabel?: string; centerValue?: string }) {
  const uid = useId()
  const total = data.reduce((a, s) => a + Math.max(0, s.value), 0)
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const cx = size / 2

  let offset = 0
  const segs = total > 0 ? data.filter((s) => s.value > 0).map((s) => {
    const frac = s.value / total
    const seg = { ...s, len: frac * c, dash: offset, frac }
    offset += frac * c
    return seg
  }) : []

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--surface2)" strokeWidth={thickness} />
        <g transform={`rotate(-90 ${cx} ${cx})`}>
          {segs.map((s, i) => (
            <circle
              key={i} cx={cx} cy={cx} r={r} fill="none"
              stroke={s.color} strokeWidth={thickness} strokeLinecap="round"
              strokeDasharray={`${Math.max(0, s.len - 2)} ${c}`}
              strokeDashoffset={-s.dash}
              style={{ animation: `donutIn 0.7s cubic-bezier(0.22,1,0.36,1) ${i * 0.08}s both` }}
            >
              <animate attributeName="opacity" from="0" to="1" dur="0.4s" begin={`${i * 0.08}s`} fill="freeze" />
            </circle>
          ))}
        </g>
        {(centerValue || centerLabel) && (
          <text x={cx} y={cx} textAnchor="middle">
            {centerValue && <tspan x={cx} dy="-2" style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, fill: 'var(--ink)' }}>{centerValue}</tspan>}
            {centerLabel && <tspan x={cx} dy="18" style={{ fontSize: 11, fill: 'var(--ink3)' }}>{centerLabel}</tspan>}
          </text>
        )}
      </svg>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 120 }}>
        {data.filter((s) => s.value > 0).map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1, color: 'var(--ink2)' }}>{s.label}</span>
            <span style={{ fontWeight: 600 }}>{total > 0 ? Math.round((s.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
      <style>{`@keyframes donutIn-${uid.replace(/[:]/g,'')} {} @keyframes donutIn { from { stroke-dashoffset: ${c}; opacity: 0 } }`}</style>
    </div>
  )
}
