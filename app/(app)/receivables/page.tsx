import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { listInvoices, listContractors, listTrips, listPayments } from '@/lib/db'
import { shiftCalendarDay } from '@/lib/record-search'
import { nairobiToday } from '@/lib/nairobi-date'
import type { Contractor, Invoice } from '@/lib/types'
import ReceivablesView from './ReceivablesView'

export const dynamic = 'force-dynamic'

export default async function ReceivablesPage() {
  const profile = await requireProfile()
  if (!canSeeFinance(profile.role)) redirect('/trips')

  // Work done but not yet on an invoice. Scoped to the recent window: trips from
  // before invoices were linked to trips have no link and would otherwise show
  // as un-billed forever.
  const today = nairobiToday()
  const [recent, invoices, contractors, payments] = await Promise.all([
    listTrips(shiftCalendarDay(today, -60), today), listInvoices(), listContractors(), listPayments(),
  ])
  const unbilled = recent.filter((t) => t.status === 'completed' && !t.invoice_id)
  const unbilledValue = unbilled.reduce((s, t) => s + Number(t.amount || 0), 0)

  // How many receipts each invoice has — the list shows the count, the invoice page the detail.
  const receipts: Record<string, number> = {}
  for (const payment of payments) receipts[payment.invoice_id] = (receipts[payment.invoice_id] ?? 0) + 1

  return (
    <>
      <PageHeader title="Receivables" subtitle="Invoices, what has been paid, and who still owes" />
      <ReceivablesView
        invoices={invoices as Invoice[]} contractors={contractors as Contractor[]}
        receipts={receipts} today={today}
        unbilledValue={unbilledValue} unbilledCount={unbilled.length}
      />
    </>
  )
}
