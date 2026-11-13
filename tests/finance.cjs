// Check the reporting contract with mixed dispatch statuses and real costs.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const source = ts.transpileModule(fs.readFileSync('lib/finance.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const compiledModule = { exports: {} }
new Function('require', 'module', 'exports', source)(() => { throw new Error('Unexpected dependency') }, compiledModule, compiledModule.exports)
const { monthlyPL, periodPL, profitHeadline } = compiledModule.exports

const trip = (status, amount, month='2026-11', express=0, hire=0) => ({
  status, amount, trip_date: `${month}-10`, express_charges: express, hire_cost: hire,
})
const input = {
  trips: [
    trip('completed', 1000, '2026-11', 100, 40),
    trip('booked', 700, '2026-11', 50, 200),
    trip('assigned', 600), trip('cancelled', 500),
    trip('completed', 400, '2026-12'),
  ],
  fuel: [{ fuel_date: '2026-11-10', amount: 100 }],
  expenses: [{ expense_date: '2026-11-30', category: 'Driver Wages', amount: 200 }],
  services: [],
  vehicles: [{ ownership: 'monthly_hire', monthly_fee: 50 }],
}
const november = monthlyPL({ ...input, trips: input.trips.filter(t => t.trip_date.startsWith('2026-11')) })
assert.equal(november.revenue, 1000)
assert.equal(november.express, 100)
assert.equal(november.netRevenue, 900)
assert.equal(november.hire, 90)
assert.equal(november.net, 510)
assert.equal(november.margin, 510 / 900)
assert.equal(profitHeadline(november).label, 'Profit after recorded costs')
const both = periodPL(input, ['2026-11', '2026-12'])
assert.equal(both.revenue, 1400)
assert.equal(both.netRevenue, 1300)
assert.equal(both.hire, 140)
assert.equal(both.costsComplete, false)
console.log('PASS: only completed journeys earn revenue, trip hire follows completion, monthly hire repeats, and missing wages stay visible')
