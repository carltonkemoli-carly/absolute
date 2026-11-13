const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function load(file, dependencies = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const module = { exports: {} }
  new Function('module', 'exports', 'require', source)(module, module.exports, name => dependencies[name] ?? require(name))
  return module.exports
}
const finder = load('lib/record-search.ts')
assert.equal(finder.shiftCalendarDay('2026-01-01', -1), '2025-12-31')
assert.equal(finder.tripMonthHref('2026-11-10'), '/trips?y=2026&m=10')
const trip = {id:'synthetic-trip', trip_date:'2026-11-10', client_name:'Synthetic Traveller', pickup:'JKIA', dropoff:'Westlands', organization_id:'org', contractor_id:'contractor', vehicle_id:'vehicle', driver_id:null, status:'booked', amount:1200}
const vehicle = {id:'vehicle', plate:'TEST 001', model:'Toyota Axio', vehicle_type:'Saloon', status:'active'}
const source = {trips:[trip], vehicles:[vehicle], drivers:[], organizations:[{id:'org',name:'Synthetic Organization',active:true}], contractors:[{id:'contractor',name:'Synthetic Supplier',active:true}], routes:[], invoices:[{id:'invoice',invoice_no:'SYN-001',contractor_id:'contractor',amount:1200,amount_paid:0,due_date:'2026-11-01'}]}
assert.deepEqual(finder.searchRecords('syn traveller',source,false).map(group=>group.key),['trips'])
assert.equal(finder.searchRecords('syn-001',source,false).some(group=>group.key==='invoices'),false)
assert.equal(finder.searchRecords('syn-001',source,true).some(group=>group.key==='invoices'),true)
assert.equal(finder.searchRecords('Synthetic Organization',source,false).some(group=>group.key==='clients'),false)
assert.equal(finder.searchRecords('Synthetic Organization',source,true).some(group=>group.key==='clients'),true)
assert.equal(finder.searchRecords('TEST001',source,false).find(group=>group.key==='vehicles').items[0].href,'/vehicles/vehicle')
const issues = finder.deriveAttention([trip],[{id:'doc',expiry_date:'2026-11-09'}],source.invoices,'2026-11-10',false)
assert.equal(issues.missingAssignments.length,1)
assert.equal(issues.expiredDocuments.length,1)
assert.equal(issues.overdueInvoices.length,0)
assert.equal(finder.deriveAttention([trip],[],source.invoices,'2026-11-10',true).overdueInvoices.length,1)

const filters = load('lib/trip-filters.ts')
const exportTools = load('lib/trip-export.ts', {'./trip-filters':filters})
assert.equal(exportTools.tripCsvCell('  =SUM(1,1)'), '"\'  =SUM(1,1)"')
assert.equal(exportTools.tripCsvCell('A "quote"'), '"A ""quote"""')
const saved = exportTools.savedTripFilters({...filters.EMPTY_TRIP_FILTERS, query:'Synthetic Traveller', status:'booked'})
assert.equal(Object.hasOwn(saved,'query'),false)
const view = {id:'test-1',name:'Booked',filters:saved}
const encoded = exportTools.encodeSavedTripViews([view])
assert.deepEqual(exportTools.decodeSavedTripViews(encoded).views,[view])
assert.equal(exportTools.decodeSavedTripViews('{"version":1,"views":[{"id":"x","name":"Leaked","filters":{"query":"Customer"}}]}').invalid,true)
const csv = exportTools.exportTripsCsv([{...trip,client_name:'=HYPERLINK("bad")'}],{contractors:source.contractors,drivers:[],vehicles:source.vehicles})
assert.match(csv,/"'=HYPERLINK\(""bad""\)"/)
assert.match(csv,/"TEST 001"/)
console.log('PASS: scoped record finder, attention queues, safe saved filters and CSV formula protection with synthetic records.')
