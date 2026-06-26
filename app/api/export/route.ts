import { NextResponse } from 'next/server'
import { DEV_MODE } from '@/lib/devmode'
import { gatherDatasets } from '@/lib/backup'

export const dynamic = 'force-dynamic'

// Full data export for backing up to Google Sheets (or anything else).
// Security: if BACKUP_EXPORT_TOKEN is set, the caller must pass ?token=that.
// With the real database (not demo) a token is REQUIRED so data is never public.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token')
  const required = process.env.BACKUP_EXPORT_TOKEN

  if (required) {
    if (token !== required) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  } else if (!DEV_MODE) {
    // Real data but no token configured — refuse rather than expose it.
    return NextResponse.json({ error: 'Set BACKUP_EXPORT_TOKEN to enable export.' }, { status: 401 })
  }

  const datasets = await gatherDatasets()
  return NextResponse.json({ generatedAt: new Date().toISOString(), datasets })
}
