import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { listInvoices, listContractors, listTrips } from '@/lib/db'
import { isoDate, addDays } from '@/lib/format'
import type { Contractor, Invoice } from '@/lib/types'
import ReceivablesView from './ReceivablesView'

export const dynamic = 'force-dynamic'

export default async function ReceivablesPage() {
  const profile = await requireProfile()
  if (!canSeeFinance(profile.role)) redirect('/trips')

  // Work done but not yet on an invoice. Scoped to the recent window: trips from
  // before invoices were linked to trips have no link and would otherwise show
  // as un-billed forever.
  const today = isoDate(new Date())
  const since = isoDate(addDays(new Date(), -60))
  const recent = await listTrips(since, today)
  const unbilled = recent.filter((t) => t.status === 'completed' && !t.invoice_id)
  const unbilledValue = unbilled.reduce((s, t) => s + Number(t.amount || 0), 0)

  const [invoices, contractors] = await Promise.all([listInvoices(), listContractors()])
  return (
    <>
      <PageHeader title="Receivables" subtitle="What you've invoiced vs paid — and who owes you" />
      <ReceivablesView
        invoices={invoices as Invoice[]} contractors={contractors as Contractor[]}
        unbilledValue={unbilledValue} unbilledCount={unbilled.length}
      />
    </>
  )
}
