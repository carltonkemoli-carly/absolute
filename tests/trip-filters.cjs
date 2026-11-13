// Synthetic examples verify cross-field filters and partial assignments.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const source = ts.transpileModule(fs.readFileSync('lib/trip-filters.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const local = { exports: {} }
new Function('module', 'exports', source)(local, local.exports)
const { filterTrips, EMPTY_TRIP_FILTERS } = local.exports
const lookups = {
  contractors: [{ id: 'c-one', name: 'Synthetic Corporate' }, { id: 'c-two', name: 'Second supplier' }],
  organizations: [{ id: 'o-one', name: 'Test Organisation' }],
  drivers: [{ id: 'd-one', name: 'Alex Test' }, { id: 'd-two', name: 'Jo Sample' }],
  vehicles: [{ id: 'v-one', plate: 'TEST 001', model: 'Toyota Axio' }, { id: 'v-two', plate: 'TEST 002', model: 'Toyota Noah' }],
}
const base = { trip_date: '2026-11-10', client_name: 'Synthetic traveller', pickup: 'Airport', dropoff: 'Westlands', slip_no: '', voucher_no: '', notes: '', organization_id: 'o-one', contractor_id: 'c-one', vehicle_id: null, driver_id: null }
const trips = [
  { ...base, id: 'a', client_name: 'Élodie Sample', status: 'completed', vehicle_id: 'v-one', driver_id: 'd-one', slip_no: 'SYN-001' },
  { ...base, id: 'b', status: 'booked', driver_id: 'd-two', voucher_no: 'VC-99', contractor_id: 'c-two' },
  { ...base, id: 'c', status: 'assigned', vehicle_id: 'v-two', notes: 'Extra luggage' },
  { ...base, id: 'd', status: 'cancelled', organization_id: null },
]
const ids = filters => filterTrips(trips, { ...EMPTY_TRIP_FILTERS, ...filters }, lookups).map(item => item.id)
assert.deepEqual(ids({}), ['a', 'b', 'c', 'd'])
assert.deepEqual(ids({ query: '  ELODIE   Axio   ALEX ' }), ['a'])
assert.deepEqual(ids({ query: 'VC-99' }), ['b'])
assert.deepEqual(ids({ query: 'Test Organisation', status: 'assigned' }), ['c'])
assert.deepEqual(ids({ assignment: 'assigned' }), ['a'])
assert.deepEqual(ids({ assignment: 'unassigned' }), ['b', 'c', 'd'])
assert.deepEqual(ids({ driverId: 'd-two', assignment: 'unassigned' }), ['b'])
assert.deepEqual(ids({ vehicleId: 'v-two', contractorId: 'c-one' }), ['c'])
assert.deepEqual(ids({ status: 'completed', driverId: 'd-two' }), [])
assert.deepEqual(ids({ query: 'unknown company' }), [])
assert.equal(trips[0].client_name, 'Élodie Sample')
assert.deepEqual(EMPTY_TRIP_FILTERS, { query: '', status: '', contractorId: '', driverId: '', vehicleId: '', assignment: 'all' })
console.log('PASS: Trips search spans references and related records; combined status/resource filters and partial-assignment queue preserve correct synthetic results.')
