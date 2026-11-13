import type { Contractor, Invoice } from '@/lib/types'

export type InvoicePaymentFilter = 'all' | 'unpaid' | 'part-paid' | 'paid' | 'overdue'
export type InvoiceListFilters = { search: string; contractorId: string; payment: InvoicePaymentFilter }
export const EMPTY_INVOICE_FILTERS: InvoiceListFilters = { search: '', contractorId: '', payment: 'all' }

export function invoiceOutstanding(invoice: Invoice): number {
  return Math.max(0, Number(invoice.amount) - Number(invoice.amount_paid))
}
export function invoiceOverdueDays(invoice: Invoice, today: string): number {
  if (invoiceOutstanding(invoice) <= 0 || !invoice.due_date) return 0
  const difference = Math.round((Date.parse(today) - Date.parse(invoice.due_date)) / 86400000)
  return Number.isFinite(difference) && difference > 0 ? difference : 0
}
export function filterInvoices(invoices: Invoice[], contractors: Contractor[], filters: InvoiceListFilters, today: string): Invoice[] {
  const query = filters.search.trim().toLocaleLowerCase('en-KE')
  const names = new Map(contractors.map(contractor => [contractor.id, contractor.name]))
  return invoices.filter(invoice => {
    if (filters.contractorId && invoice.contractor_id !== filters.contractorId) return false
    if (query && ![invoice.invoice_no ?? '', names.get(invoice.contractor_id ?? '') ?? '', invoice.period_label ?? ''].some(value => value.toLocaleLowerCase('en-KE').includes(query))) return false
    const out = invoiceOutstanding(invoice)
    const paid = Number(invoice.amount_paid)
    switch (filters.payment) {
      case 'paid': return out <= 0
      case 'unpaid': return out > 0 && paid <= 0
      case 'part-paid': return out > 0 && paid > 0
      case 'overdue': return invoiceOverdueDays(invoice, today) > 0
      default: return true
    }
  }).sort((a, b) => (b.due_date ?? '').localeCompare(a.due_date ?? ''))
}
export function invoiceListTotals(invoices: Invoice[], today: string) {
  return invoices.reduce((totals, invoice) => ({
    billed: totals.billed + Number(invoice.amount),
    collected: totals.collected + Number(invoice.amount_paid),
    outstanding: totals.outstanding + invoiceOutstanding(invoice),
    overdue: totals.overdue + (invoiceOverdueDays(invoice, today) > 0 ? invoiceOutstanding(invoice) : 0),
  }), { billed: 0, collected: 0, outstanding: 0, overdue: 0 })
}
