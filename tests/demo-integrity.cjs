// Executes actual data-layer/demo code against an isolated synthetic store.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
function compile(path, dependencies) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const module = { exports: {} }
  new Function('require','module','exports',code)((name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`)
    return dependencies[name]
  },module,module.exports)
  return module.exports
}
const rules = compile('lib/dispatch-rules.ts', {})
let store = { trips: [], invoices: [] }, n=0
const db = compile('lib/db.ts', {
  '@/lib/supabase/server': { createClient() { throw new Error('Demo must never access Supabase') } },
  '@/lib/devmode': { DEV_MODE: true }, '@/lib/types': { DEFAULT_COMPANY: {} },
  '@/lib/dispatch-rules': rules,
  '@/lib/devstore': { loadStore: () => store, saveStore: (s) => {store=s}, uid: () => `synthetic-${++n}` }
})
const trip = (id, time='10:00') => ({ id,trip_date:'2026-11-10',pickup_time:time,status:'completed',vehicle_id:'v',driver_id:null,contractor_id:'c',amount:250,invoice_id:null })
const invoice = {contractor_id:'c',period_start:'2026-11-01',period_end:'2026-11-30',amount:0}
;(async () => {
  store.trips=[trip('a')]
  assert.ok((await db.saveRecord('trips',trip('b','11:00'),null)).error)
  assert.equal(store.trips.length,1)
  assert.equal((await db.saveRecord('trips',trip('b','12:00'),null)).error,null)
  assert.equal(store.trips.length,2)
  await assert.rejects(db.batchInsert('trips',[trip('c','14:00'),trip('d','14:30')]))
  assert.equal(store.trips.length,2)
  assert.ok((await db.createInvoiceForTrips(invoice,['a','missing'])).error)
  store.trips.push({ ...trip('booked','16:00'), status:'booked' }, { ...trip('cancelled','18:00'), status:'cancelled' })
  assert.ok((await db.createInvoiceForTrips(invoice,['booked'])).error)
  assert.ok((await db.createInvoiceForTrips(invoice,['cancelled'])).error)
  store.trips.push({ ...trip('no-fare','19:00'), amount:50, express_charges:50 })
  assert.ok((await db.createInvoiceForTrips(invoice,['no-fare'])).error)
  assert.equal(store.invoices.length,0)
  const results=await Promise.all([db.createInvoiceForTrips(invoice,['a']),db.createInvoiceForTrips(invoice,['a'])])
  assert.equal(results.filter(r=>!r.error).length,1)
  assert.equal(store.invoices[0].amount,250)
  await db.deleteRecord('invoices',store.invoices[0].id)
  assert.equal(store.trips.find(t=>t.id==='a').invoice_id,null)
  await db.saveRecord('invoices',{contractor_id:'c',amount:500,amount_paid:0,paid_date:null},null)
  const paymentId=store.invoices[0].id
  assert.equal((await db.updateInvoicePayment(paymentId,100,'2026-11-10',500,0)).error,null)
  assert.ok((await db.updateInvoicePayment(paymentId,200,'2026-11-10',500,0)).error)
  assert.ok((await db.updateInvoicePayment(paymentId,700,'2026-11-10',500,100)).error)
  assert.equal(store.invoices[0].amount_paid,100)
  assert.equal((await db.updateInvoicePayment(paymentId,500,'2026-11-11',500,100)).error,null)
  console.log('PASS: demo overlaps, completed-only invoice selection, concurrent invoices, and stale/overpaid payment protection')
})().catch(e=>{console.error(e);process.exitCode=1})
