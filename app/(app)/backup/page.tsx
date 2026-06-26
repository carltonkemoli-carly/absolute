import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { PageHeader } from '@/components/ui'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import {
  listTrips, listFuel, listServices, listVehicles, listDrivers,
  listContractors, listOrganizations, listRoutes, listDocuments,
} from '@/lib/db'

export const dynamic = 'force-dynamic'

// Use a wide date window so trips/fuel exports include all history.
const WIDE_START = '2000-01-01'
const WIDE_END = '2999-12-31'

export default async function BackupPage() {
  const profile = await requireProfile()
  if (!canSeeFinance(profile.role)) redirect('/trips')

  const [trips, fuel, services, vehicles, drivers, contractors, organizations, routes, documents] = await Promise.all([
    listTrips(WIDE_START, WIDE_END), listFuel(WIDE_START, WIDE_END), listServices(),
    listVehicles(), listDrivers(), listContractors(), listOrganizations(), listRoutes(), listDocuments(),
  ])

  const datasets = [
    { name: 'trips', label: 'Trips', rows: trips as unknown as Record<string, unknown>[] },
    { name: 'fuel', label: 'Fuel entries', rows: fuel as unknown as Record<string, unknown>[] },
    { name: 'services', label: 'Servicing', rows: services as unknown as Record<string, unknown>[] },
    { name: 'vehicles', label: 'Vehicles', rows: vehicles as unknown as Record<string, unknown>[] },
    { name: 'drivers', label: 'Drivers', rows: drivers as unknown as Record<string, unknown>[] },
    { name: 'contractors', label: 'Contractors', rows: contractors as unknown as Record<string, unknown>[] },
    { name: 'organizations', label: 'Organizations', rows: organizations as unknown as Record<string, unknown>[] },
    { name: 'routes', label: 'Routes & rates', rows: routes as unknown as Record<string, unknown>[] },
    { name: 'documents', label: 'Compliance documents', rows: documents as unknown as Record<string, unknown>[] },
  ]

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'your-site'
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const exportUrl = `${proto}://${host}/api/export`

  const sheetConnected = Boolean(process.env.GOOGLE_SHEETS_WEBHOOK_URL)
  const BackupView = (await import('./BackupView')).default
  const PushToSheetButton = (await import('./PushToSheetButton')).default
  return (
    <>
      <PageHeader title="Backup" subtitle="Download copies of all your data" />

      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div className="font-display" style={{ fontSize: 15, fontWeight: 600 }}>📊 Back up to a Google Sheet</div>
          <PushToSheetButton />
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--ink2)', marginTop: 8, marginBottom: 10, maxWidth: 760 }}>
          Mirror everything into a Google Sheet so a full copy always lives in your Google Drive — even if the system ever has a problem.
          Use the button for an on-demand snapshot, or set up the <strong>daily automatic</strong> backup. No API keys or payment needed.
          Full steps in <strong>GOOGLE_SHEETS_BACKUP.md</strong>.
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink3)' }}>
          {sheetConnected
            ? '✓ Google Sheet Web App connected.'
            : 'Push button needs GOOGLE_SHEETS_WEBHOOK_URL set. The daily auto-pull works without it.'}
          <br />Data endpoint (for the daily pull):&nbsp;
          <code style={{ background: 'var(--surface2)', padding: '2px 7px', borderRadius: 6, color: 'var(--ink)' }}>{exportUrl}</code>
        </div>
      </div>

      <BackupView datasets={datasets} />
    </>
  )
}
