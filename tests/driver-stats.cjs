const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript')
const m = { exports: {} }
new Function('module', 'exports', ts.transpileModule(fs.readFileSync('lib/driver-stats.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(m, m.exports)
const { driverMonth, driverTagging, averageTripsPerDriver } = m.exports
const t = (id, driver_id, date, status, amount, express = 0, vehicle_id = 'v1') => ({ id, driver_id, trip_date: date, status, amount, express_charges: express, vehicle_id })
const trips = [
  t('1', 'd1', '2026-11-02', 'completed', 2500, 250),
  t('2', 'd1', '2026-11-02', 'completed', 3000, 0, 'v2'),
  t('3', 'd1', '2026-11-05', 'completed', 1800, 0),
  t('4', 'd1', '2026-11-20', 'assigned', 4000),
  t('5', 'd1', '2026-11-09', 'cancelled', 9999),
  t('6', 'd1', '2026-10-31', 'completed', 7000),
  t('7', 'd2', '2026-11-03', 'completed', 2000),
  t('8', null, '2026-11-04', 'completed', 2200),
  t('9', 'd2', '2026-11-06', 'completed', 100, 100),
]
const d1 = driverMonth(trips, 'd1', '2026-11-01', '2026-11-30')
assert.equal(d1.completed, 3, 'only completed trips in the month')
assert.equal(d1.fares, 2250 + 3000 + 1800, 'fares exclude pass-through tolls')
assert.equal(d1.avgFare, 7050 / 3)
assert.equal(d1.daysWorked, 2, 'two trips on one day is one day worked')
assert.equal(d1.open, 1, 'the assigned job counts as open; the cancelled one does not')
assert.deepEqual(d1.vehicles, [{ id: 'v1', trips: 2 }, { id: 'v2', trips: 1 }])
assert.deepEqual(driverMonth(trips, 'nobody', '2026-11-01', '2026-11-30'), { completed: 0, fares: 0, avgFare: 0, daysWorked: 0, open: 0, vehicles: [] })
assert.equal(driverMonth(trips, 'd2', '2026-11-01', '2026-11-30').fares, 2000, 'a trip that is all toll earns no fare')
assert.deepEqual(driverMonth(trips, 'd1', '2026-10-01', '2026-10-31').completed, 1, 'boundaries are inclusive and by month')
assert.deepEqual(driverTagging(trips, '2026-11-01', '2026-11-30'), { completed: 6, tagged: 5 })
assert.deepEqual(driverTagging([], '2026-11-01', '2026-11-30'), { completed: 0, tagged: 0 })
assert.equal(averageTripsPerDriver(trips, '2026-11-01', '2026-11-30'), 2.5, 'd1 has 3 and d2 has 2; untagged trips belong to no one')
assert.equal(averageTripsPerDriver([], '2026-11-01', '2026-11-30'), 0)
console.log('PASS: driver month figures (completed, fares net of tolls, days worked, open, vehicles), tagging share and fleet average.')
