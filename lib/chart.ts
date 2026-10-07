// Pure chart helpers — safe to use from both server and client components
// (kept out of the 'use client' SegmentDonut module).

export type Seg = { label: string; value: number; color: string }

// Shared multi-category data palette (colour lives in the data; chrome neutral).
export const CHART_COLORS = ['#2C7A53', '#C9A227', '#2F9E8F', '#BC3E22', '#3E7CB1', '#7A5FB0', '#D98A3D', '#9A6A4B']

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
