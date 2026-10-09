'use server'

import { revalidatePath } from 'next/cache'
import { saveRecord, clearUnassignedTrips } from '@/lib/db'
import { requireProfile, requireOwner } from '@/lib/auth'

// Assign a driver + vehicle to a booking (moves it to "assigned").
export async function assignTrip(formData: FormData) {
  const id = String(formData.get('id') || '')
  if (!id) return
  const driver_id = emptyToNull(formData.get('driver_id'))
  const vehicle_id = emptyToNull(formData.get('vehicle_id'))
  const profile = await requireProfile()
  await saveRecord('trips', {
    driver_id, vehicle_id, status: 'assigned',
    assigned_by: profile.full_name ?? 'Staff',
    assigned_at: new Date().toISOString(),
  }, id)
  revalidatePath('/dispatch')
}

// Move a booking along the workflow (confirmed / enroute / completed / cancelled).
export async function setTripStatus(formData: FormData) {
  await requireProfile()
  const id = String(formData.get('id') || '')
  const status = String(formData.get('status') || '')
  if (!id || !status) return
  await saveRecord('trips', { status }, id)
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
