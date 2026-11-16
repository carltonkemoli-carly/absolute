const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript')
const m = { exports: {} }
new Function('module', 'exports', ts.transpileModule(fs.readFileSync('lib/dashboard.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(m, m.exports)
const { daysLate, agingBuckets, debtors, change, comparisonWindow } = m.exports

const today = '2026-11-16'
const inv = (id, contractor_id, amount, amount_paid, due_date) => ({ id, contractor_id, amount, amount_paid, due_date })
const invoices = [
  inv('settled', 'c1', 1000, 1000, '2026-09-01'),      // paid: never late, never owed
  inv('overpaid', 'c1', 500, 700, '2026-09-01'),       // overpayment must not go negative
  inv('not-due', 'c1', 4000, 0, '2026-12-01'),
  inv('due-today', 'c1', 300, 0, '2026-11-16'),        // due today is not late
  inv('no-date', 'c2', 200, 0, null),                  // no due date: owed, not late
  inv('late-1', 'c1', 1000, 400, '2026-11-15'),        // 1 day, part paid -> 600
  inv('late-30', 'c2', 900, 0, '2026-10-17'),          // exactly 30 days
  inv('late-31', 'c2', 800, 0, '2026-10-16'),          // 31 days
  inv('late-60', 'c2', 700, 0, '2026-09-17'),          // exactly 60 days
  inv('late-61', null, 600, 0, '2026-09-16'),          // 61 days, no supplier
  inv('bad-date', 'c1', 100, 0, 'not a date'),
]

assert.equal(daysLate(invoices[0], today), 0, 'settled invoices are never late')
assert.equal(daysLate(invoices[3], today), 0, 'due today is not late')
assert.equal(daysLate(invoices[5], today), 1)
assert.equal(daysLate(invoices[10], today), 0, 'an unreadable due date is treated as not late')

const buckets = agingBuckets(invoices, today)
assert.deepEqual(buckets.map((b) => b.key), ['current', 'late30', 'late60', 'older'], 'bucket order is fixed')
assert.deepEqual(buckets.map((b) => b.amount), [4000 + 300 + 200 + 100, 600 + 900, 800 + 700, 600])
assert.deepEqual(buckets.map((b) => b.count), [4, 2, 2, 1])
const owedDirectly = invoices.reduce((s, i) => s + Math.max(0, i.amount - i.amount_paid), 0)
assert.equal(buckets.reduce((s, b) => s + b.amount, 0), owedDirectly, 'buckets account for every shilling owed, once')
assert.deepEqual(agingBuckets([], today).map((b) => b.amount), [0, 0, 0, 0], 'empty input keeps all four buckets')

const rows = debtors(invoices, [{ id: 'c1', name: 'Alpha' }, { id: 'c2', name: 'Beta' }], today)
assert.deepEqual(rows.map((r) => r.name), ['Alpha', 'Beta', 'Direct / no supplier'], 'largest balance first')
assert.deepEqual(rows[0], { contractorId: 'c1', name: 'Alpha', outstanding: 5000, overdue: 600, oldestDaysLate: 1, invoices: 4 })
assert.deepEqual(rows[1], { contractorId: 'c2', name: 'Beta', outstanding: 2600, overdue: 2400, oldestDaysLate: 60, invoices: 4 })
assert.equal(rows[2].contractorId, null)
assert.equal(rows.reduce((s, r) => s + r.outstanding, 0), owedDirectly, 'debtor rows agree with the aging total')

assert.equal(change(112, 100), 0.12)
assert.equal(change(50, 100), -0.5)
assert.equal(change(100, 0), null, 'nothing to compare with')
assert.equal(change(0, 0), null)

const nov = { start: '2026-11-01', end: '2026-11-30' }, oct = { start: '2026-10-01', end: '2026-10-31' }
assert.deepEqual(comparisonWindow(nov, oct, '2026-11-16'), { cutoff: '2026-10-16', partial: true }, 'month in progress compares like for like')
assert.deepEqual(comparisonWindow(nov, oct, '2026-11-30'), { cutoff: '2026-10-31', partial: false }, 'last day counts as a whole month')
assert.deepEqual(comparisonWindow(nov, oct, '2026-12-05'), { cutoff: '2026-10-31', partial: false }, 'a finished month compares with the whole previous month')
assert.deepEqual(comparisonWindow(nov, oct, '2026-10-20'), { cutoff: '2026-10-31', partial: false }, 'a future month is not partial')
const mar = { start: '2026-03-01', end: '2026-03-31' }, feb = { start: '2026-02-01', end: '2026-02-28' }
assert.deepEqual(comparisonWindow(mar, feb, '2026-03-30'), { cutoff: '2026-02-28', partial: true }, 'day 30 clamps to a 28-day February')

console.log('PASS: receivables aging boundaries, debtor totals, change and like-for-like comparison window.')
