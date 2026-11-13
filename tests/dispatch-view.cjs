const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const moduleObject = { exports: {} }
const source = ts.transpileModule(fs.readFileSync('lib/dispatch-view.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
new Function('module', 'exports', source)(moduleObject, moduleObject.exports)
const { filterDispatchTrips, dispatchColumns } = moduleObject.exports
const trip = (id, status, name, time, extra={}) => ({ id, status, client_name:name, pickup_time:time, pickup:'JKIA', dropoff:'Westlands', slip_no:'', voucher_no:'', flight_no:'', ...extra })
const rows = [trip('done','completed','Synthetic completed','09:00'),trip('booked2','booked','Synthetic late','12:00'),trip('booked1','booked','Synthetic early','08:00',{flight_no:'KQ123'}),trip('cancelled','cancelled','Synthetic cancelled','10:00'),trip('assigned','assigned','Synthetic assigned','07:00')]
const original = JSON.stringify(rows)
assert.deepEqual(filterDispatchTrips(rows,'','all').map(row=>row.id),['booked1','booked2','assigned','done','cancelled'])
assert.deepEqual(filterDispatchTrips(rows,'','active').map(row=>row.id),['booked1','booked2','assigned'])
assert.deepEqual(filterDispatchTrips(rows,'kq123','all').map(row=>row.id),['booked1'])
assert.equal(filterDispatchTrips(rows,'JKIA westlands','booked').length,2)
assert.deepEqual(filterDispatchTrips(rows,'driver test-123','all',row=>row.id==='assigned'?'Driver Test-123':'').map(row=>row.id),['assigned'])
assert.equal(filterDispatchTrips(rows,'nothing matches','all').length,0)
assert.ok(dispatchColumns(rows,'all').includes('cancelled'))
assert.ok(!dispatchColumns(rows,'active').includes('completed'))
assert.deepEqual(dispatchColumns(rows,'confirmed'),['confirmed'])
assert.equal(JSON.stringify(rows),original,'filtering must never mutate server-provided records')
console.log('PASS: dispatch search, multi-term route/lookup matching, status filters, workflow ordering, cancelled columns and input immutability')
