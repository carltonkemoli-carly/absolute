import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui'
import MonthNav from '@/components/MonthNav'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { listTrips, listContractors, listOrganizations } from '@/lib/db'
import { monthRange, resolvePeriod } from '@/lib/format'
import BillingView, { type ContractorBill, type BillRow } from './BillingView'

export default async function BillingPage({
  searchParams,
}: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const profile = await requireProfile()
  if (!canSeeFinance(profile.role)) redirect('/trips')

  const sp = await searchParams
  const { year, month } = resolvePeriod(sp.y, sp.m)
  const { start, end } = monthRange(year, month)

  const [trips, contractors, organizations] = await Promise.all([
    listTrips(start, end), listContractors(), listOrganizations(),
  ])
  const orgName = (id: string | null) => organizations.find((o) => o.id === id)?.name ?? '—'

  const bills: ContractorBill[] = contractors.map((c) => {
    const rows: BillRow[] = trips
      .filter((t) => t.contractor_id === c.id)
      .map((t) => ({
        trip_date: t.trip_date,
        client_name: t.client_name,
        slip_no: t.slip_no,
        voucher_no: t.voucher_no,
        organization: orgName(t.organization_id),
        pickup: t.pickup,
        dropoff: t.dropoff,
        amount: Number(t.amount),
        express: Number(t.express_charges),
      }))
    return {
      id: c.id,
      name: c.name,
      rows,
      revenue: rows.reduce((s, r) => s + r.amount, 0),
      express: rows.reduce((s, r) => s + r.express, 0),
    }
  }).filter((b) => b.rows.length > 0)

  return (
    <>
      <PageHeader title="Billing" subtitle="Monthly statements per contractor" action={<MonthNav year={year} month={month} />} />
      <BillingView bills={bills} year={year} month={month} />
    </>
  )
}
