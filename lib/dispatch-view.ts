import type { Trip, TripStatus } from '@/lib/types'

export const DISPATCH_STAGES: readonly TripStatus[] = ['booked', 'assigned', 'dispatched', 'confirmed', 'enroute', 'completed']
export type DispatchStatusFilter = 'all' | 'active' | TripStatus
const STAGE_ORDER: Record<TripStatus, number> = { booked: 0, assigned: 1, dispatched: 2, confirmed: 3, enroute: 4, completed: 5, cancelled: 6 }

export function filterDispatchTrips(
  trips: readonly Trip[], query: string, status: DispatchStatusFilter,
  lookupText: (trip: Trip) => string = () => '',
): Trip[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return trips.filter(trip => {
    if (status === 'active' && ['completed', 'cancelled'].includes(trip.status)) return false
    if (status !== 'all' && status !== 'active' && trip.status !== status) return false
    const text = [trip.client_name, trip.pickup, trip.dropoff, trip.slip_no, trip.voucher_no, trip.flight_no, lookupText(trip)].filter(Boolean).join(' ').toLocaleLowerCase()
    return terms.every(term => text.includes(term))
  }).sort((a, b) => STAGE_ORDER[a.status] - STAGE_ORDER[b.status]
    || (a.pickup_time || '99:99').localeCompare(b.pickup_time || '99:99')
    || (a.flight_time || '').localeCompare(b.flight_time || '')
    || a.client_name.localeCompare(b.client_name))
}

export function dispatchColumns(trips: readonly Trip[], filter: DispatchStatusFilter): TripStatus[] {
  if (filter !== 'all' && filter !== 'active') return [filter]
  if (filter === 'active') return [...DISPATCH_STAGES].filter(status => status !== 'completed')
  return [...DISPATCH_STAGES, ...(trips.some(trip => trip.status === 'cancelled') ? ['cancelled' as const] : [])]
}
