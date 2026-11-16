// Conservative reservation until explicit end times are collected: two hours
// from pickup, or the entire Nairobi calendar day when pickup time is unknown.
//
// A job holds its driver and vehicle only while it is still to be done. Once it
// is completed (or cancelled) it is history: a record of who drove, not a claim
// on anyone's time. Without this, a driver could be tagged on only one finished
// trip per day whenever pickup times were not recorded, which is most imported
// history — and that tagging is what the per-vehicle figures are built from.
export const releasesResources = (status: string): boolean => status === 'cancelled' || status === 'completed'
export type Reservation = { id?: string; trip_date: string; pickup_time?: string | null; status: string; driver_id?: string | null; vehicle_id?: string | null }
export function reservationWindow(t: Reservation): [number, number] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.trip_date)) throw new Error('Invalid trip date')
  const time = t.pickup_time || null
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Pickup time must be HH:MM')
  const start = Date.parse(`${t.trip_date}T${time ?? '00:00'}:00+03:00`)
  if (!Number.isFinite(start)) throw new Error('Invalid trip date')
  return [start, start + (time ? 2 : 24) * 3600000]
}
export function assertNoDispatchOverlap(candidate: Reservation, trips: Reservation[]) {
  const [start, end] = reservationWindow(candidate)
  if (releasesResources(candidate.status) || (!candidate.driver_id && !candidate.vehicle_id)) return
  for (const t of trips) {
    if (t.id === candidate.id || releasesResources(t.status)) continue
    if (!(candidate.driver_id && candidate.driver_id === t.driver_id) && !(candidate.vehicle_id && candidate.vehicle_id === t.vehicle_id)) continue
    const [otherStart, otherEnd] = reservationWindow(t)
    if (start < otherEnd && otherStart < end) throw new Error('Driver or vehicle has an overlapping trip. Choose another resource or pickup time.')
  }
}
