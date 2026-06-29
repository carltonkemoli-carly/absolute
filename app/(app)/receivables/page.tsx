import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { listInvoices, listContractors } from '@/lib/db'
import type { Contractor, Invoice } from '@/lib/types'
import ReceivablesView from './ReceivablesView'

export const dynamic = 'force-dynamic'

export default async function ReceivablesPage() {
  const profile = await requireProfile()
  if (!canSeeFinance(profile.role)) redirect('/trips')

  const [invoices, contractors] = await Promise.all([listInvoices(), listContractors()])
  return (
    <>
      <PageHeader title="Receivables" subtitle="What you've invoiced vs paid — and who owes you" />
      <ReceivablesView invoices={invoices as Invoice[]} contractors={contractors as Contractor[]} />
    </>
  )
}
