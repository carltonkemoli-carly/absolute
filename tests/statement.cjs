const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript')
function compile(path, deps = {}) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const m = { exports: {} }
  new Function('require', 'module', 'exports', code)((n) => { if (!(n in deps)) throw new Error('Unexpected dependency ' + n); return deps[n] }, m, m.exports)
  return m.exports
}
const { buildStatement, reminderMessage } = compile('lib/statement.ts', { '@/lib/dashboard': compile('lib/dashboard.ts') })

const today = '2026-11-16'
const inv = (id, no, amount, paid, due, extra = {}) => ({ id, invoice_no: no, period_label: 'Sep 2026', amount, amount_paid: paid, due_date: due, contractor_id: 'c', ...extra })
const pay = (invoice_id, amount, paid_on, created_at = '2026-11-01T00:00:00Z') => ({ id: invoice_id + amount, invoice_id, amount, paid_on, created_at, method: 'mpesa', reference: null, note: null })
const invoices = [
  inv('settled', 'INV-1', 1000, 1000, '2026-09-01'),
  inv('current', 'INV-3', 600, 0, '2026-12-01'),
  inv('late', 'INV-2', 580, 200, '2026-10-31'),
  inv('older', 'INV-0', 400, 0, '2026-09-20'),
]
const payments = [pay('late', 200, '2026-11-05'), pay('settled', 400, '2026-09-10'), pay('settled', 600, '2026-09-02')]

let s = buildStatement(invoices, payments, today)
assert.deepEqual(s.lines.map((l) => l.invoice.id), ['older', 'late', 'current'], 'open invoices only, oldest due date first')
assert.deepEqual([s.billed, s.paid, s.owed, s.overdue], [1580, 200, 1380, 780], 'totals cover the invoices shown')
assert.equal(s.oldestDaysLate, 57)
assert.deepEqual(s.aging.map((b) => b.amount), [600, 380, 400, 0])
assert.deepEqual(s.lines[1].receipts.map((r) => r.amount), [200], 'receipts attach to their invoice')

s = buildStatement(invoices, payments, today, true)
assert.deepEqual(s.lines.map((l) => l.invoice.id), ['older', 'late', 'current', 'settled'], 'settled last when asked for')
assert.deepEqual(s.lines[3].receipts.map((r) => r.paid_on), ['2026-09-02', '2026-09-10'], 'receipts in the order the money arrived')
assert.equal(s.owed, 1380, 'settled invoices add nothing to what is owed')

assert.equal(reminderMessage('Beta', 'Absolute Comfort', buildStatement([inv('s', 'S', 10, 10, '2026-01-01')], [], today), today), '', 'nothing owed, no reminder')
const message = reminderMessage('Beta', 'Absolute Comfort', buildStatement(invoices, payments, today), today)
assert.match(message, /^Hello Beta team,/)
assert.match(message, /As of 16 Nov 2026, KES 1,380 is outstanding across 3 invoices, of which KES 780 is past its due date/)
assert.match(message, /- INV-0, Sep 2026: KES 400, due 20 Sep 2026 \(57 days late\)/)
assert.match(message, /- INV-3, Sep 2026: KES 600, due 1 Dec 2026 \(not yet due\)/)
assert.match(message, /M-Pesa or bank reference/)
const many = Array.from({ length: 11 }, (_, i) => inv('i' + i, 'N' + i, 100, 0, '2026-10-01'))
const long = reminderMessage('Beta', 'Co', buildStatement(many, [], today), today)
assert.equal(long.split('\n').filter((l) => l.startsWith('- ')).length, 9, 'eight invoices listed plus a "more" line')
assert.match(long, /- and 3 more invoices/)
const single = reminderMessage('Beta', 'Co', buildStatement([inv('x', 'X', 50, 0, '2026-12-31')], [], today), today)
assert.match(single, /across 1 invoice, none of it past its due date yet/)
console.log('PASS: statement ordering, totals, aging, receipts and the reminder message.')
