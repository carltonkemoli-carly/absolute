// The payment ledger's arithmetic, kept pure so the demo store, the server
// actions and the tests all agree with the database trigger in
// migration-invoice-payments.sql.
import type { Invoice, InvoicePayment, PaymentMethod } from '@/lib/types'

export const PAYMENT_METHODS: PaymentMethod[] = ['mpesa', 'bank', 'cash', 'cheque', 'other']

export interface PaymentInput {
  amount: number
  paid_on: string
  method: PaymentMethod
  reference: string | null
  note: string | null
}

// Checks one receipt against the invoice it is for. Returns the message to show,
// or null when the payment can be recorded.
export function paymentProblem(invoice: Pick<Invoice, 'amount' | 'amount_paid'>, input: PaymentInput): string | null {
  if (!Number.isFinite(input.amount) || input.amount <= 0) return 'Enter the amount received.'
  if (Math.round(input.amount * 100) !== input.amount * 100) return 'Enter an amount with at most two decimal places.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paid_on) || Number.isNaN(Date.parse(input.paid_on))) return 'Enter the date the money arrived.'
  if (!PAYMENT_METHODS.includes(input.method)) return 'Choose how it was paid.'
  const owed = Math.max(0, Number(invoice.amount) - Number(invoice.amount_paid))
  if (input.amount > owed + 0.004) return `That is more than the ${fmt(owed)} still owed on this invoice.`
  return null
}

// What the invoice should carry given its ledger: the sum received, and the day
// the balance reached zero (the latest receipt by date, then by entry order).
export function settle(invoice: Pick<Invoice, 'amount'>, payments: Pick<InvoicePayment, 'amount' | 'paid_on' | 'created_at'>[]): { amount_paid: number; paid_date: string | null } {
  const amount_paid = round2(payments.reduce((sum, payment) => sum + Number(payment.amount), 0))
  const billed = Number(invoice.amount)
  if (billed <= 0 || amount_paid < billed) return { amount_paid, paid_date: null }
  const last = [...payments].sort((a, b) => b.paid_on.localeCompare(a.paid_on) || b.created_at.localeCompare(a.created_at))[0]
  return { amount_paid, paid_date: last?.paid_on ?? null }
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function fmt(n: number): string {
  return `KES ${Math.round(n).toLocaleString('en-KE')}`
}
