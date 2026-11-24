'use server'

import { revalidatePath } from 'next/cache'
import { saveRecord, deleteRecord, updateTrips } from '@/lib/db'
import { requireOperations } from '@/lib/auth'

// Fast per-trip attribution from the Trips table (who actually drove, in which
// car). Powers real per-vehicle / per-driver analytics as coverage grows.
export async function attributeTrip(id: string, vehicleId: string | null, driverId: string | null) {
  await requireOperations()
  if (!id) return
  const result = await saveRecord('trips', { vehicle_id: vehicleId, driver_id: driverId }, id)
  if (result.error) throw new Error(result.error)
  revalidatePath('/trips')
  revalidatePath('/insights')
  revalidatePath('/payback')
  revalidatePath('/')
}

const TRIP_STATUSES = ['booked', 'assigned', 'dispatched', 'confirmed', 'enroute', 'completed', 'cancelled']
const MAX_BULK = 500

function cleanIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  return Array.from(new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 64))).slice(0, MAX_BULK)
}
function revalidateTrips() {
  for (const path of ['/trips', '/dispatch', '/insights', '/payback', '/']) revalidatePath(path)
}

// Tag many trips with who drove and in which vehicle. Only the fields given are
// changed, so choosing just a driver leaves each trip's vehicle as it was.
export async function bulkAssignTrips(ids: string[], vehicleId: string | null, driverId: string | null): Promise<{ updated: number }> {
  await requireOperations()
  const selected = cleanIds(ids)
  const patch: Record<string, string> = {}
  if (typeof vehicleId === 'string' && vehicleId) patch.vehicle_id = vehicleId
  if (typeof driverId === 'string' && driverId) patch.driver_id = driverId
  if (!selected.length || !Object.keys(patch).length) throw new Error('Select trips and choose a driver or a vehicle.')
  const result = await updateTrips(selected, patch)
  revalidateTrips()
  if (result.error) throw new Error(result.updated ? `${result.error} ${result.updated} of ${selected.length} trips were saved before that.` : result.error)
  return { updated: result.updated }
}

// Mark many trips completed in one go, e.g. imported bookings that have run.
// Completed is the only bulk status: it is what turns a booking into revenue,
// and the other steps are worked job by job in Dispatch.
export async function bulkCompleteTrips(ids: string[]): Promise<{ updated: number }> {
  await requireOperations()
  const selected = cleanIds(ids)
  if (!selected.length) throw new Error('Select at least one trip.')
  const result = await updateTrips(selected, { status: 'completed' })
  revalidateTrips()
  if (result.error) throw new Error(result.updated ? `${result.error} ${result.updated} of ${selected.length} trips were saved before that.` : result.error)
  return { updated: result.updated }
}

export async function saveTrip(formData: FormData) {
  await requireOperations()
  const id = String(formData.get('id') || '')
  const row = {
    trip_date: String(formData.get('trip_date') || '').trim(),
    client_name: String(formData.get('client_name') || '').trim(),
    slip_no: emptyToNull(formData.get('slip_no')),
    pickup: emptyToNull(formData.get('pickup')),
    pickup_time: emptyToNull(formData.get('pickup_time')),
    dropoff: emptyToNull(formData.get('dropoff')),
    notes: emptyToNull(formData.get('notes')),
    express_charges: num(formData.get('express_charges')),
    voucher_no: emptyToNull(formData.get('voucher_no')),
    organization_id: emptyToNull(formData.get('organization_id')),
    contractor_id: emptyToNull(formData.get('contractor_id')),
    vehicle_id: emptyToNull(formData.get('vehicle_id')),
    driver_id: emptyToNull(formData.get('driver_id')),
    amount: num(formData.get('amount')),
    hire_cost: num(formData.get('hire_cost')),
    payment: String(formData.get('payment') || 'account'),
    status: String(formData.get('status') || 'booked'),
  }
  if (!isCalendarDate(row.trip_date) || !row.client_name || row.client_name.length > 120) throw new Error('Enter a valid trip date and client name.')
  if (!TRIP_STATUSES.includes(row.status)) throw new Error('Choose a valid trip status.')
  if (!['account', 'cash'].includes(row.payment)) throw new Error('Choose a valid payment type.')
  if (row.express_charges > row.amount) throw new Error('Expressway tolls cannot exceed the trip amount.')
  const result = await saveRecord('trips', row, id || null)
  if (result.error) throw new Error(result.error)
  revalidatePath('/trips')
  revalidatePath('/')
}

export async function deleteTrip(formData: FormData) {
  await requireOperations()
  const id = String(formData.get('id') || '')
  if (id) await deleteRecord('trips', id)
  revalidatePath('/trips')
  revalidatePath('/')
}

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}
function num(v: FormDataEntryValue | null): number {
  const raw = String(v ?? '').trim()
  if (!raw) return 0
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0 || n > 100_000_000) throw new Error('Enter a valid non-negative amount in KES.')
  return n
}

function isCalendarDate(value: string): boolean {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}
