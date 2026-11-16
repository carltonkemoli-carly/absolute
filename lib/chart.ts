// Pure chart helpers — safe to use from both server and client components
// (kept out of the 'use client' SegmentDonut module).

export type Seg = { label: string; value: number; color: string }

// Shared multi-category data palette. The values are CSS variables defined in
// globals.css so the same chart reads correctly in light and dark.
export const CHART_COLORS = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)',
  'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)', 'var(--chart-8)',
]

// The only colours that carry meaning: done/healthy, needs a look, overdue/broken.
export const STATUS_COLORS = {
  good: 'var(--chart-good)',
  warn: 'var(--chart-warn)',
  bad: 'var(--chart-bad)',
  neutral: 'var(--chart-8)',
} as const

// Collapse a long list into the top-N categories plus a muted "Others" slice —
// keeps donuts readable when there are many items.
export function topSegments(
  items: { label: string; value: number }[],
  max = 6,
  colors: string[] = CHART_COLORS,
): Seg[] {
  const sorted = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value)
  const segs: Seg[] = sorted.slice(0, max).map((i, idx) => ({ label: i.label, value: i.value, color: colors[idx % colors.length] }))
  const rest = sorted.slice(max)
  if (rest.length) segs.push({ label: `Others (${rest.length})`, value: rest.reduce((s, i) => s + i.value, 0), color: 'var(--ink3)' })
  return segs
}
