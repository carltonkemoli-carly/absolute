// A rate-card estimate may prefill a booking, but never creates a trip itself.
// The URL carries only public route and price choices, not customer information.
export type QuoteClass = 'saloon' | 'wagon' | 'van' | 'bus'
type Query = Record<string, string | string[] | undefined>
type RateRoute = {
  id: string; pickup: string; dropoff: string
  price_saloon: number; price_wagon: number; price_van: number; price_bus: number
}
export type BookingDraft = {
  date: string; pickup: string; dropoff: string; amount: number
  toll: number; notes: string
}

const classes: QuoteClass[] = ['saloon', 'wagon', 'van', 'bus']
const tolls = [0, 250, 330, 410]

function validDate(date: string): boolean {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(date)) return false
  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

export function quoteDraftHref(input: { routeId: string; vehicleClass: QuoteClass; toll: number; extras: number; date: string }): string | null {
  if (!input.routeId || input.routeId.length > 64 || !classes.includes(input.vehicleClass) || !tolls.includes(input.toll) ||
      !Number.isSafeInteger(input.extras) || input.extras < 0 || input.extras > 1_000_000 || !validDate(input.date)) return null
  const params = new URLSearchParams({
    quote: '1', r: input.routeId, c: input.vehicleClass, t: String(input.toll), e: String(input.extras), d: input.date,
    y: input.date.slice(0, 4), m: String(Number(input.date.slice(5, 7)) - 1),
  })
  return `/trips?${params.toString()}`
}

export function parseQuoteDraft(query: Query, routes: RateRoute[]): BookingDraft | null {
  const scalar = (key: string) => typeof query[key] === 'string' ? query[key] as string : ''
  if (scalar('quote') !== '1') return null
  const route = routes.find((item) => item.id === scalar('r'))
  const vehicleClass = scalar('c') as QuoteClass
  const date = scalar('d')
  const toll = Number(scalar('t'))
  const extras = Number(scalar('e'))
  if (!route || !classes.includes(vehicleClass) || !validDate(date) || !tolls.includes(toll) ||
      !Number.isSafeInteger(extras) || extras < 0 || extras > 1_000_000) return null
  const base = Number(route[`price_${vehicleClass}`])
  const amount = base + toll + extras
  if (!Number.isSafeInteger(base) || base <= 0 || base > 100_000_000 || !Number.isSafeInteger(amount)) return null
  const notes = `Rate card draft: ${vehicleClass}; fare KES ${base}; toll KES ${toll}; other charge KES ${extras}. Check rate and availability before confirming.`
  return { date, pickup: route.pickup, dropoff: route.dropoff, amount, toll, notes }
}
