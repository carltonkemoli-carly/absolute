import 'server-only'
import { cookies } from 'next/headers'
import { resolvePeriod, isoDate } from '@/lib/format'
import { latestTripMonth } from '@/lib/db'

// Pick which month a finance page should show, in priority order:
//   1. the month in the URL (?y=&m=)            — explicit choice
//   2. the last month the user viewed (cookie)  — sticky
//   3. the latest month that actually has trips  — so it's never an empty current month
//   4. the current calendar month               — final fallback
export async function stickyPeriod(sp: { y?: string; m?: string }): Promise<{ year: number; month: number }> {
  if (sp.y !== undefined || sp.m !== undefined) return resolvePeriod(sp.y, sp.m)

  const saved = (await cookies()).get('acw_period')?.value
  if (saved && /^\d{4}-\d{1,2}$/.test(saved)) {
    const [y, m] = saved.split('-')
    return resolvePeriod(y, m)
  }

  const latest = await latestTripMonth(isoDate(new Date()))
  if (latest) return latest

  return resolvePeriod(undefined, undefined)
}
