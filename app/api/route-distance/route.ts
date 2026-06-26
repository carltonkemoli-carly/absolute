import { NextResponse } from 'next/server'
import { googleDistance } from '@/lib/maps'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const pickup = searchParams.get('origin') || ''
  const dropoff = searchParams.get('destination') || ''
  const result = await googleDistance(pickup, dropoff)
  return NextResponse.json(result)
}
