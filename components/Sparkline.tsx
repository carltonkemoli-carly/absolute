// A small trend line for a stat card: a handful of values, no axes, the last
// point marked. It stretches to the width of whatever holds it. The baseline is
// always zero so the shape is honest about size, and a faint zero line appears
// when the series dips below it. When the last value covers a period that is
// still running, pass `partial`: the final stretch is dashed and its dot hollow,
// so a month in progress does not read as a collapse.
export default function Sparkline({
  values, color = 'var(--accent)', height = 30, label, partial = false,
}: {
  values: number[]; color?: string; height?: number; label?: string; partial?: boolean
}) {
  if (values.length < 2 || values.every((v) => v === 0)) return <div style={{ height }} aria-hidden="true" />

  const W = 100 // viewBox width; the SVG is stretched, strokes are not
  const pad = 3
  const lo = Math.min(0, ...values)
  const hi = Math.max(0, ...values)
  const span = hi - lo || 1
  const r2 = (n: number) => Math.round(n * 100) / 100
  const x = (i: number) => r2((i / (values.length - 1)) * W)
  const y = (v: number) => r2(height - pad - ((v - lo) / span) * (height - pad * 2))

  const path = (from: number, to: number) =>
    values.slice(from, to + 1).map((v, i) => `${i === 0 ? 'M' : 'L'}${x(from + i)} ${y(v)}`).join(' ')
  const last = values.length - 1
  const line = path(0, last)
  const area = `${line} L${W} ${y(0)} L0 ${y(0)} Z`
  const lastY = y(values[last])
  const stroke = { fill: 'none', strokeWidth: 1.75, strokeLinejoin: 'round', strokeLinecap: 'round', vectorEffect: 'non-scaling-stroke' } as const

  return (
    <div role="img" aria-label={label ?? 'Trend'} style={{ position: 'relative', height, marginRight: 4 }}>
      <svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
        {lo < 0 && <line x1="0" x2={W} y1={y(0)} y2={y(0)} style={{ stroke: 'var(--border-med)' }} strokeWidth="1" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />}
        <path d={area} style={{ fill: color, opacity: 0.11 }} />
        <path d={partial ? path(0, last - 1) : line} {...stroke} style={{ stroke: color }} />
        {partial && <path d={path(last - 1, last)} {...stroke} strokeDasharray="3 3" style={{ stroke: color }} />}
      </svg>
      {/* The end point is drawn in HTML so it stays round while the line stretches. */}
      <span style={{
        position: 'absolute', right: -4, top: lastY - 4, width: 8, height: 8, borderRadius: 99, boxSizing: 'border-box',
        background: partial ? 'var(--surface)' : color, border: partial ? `2px solid ${color}` : '1.5px solid var(--surface)',
      }} />
    </div>
  )
}
