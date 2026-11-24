// A supplier's statement of account: what is still owed, how late it is, and
// the receipts against each invoice. Pure, so the page, the reminder message
// and the tests all use the same numbers.
import type { Invoice, InvoicePayment } from '@/lib/types'
import { daysLate, agingBuckets, type AgingBucket } from '@/lib/dashboard'

export interface StatementLine {
  invoice: Invoice
  owed: number
  daysLate: number
  receipts: InvoicePayment[]
}

export interface Statement {
  lines: StatementLine[]
  billed: number
  paid: number
  owed: number
  overdue: number
  oldestDaysLate: number
  aging: AgingBucket[]
}

const owedOn = (invoice: Invoice): number =>
  Math.max(0, Math.round((Number(invoice.amount) - Number(invoice.amount_paid)) * 100) / 100)

// Open invoices first, the oldest due date at the top so the most overdue is
// the first thing read; settled ones (when asked for) follow, newest first.
export function buildStatement(
  invoices: Invoice[], payments: InvoicePayment[], today: string, includeSettled = false,
): Statement {
  const byInvoice = new Map<string, InvoicePayment[]>()
  for (const payment of payments) {
    const list = byInvoice.get(payment.invoice_id) ?? []
    list.push(payment)
    byInvoice.set(payment.invoice_id, list)
  }
  const lines: StatementLine[] = invoices
    .filter((invoice) => includeSettled || owedOn(invoice) > 0)
    .map((invoice) => ({
      invoice,
      owed: owedOn(invoice),
      daysLate: daysLate(invoice, today),
      receipts: (byInvoice.get(invoice.id) ?? []).slice().sort((a, b) => a.paid_on.localeCompare(b.paid_on) || a.created_at.localeCompare(b.created_at)),
    }))
    .sort((a, b) => {
      if ((a.owed > 0) !== (b.owed > 0)) return a.owed > 0 ? -1 : 1
      const ad = a.invoice.due_date ?? '9999-12-31', bd = b.invoice.due_date ?? '9999-12-31'
      return a.owed > 0 ? ad.localeCompare(bd) : bd.localeCompare(ad)
    })
  const sum = (f: (line: StatementLine) => number) => Math.round(lines.reduce((s, line) => s + f(line), 0) * 100) / 100
  return {
    lines,
    billed: sum((line) => Number(line.invoice.amount)),
    paid: sum((line) => Number(line.invoice.amount_paid)),
    owed: sum((line) => line.owed),
    overdue: sum((line) => (line.daysLate > 0 ? line.owed : 0)),
    oldestDaysLate: Math.max(0, ...lines.map((line) => line.daysLate)),
    aging: agingBuckets(lines.map((line) => line.invoice), today),
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function day(iso: string | null): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  return match ? `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}` : 'no due date'
}
const money = (n: number): string => `KES ${Math.round(n).toLocaleString('en-KE')}`
const plural = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? '' : 's'}`

// A plain message to paste into WhatsApp or email. Empty when nothing is owed.
export function reminderMessage(supplier: string, company: string, statement: Statement, today: string): string {
  if (statement.owed <= 0) return ''
  const open = statement.lines.filter((line) => line.owed > 0)
  const overdueNote = statement.overdue > 0
    ? `, of which ${money(statement.overdue)} is past its due date`
    : ', none of it past its due date yet'
  const shown = open.slice(0, 8).map((line) => {
    const label = [line.invoice.invoice_no, line.invoice.period_label].filter(Boolean).join(', ') || 'Invoice'
    const status = line.daysLate > 0 ? `${plural(line.daysLate, 'day')} late` : 'not yet due'
    return `- ${label}: ${money(line.owed)}, due ${day(line.invoice.due_date)} (${status})`
  })
  if (open.length > shown.length) shown.push(`- and ${plural(open.length - shown.length, 'more invoice')}`)
  return [
    `Hello ${supplier} team,`,
    '',
    `This is a reminder from ${company}. As of ${day(today)}, ${money(statement.owed)} is outstanding across ${plural(open.length, 'invoice')}${overdueNote}.`,
    '',
    ...shown,
    '',
    'Please send the M-Pesa or bank reference once you have paid so we can match it to the right invoice. Thank you.',
  ].join('\n')
}
