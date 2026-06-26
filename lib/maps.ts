// Google Maps helpers.
//
// 1) googleMapsDirUrl — builds a public Google Maps directions link (NO API key
//    needed). Lets staff eyeball whether a route is sensible.
// 2) googleDistance — calls the Google Distance Matrix API to get the real
//    driving distance/time. Requires GOOGLE_MAPS_API_KEY in the environment;
//    returns { error } when the key is missing so the UI can fall back to
//    manual entry.

const REGION_HINT = ', Nairobi, Kenya'

export function googleMapsDirUrl(pickup: string, dropoff: string): string {
  const o = encodeURIComponent(pickup + REGION_HINT)
  const d = encodeURIComponent(dropoff + REGION_HINT)
  return `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}`
}

export type DistanceResult = { km: number; min: number } | { error: string }

export async function googleDistance(pickup: string, dropoff: string): Promise<DistanceResult> {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) return { error: 'no_key' }
  if (!pickup || !dropoff) return { error: 'Enter both From and To first.' }

  const origin = encodeURIComponent(pickup + REGION_HINT)
  const destination = encodeURIComponent(dropoff + REGION_HINT)
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&mode=driving&key=${key}`

  try {
    const res = await fetch(url)
    const data = await res.json()
    const el = data?.rows?.[0]?.elements?.[0]
    if (data.status !== 'OK' || !el || el.status !== 'OK') {
      return { error: `Google Maps could not find that route (${el?.status || data.status}).` }
    }
    return {
      km: Math.round((el.distance.value / 1000) * 10) / 10,
      min: Math.round(el.duration.value / 60),
    }
  } catch {
    return { error: 'Could not reach Google Maps.' }
  }
}
