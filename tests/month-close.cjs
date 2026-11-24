const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript')
function compile(path, deps = {}) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const m = { exports: {} }
  new Function('require', 'module', 'exports', code)((n) => { if (!(n in deps)) throw new Error('Unexpected dependency ' + n); return deps[n] }, m, m.exports)
  return m.exports
}
const { monthCloseChecks, closeSummary } = compile('lib/month-close.ts', { '@/lib/finance': compile('lib/finance.ts') })

const today = '2026-12-05'
const trip = (id, extra = {}) => ({ id, trip_date: '2026-11-10', status: 'completed', amount: 2000, express_charges: 0, driver_id: 'd', vehicle_id: 'v', contractor_id: 'c', invoice_id: 'i1', ...extra })
const driver = (id, wage, status = 'active') => ({ id, monthly_wage: wage, status })
const good = {
  trips: [trip('1'), trip('2')], fuel: [{ amount: 500 }], today,
  expenses: [{ category: 'Driver Wages', amount: 50000 }, { category: 'Insurance', amount: 8000 }],
  drivers: [driver('d', 50000)], invoices: [{ id: 'i1', contractor_id: 'c', amount: 4000, amount_paid: 4000, due_date: '2026-12-01' }],
}
const state = (checks, key) => checks.find((c) => c.key === key).state
const run = (patch) => monthCloseChecks({ ...good, ...patch })

let checks = run({})
assert.deepEqual(checks.map((c) => c.state), Array(8).fill('ok'), 'a complete month is all green')
assert.deepEqual(closeSummary(checks, today, '2026-11-30'), { ready: true, bad: 0, warn: 0, monthOver: true })

checks = run({ trips: [trip('1', { status: 'booked' })] })
assert.equal(state(checks, 'open-trips'), 'bad', 'a past job still booked is red')
assert.equal(state(run({ trips: [trip('1', { status: 'booked', trip_date: '2026-12-20' })] }), 'open-trips'), 'ok', 'a future booking is fine')
assert.equal(state(run({ trips: [trip('1', { status: 'cancelled' })] }), 'open-trips'), 'ok', 'cancelled is finished')

assert.equal(state(run({ trips: [trip('1', { amount: 250, express_charges: 250 })] }), 'no-fare'), 'bad', 'all toll, no fare')
assert.equal(state(run({ trips: [trip('1', { status: 'booked', amount: 0 })] }), 'no-fare'), 'ok', 'only completed trips need a fare')

const many = (n, untagged) => Array.from({ length: n }, (_, i) => trip('t' + i, i < untagged ? { driver_id: null } : {}))
assert.equal(state(run({ trips: many(20, 0) }), 'tagging'), 'ok')
assert.equal(state(run({ trips: many(20, 2) }), 'tagging'), 'warn', '90% tagged is a warning')
assert.equal(state(run({ trips: many(20, 3) }), 'tagging'), 'bad', 'under 90% is red')
assert.match(run({ trips: many(20, 4) }).find((c) => c.key === 'tagging').detail, /4 of 20 completed trips \(20%\)/)

assert.equal(state(run({ trips: [trip('1', { invoice_id: null })], invoices: [] }), 'invoiced'), 'warn', 'unbilled supplier work')
assert.equal(state(run({ trips: [trip('1', { invoice_id: null, contractor_id: null })], invoices: [] }), 'invoiced'), 'ok', 'a direct trip has no supplier to invoice')
const older = [{ id: 'o', contractor_id: 'c', period_start: '2026-11-01', period_end: '2026-11-30', amount: 1, amount_paid: 1 }]
assert.equal(state(run({ trips: [trip('1', { invoice_id: null })], invoices: older }), 'invoiced'), 'ok', 'an older invoice covers the trip by its period')
assert.equal(state(run({ trips: [trip('1', { invoice_id: null, trip_date: '2026-10-31' })], invoices: older }), 'invoiced'), 'warn', 'but not outside it')

assert.equal(state(run({ expenses: [] }), 'wages'), 'bad', 'wages owed, none recorded')
assert.equal(state(run({ expenses: [{ category: 'Driver Wages', amount: 40000 }] }), 'wages'), 'warn', 'under 90% of the wage budget')
assert.equal(state(run({ expenses: [{ category: 'Driver Wages', amount: 45000 }] }), 'wages'), 'ok')
assert.equal(state(run({ expenses: [], drivers: [driver('d', 0), driver('e', 90000, 'inactive')] }), 'wages'), 'ok', 'no active driver on a wage')
assert.match(run({ expenses: [], drivers: [driver('a', 30000), driver('b', 20000)] }).find((c) => c.key === 'wages').detail, /2 drivers on a monthly wage cost KES 50,000/)

assert.equal(state(run({ fuel: [] }), 'fuel'), 'bad')
assert.equal(state(run({ fuel: [], trips: [] }), 'fuel'), 'ok', 'no trips, no fuel expected')
assert.equal(state(run({ expenses: [{ category: 'Driver Wages', amount: 50000 }] }), 'other-costs'), 'warn')
assert.equal(state(run({ expenses: [{ category: 'Driver Wages', amount: 50000 }], trips: [] }), 'other-costs'), 'ok')

const late = [{ id: 'l', contractor_id: 'c', amount: 1000, amount_paid: 400, due_date: '2026-11-30' }]
checks = run({ invoices: [...good.invoices, ...late] })
assert.equal(state(checks, 'overdue'), 'warn'); assert.match(checks.find((c) => c.key === 'overdue').detail, /1 invoice past due, KES 600/)
assert.equal(state(run({ invoices: [{ id: 'f', amount: 5, amount_paid: 5, due_date: '2026-01-01' }] }), 'overdue'), 'ok', 'a settled invoice is not overdue')

const mixed = run({ expenses: [], fuel: [], invoices: [...good.invoices, ...late] })
assert.deepEqual(closeSummary(mixed, today, '2026-11-30'), { ready: false, bad: 2, warn: 2, monthOver: true })
assert.equal(closeSummary(mixed, '2026-11-20', '2026-11-30').monthOver, false, 'a running month can still change')
for (const check of checks) { assert.ok(check.title && check.detail && check.href.startsWith('/') && check.action, 'every check says where to fix it') }
console.log('PASS: month-close checks (open trips, fares, tagging, invoicing, wages, fuel, other costs, overdue) and summary.')
