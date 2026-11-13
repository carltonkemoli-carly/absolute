'use server'

import { revalidatePath } from 'next/cache'
import { saveRecord, clearUnassignedTrips } from '@/lib/db'
import { requireOperations, requireOwner } from '@/lib/auth'

// Assign a driver + vehicle to a booking (moves it to "assigned").
export async function assignTrip(_state: { error: string | null }, formData: FormData) {
  const id = String(formData.get('id') || '')
  if (!id) return { error: 'Trip not found' }
  const driver_id = emptyToNull(formData.get('driver_id'))
  const vehicle_id = emptyToNull(formData.get('vehicle_id'))
  const profile = await requireOperations()
  if (!driver_id || !vehicle_id) return { error: 'Choose a driver and vehicle' }
  const result = await saveRecord('trips', {
    driver_id, vehicle_id, status: 'assigned',
    assigned_by: profile.full_name ?? 'Staff',
    assigned_at: new Date().toISOString(),
  }, id)
  if (result.error) return { error: result.error }
  revalidatePath('/dispatch')
  return { error: null }
}

// Move a booking along the workflow (confirmed / enroute / completed / cancelled).
export async function setTripStatus(formData: FormData) {
  await requireOperations()
  const id = String(formData.get('id') || '')
  const status = String(formData.get('status') || '')
  if (!id || !['booked','assigned','dispatched','confirmed','enroute','completed','cancelled'].includes(status)) throw new Error('Invalid trip status')
  const result = await saveRecord('trips', { status, ...(status === 'booked' ? { driver_id: null, vehicle_id: null, assigned_at: null, assigned_by: null } : {}) }, id)
  if (result.error) throw new Error(result.error)
  revalidatePath('/dispatch')
  revalidatePath('/trips')
}

// Wipe all still-unassigned bookings (e.g. to clear out a bad/duplicate import).
export async function clearPendingTrips() {
  // Deletes every unassigned trip in the database — owner only.
  await requireOwner()
  const n = await clearUnassignedTrips()
  revalidatePath('/dispatch')
  revalidatePath('/trips')
  return n
}

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}
