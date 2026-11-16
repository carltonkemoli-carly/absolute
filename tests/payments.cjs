const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript')
const m = { exports: {} }
new Function('module', 'exports', 'require', ts.transpileModule(fs.readFileSync('lib/payments.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(m, m.exports, () => ({}))
const { paymentProblem, settle } = m.exports

const invoice = { amount: 1000, amount_paid: 400 }
const ok = { amount: 600, paid_on: '2026-11-16', method: 'mpesa', reference: 'QAB12CD', note: null }
assert.equal(paymentProblem(invoice, ok), null)
assert.equal(paymentProblem(invoice, { ...ok, amount: 599.99 }), null, 'two decimals are fine')
assert.match(paymentProblem(invoice, { ...ok, amount: 0 }), /amount received/)
assert.match(paymentProblem(invoice, { ...ok, amount: -5 }), /amount received/)
assert.match(paymentProblem(invoice, { ...ok, amount: 1.005 }), /two decimal/)
assert.match(paymentProblem(invoice, { ...ok, amount: 600.01 }), /more than the KES 600 still owed/, 'cannot overpay')
assert.match(paymentProblem(invoice, { ...ok, paid_on: '16/11/2026' }), /date/)
assert.match(paymentProblem(invoice, { ...ok, paid_on: '2026-13-40' }), /date/)
assert.match(paymentProblem(invoice, { ...ok, method: 'bitcoin' }), /how it was paid/)
assert.match(paymentProblem({ amount: 1000, amount_paid: 1000 }, ok), /KES 0 still owed/, 'a settled invoice takes nothing more')

const p = (amount, paid_on, created_at = '2026-11-01T00:00:00Z') => ({ amount, paid_on, created_at })
assert.deepEqual(settle({ amount: 1000 }, []), { amount_paid: 0, paid_date: null })
assert.deepEqual(settle({ amount: 1000 }, [p(400, '2026-11-02')]), { amount_paid: 400, paid_date: null }, 'part paid has no paid date')
assert.deepEqual(settle({ amount: 1000 }, [p(400, '2026-11-02'), p(600, '2026-11-09')]), { amount_paid: 1000, paid_date: '2026-11-09' })
assert.deepEqual(settle({ amount: 1000 }, [p(600, '2026-11-09'), p(400, '2026-11-02')]), { amount_paid: 1000, paid_date: '2026-11-09' }, 'cleared on the latest receipt by date, whatever the entry order')
assert.deepEqual(settle({ amount: 1000 }, [p(500, '2026-11-09', '2026-11-09T08:00:00Z'), p(500, '2026-11-09', '2026-11-09T09:00:00Z')]).paid_date, '2026-11-09')
assert.deepEqual(settle({ amount: 100 }, [p(33.33, '2026-11-01'), p(33.33, '2026-11-02'), p(33.34, '2026-11-03')]), { amount_paid: 100, paid_date: '2026-11-03' }, 'cents add up exactly')
assert.deepEqual(settle({ amount: 0 }, [p(0.01, '2026-11-01')]).paid_date, null, 'a zero invoice is never "paid"')
console.log('PASS: payment validation (amounts, dates, methods, overpayment) and ledger settlement (sum, paid date, ordering, cents).')
