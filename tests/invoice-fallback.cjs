// Before migration-integrity.sql runs, the database has no create_invoice_for_trips
// function. The data layer then creates the invoice and links its trips itself,
// and must undo the invoice if any trip cannot be linked.
const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript')
function compile(path, deps) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const m = { exports: {} }
  new Function('require', 'module', 'exports', code)((n) => { if (!(n in deps)) throw new Error('Unexpected dependency ' + n); return deps[n] }, m, m.exports)
  return m.exports
}
// A tiny stand-in for the Supabase query builder over in-memory tables.
function fakeSupabase(db, options = {}) {
  return {
    rpc: async () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }),
    from(table) {
      let op = null, payload = null; const filters = []; let selecting = false, single = false
      const q = {
        insert(row) { op = 'insert'; payload = row; return q },
        update(row) { op = 'update'; payload = row; return q },
        delete() { op = 'delete'; return q },
        select() { selecting = true; return q },
        single() { single = true; return q },
        in(col, vals) { filters.push((r) => vals.includes(r[col])); return q },
        is(col, val) { filters.push((r) => (r[col] ?? null) === val); return q },
        eq(col, val) { filters.push((r) => r[col] === val); return q },
        then(resolve) {
          const rows = db[table]
          if (op === 'insert') { const row = { id: 'inv-' + (rows.length + 1), ...payload }; rows.push(row); return resolve({ data: single ? { id: row.id } : [row], error: null }) }
          if (op === 'update' && table === 'trips' && options.noLinkColumn && 'invoice_id' in payload) return resolve({ data: null, error: { code: '42703', message: 'column trips.invoice_id does not exist' } })
          const hit = rows.filter((r) => filters.every((f) => f(r)))
          if (op === 'update') hit.forEach((r) => Object.assign(r, payload))
          if (op === 'delete') db[table] = rows.filter((r) => !hit.includes(r))
          return resolve({ data: selecting ? hit.map((r) => ({ id: r.id })) : null, error: null })
        },
      }
      return q
    },
  }
}
const load = (db, options) => compile('lib/db.ts', {
  '@/lib/supabase/server': { createClient: async () => fakeSupabase(db, options) },
  '@/lib/devmode': { DEV_MODE: false }, '@/lib/types': { DEFAULT_COMPANY: {} },
  '@/lib/dispatch-rules': compile('lib/dispatch-rules.ts', {}), '@/lib/payments': compile('lib/payments.ts', {}),
  '@/lib/devstore': { loadStore() { throw new Error('demo store must not be used') }, saveStore() {}, uid: () => 'x' },
})
const trip = (id, extra = {}) => ({ id, status: 'completed', invoice_id: null, ...extra })
const invoice = { contractor_id: 'c', amount: 500, amount_paid: 0 }
;(async () => {
  let db = { invoices: [], trips: [trip('a'), trip('b')] }
  let r = await load(db).createInvoiceForTrips(invoice, ['a', 'b'])
  assert.equal(r.error, null); assert.equal(db.invoices.length, 1)
  assert.deepEqual(db.trips.map((t) => t.invoice_id), [r.id, r.id], 'both trips linked')

  db = { invoices: [], trips: [trip('a'), trip('b', { invoice_id: 'old' })] }
  r = await load(db).createInvoiceForTrips(invoice, ['a', 'b'])
  assert.match(r.error, /already billed/); assert.equal(r.id, null)
  assert.equal(db.invoices.length, 0, 'the half-made invoice is removed')
  assert.deepEqual(db.trips.map((t) => t.invoice_id), [null, 'old'], 'the linked trip is released, the other untouched')

  db = { invoices: [], trips: [trip('a', { status: 'booked' })] }
  r = await load(db).createInvoiceForTrips(invoice, ['a'])
  assert.ok(r.error); assert.equal(db.invoices.length, 0, 'a trip that is not completed cannot be billed')

  db = { invoices: [], trips: [trip('a')] }
  r = await load(db, { noLinkColumn: true }).createInvoiceForTrips(invoice, ['a'])
  assert.equal(r.error, null); assert.equal(db.invoices.length, 1, 'older databases keep the invoice, unlinked, as before')
  console.log('PASS: invoicing before the integrity migration links all trips or none, and works on databases without trip links.')
})().catch((e) => { console.error(e); process.exitCode = 1 })
