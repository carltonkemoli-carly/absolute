'use server'

import { revalidatePath } from 'next/cache'
import { saveRecord, deleteRecord, batchInsert, listExpenses, listDrivers } from '@/lib/db'
import { requireFinance } from '@/lib/auth'
import { monthRange } from '@/lib/format'

export async function saveExpense(formData: FormData) {
  await requireFinance()
  const id = String(formData.get('id') || '')
  const row = {
    expense_date: String(formData.get('expense_date') || '').trim(),
    category: String(formData.get('category') || '').trim(),
    amount: num(formData.get('amount')),
    vehicle_id: emptyToNull(formData.get('vehicle_id')),
    driver_id: emptyToNull(formData.get('driver_id')),
    payee: emptyToNull(formData.get('payee')),
    description: emptyToNull(formData.get('description')),
    notes: emptyToNull(formData.get('notes')),
  }
  if (!row.expense_date || !row.category) return
  await saveRecord('expenses', row, id || null)
  revalidateAll()
}

export async function deleteExpense(formData: FormData) {
  await requireFinance()
  const id = String(formData.get('id') || '')
  if (id) await deleteRecord('expenses', id)
  revalidateAll()
}

// Generate a "Driver Wages" expense for each active driver with a wage set,
// for the given month. Skips drivers already paid this month (idempotent).
export async function postMonthlyWages(formData: FormData): Promise<{ added: number; skipped: number }> {
  await requireFinance()
  const year = num(formData.get('year'))
  const month = num(formData.get('month'))
  const { start, end } = monthRange(year, month)
  const payDate = end // record wages on the last day of the month

  const [drivers, existing] = await Promise.all([listDrivers(), listExpenses(start, end)])
  const alreadyPaid = new Set(
    existing.filter((e) => e.category === 'Driver Wages' && e.driver_id).map((e) => e.driver_id),
  )

  const rows = drivers
    .filter((d) => d.status === 'active' && Number(d.monthly_wage) > 0 && !alreadyPaid.has(d.id))
    .map((d) => ({
      expense_date: payDate,
      category: 'Driver Wages',
      amount: Number(d.monthly_wage),
      driver_id: d.id,
      vehicle_id: null,
      payee: d.name,
      description: 'Monthly wage',
      notes: null,
    }))

  if (rows.length) await batchInsert('expenses', rows)
  revalidateAll()
  const eligible = drivers.filter((d) => d.status === 'active' && Number(d.monthly_wage) > 0).length
  return { added: rows.length, skipped: eligible - rows.length }
}

// Copy last month's expenses into the given month (same day-of-month, clamped).
// Skips entries that already have a matching category+payee+amount this month.
export async function copyLastMonthExpenses(formData: FormData): Promise<{ added: number }> {
  await requireFinance()
  const year = num(formData.get('year'))
  const month = num(formData.get('month'))
  const prev = monthRange(year, month - 1)
  const cur = monthRange(year, month)

  const [prevRows, curRows] = await Promise.all([
    listExpenses(prev.start, prev.end), listExpenses(cur.start, cur.end),
  ])
  const sig = (c: string, p: string | null, a: number) => `${c}|${(p ?? '').toLowerCase()}|${a}`
  const have = new Set(curRows.map((e) => sig(e.category, e.payee, Number(e.amount))))

  const rows = prevRows
    .filter((e) => !have.has(sig(e.category, e.payee, Number(e.amount))))
    .map((e) => ({
      expense_date: shiftToMonth(e.expense_date, year, month),
      category: e.category,
      amount: Number(e.amount),
      vehicle_id: e.vehicle_id,
      driver_id: e.driver_id,
      payee: e.payee,
      description: e.description,
      notes: e.notes,
    }))

  if (rows.length) await batchInsert('expenses', rows)
  revalidateAll()
  return { added: rows.length }
}

// Keep the same day-of-month, clamped to the target month's length.
function shiftToMonth(dateStr: string, year: number, month: number): string {
  const day = Number(dateStr.slice(8, 10)) || 1
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const d = Math.min(day, lastDay)
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function revalidateAll() {
  revalidatePath('/expenses')
  revalidatePath('/goals')
  revalidatePath('/insights')
  revalidatePath('/reports')
  revalidatePath('/')
}
function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}
function num(v: FormDataEntryValue | null): number {
  const n = Number(String(v ?? '').trim())
  return Number.isFinite(n) ? n : 0
}
