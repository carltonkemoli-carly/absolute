import { redirect } from 'next/navigation'
import { PageHeader, StatCard, Section } from '@/components/ui'
import MonthNav from '@/components/MonthNav'
import { requireProfile, canSeeFinance } from '@/lib/auth'
import { listExpenses, listVehicles, listDrivers } from '@/lib/db'
import { monthRange, isoDate, kes, MONTH_NAMES } from '@/lib/format'
import { stickyPeriod } from '@/lib/period'
import ExpenseManager from './ExpenseManager'

export const dynamic = 'force-dynamic'

export default async function ExpensesPage({
  searchParams,
}: { searchParams: Promise<{ y?: string; m?: string }> }) {
  const profile = await requireProfile()
  if (!canSeeFinance(profile.role)) redirect('/trips')

  const sp = await searchParams
  const { year, month } = await stickyPeriod(sp)
  const { start, end } = monthRange(year, month)
  const today = isoDate(new Date())
  const defaultDate = today >= start && today <= end ? today : start
  const monthLabel = `${MONTH_NAMES[month]} ${year}`

  const [expenses, vehicles, drivers] = await Promise.all([
    listExpenses(start, end), listVehicles(), listDrivers(),
  ])
  const total = expenses.reduce((a, e) => a + Number(e.amount), 0)
  const wageBudget = drivers.filter((d) => d.status === 'active').reduce((a, d) => a + Number(d.monthly_wage || 0), 0)

  const byCat = new Map<string, number>()
  for (const e of expenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + Number(e.amount))
  const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0]

  return (
    <>
      <PageHeader title="Expenses" subtitle="Running costs beyond fuel — wages, insurance, parking & more" action={<MonthNav year={year} month={month} />} />

      <Section title={monthLabel}>
        <div className="grid-stats" style={{ marginBottom: 2 }}>
          <StatCard label="Total expenses" value={kes(total)} hint={`${expenses.length} entr${expenses.length === 1 ? 'y' : 'ies'}`} />
          <StatCard label="Biggest category" value={top ? top[0] : '—'} hint={top ? kes(top[1]) : 'nothing logged yet'} />
          <StatCard label="Categories used" value={String(byCat.size)} />
          <StatCard label="Wage budget" value={kes(wageBudget)} hint="active drivers / month" accent="var(--gold)" />
        </div>
      </Section>

      <ExpenseManager
        expenses={expenses} vehicles={vehicles} drivers={drivers} defaultDate={defaultDate}
        year={year} month={month} wageBudget={wageBudget} monthLabel={monthLabel}
      />
    </>
  )
}
