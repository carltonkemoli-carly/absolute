import { redirect } from 'next/navigation'
import { PageHeader, StatCard } from '@/components/ui'
import MonthNav from '@/components/MonthNav'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { listExpenses, listVehicles, listDrivers } from '@/lib/db'
import { monthRange, resolvePeriod, isoDate, kes } from '@/lib/format'
import ExpenseManager from './ExpenseManager'

export const dynamic = 'force-dynamic'

export default async function ExpensesPage({
  searchParams,
}: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const profile = await requireProfile()
  if (!canSeeFinance(profile.role)) redirect('/trips')

  const sp = await searchParams
  const { year, month } = resolvePeriod(sp.y, sp.m)
  const { start, end } = monthRange(year, month)
  const today = isoDate(new Date())
  const defaultDate = today >= start && today <= end ? today : start

  const [expenses, vehicles, drivers] = await Promise.all([
    listExpenses(start, end), listVehicles(), listDrivers(),
  ])
  const total = expenses.reduce((a, e) => a + Number(e.amount), 0)

  const byCat = new Map<string, number>()
  for (const e of expenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + Number(e.amount))
  const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0]

  return (
    <>
      <PageHeader title="Expenses" subtitle="Running costs beyond fuel & servicing" action={<MonthNav year={year} month={month} />} />
      <div className="grid-stats" style={{ marginBottom: 18 }}>
        <StatCard label="Total expenses this month" value={kes(total)} hint={`${expenses.length} entries`} />
        <StatCard label="Biggest category" value={top ? top[0] : '—'} hint={top ? kes(top[1]) : undefined} />
        <StatCard label="Categories used" value={String(byCat.size)} />
      </div>
      <ExpenseManager expenses={expenses} vehicles={vehicles} drivers={drivers} defaultDate={defaultDate} />
    </>
  )
}
