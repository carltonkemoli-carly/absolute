// KES currency + date helpers used across the app.

export function kes(amount: number | null | undefined): string {
  const n = Number(amount ?? 0)
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0,
  }).format(n)
}

export function kesPlain(amount: number | null | undefined): string {
  const n = Number(amount ?? 0)
  return new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 }).format(n)
}

// Format a timestamp like "Thu 25 Jun · 09:00"
export function fmtDateTime(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleString('en-KE', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function fmtTime(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
}

// Kenyan number → international digits for wa.me (0712… → 254712…)
export function waNumber(phone: string | null | undefined): string {
  const digits = String(phone ?? '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('254')) return digits
  if (digits.startsWith('0')) return '254' + digits.slice(1)
  if (digits.startsWith('7') || digits.startsWith('1')) return '254' + digits
  return digits
}

export function fmtDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// First and last day of a month, as YYYY-MM-DD strings (for date filters)
export function monthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, month, 1))
  const end = new Date(Date.UTC(year, month + 1, 0))
  return { start: isoDate(start), end: isoDate(end) }
}

export function isoDate(d: Date): string {
  // Local date parts (not UTC) so a day never shifts under +/- timezones.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Shift a date by whole days, staying on local calendar parts (so "in 30 days"
// lands on the right day rather than drifting with millisecond arithmetic).
export function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)
}

// Resolve ?y= & ?m= search params into a year/month, defaulting to current month.
export function resolvePeriod(y?: string, m?: string): { year: number; month: number } {
  const now = new Date()
  let year = y ? parseInt(y, 10) : now.getFullYear()
  let month = m !== undefined && m !== '' ? parseInt(m, 10) : now.getMonth()
  if (!Number.isFinite(year)) year = now.getFullYear()
  if (!Number.isFinite(month) || month < 0 || month > 11) month = now.getMonth()
  return { year, month }
}

// ---- Quarters ----
export function quarterOf(month: number): number {
  return Math.floor(month / 3) + 1 // month 0-11 → quarter 1-4
}
export function quarterRange(year: number, quarter: number): { start: string; end: string } {
  const m0 = (quarter - 1) * 3
  return { start: monthRange(year, m0).start, end: monthRange(year, m0 + 2).end }
}
export function periodKey(year: number, quarter: number): string {
  return `${year}-Q${quarter}`
}
export function quarterLabel(year: number, quarter: number): string {
  return `Q${quarter} ${year}`
}
export function resolveQuarter(y?: string, q?: string): { year: number; quarter: number } {
  const now = new Date()
  let year = y ? parseInt(y, 10) : now.getFullYear()
  let quarter = q ? parseInt(q, 10) : quarterOf(now.getMonth())
  if (!Number.isFinite(year)) year = now.getFullYear()
  if (!Number.isFinite(quarter) || quarter < 1 || quarter > 4) quarter = quarterOf(now.getMonth())
  return { year, quarter }
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
