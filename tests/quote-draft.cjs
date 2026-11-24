const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const moduleLike = { exports: {} }
new Function('module', 'exports', ts.transpileModule(fs.readFileSync('lib/quote-draft.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText)(moduleLike, moduleLike.exports)
const { quoteDraftHref, parseQuoteDraft } = moduleLike.exports

const route = { id: 'jkia-westlands', pickup: 'JKIA', dropoff: 'Westlands', price_saloon: 2500, price_wagon: 3200, price_van: 6000, price_bus: 0 }
const href = quoteDraftHref({ routeId: route.id, vehicleClass: 'wagon', toll: 250, extras: 500, date: '2026-12-05' })
assert.ok(href.startsWith('/trips?'))
const params = Object.fromEntries(new URL(href, 'https://example.test').searchParams)
assert.deepEqual({ y: params.y, m: params.m }, { y: '2026', m: '11' })
assert.equal(params.quote, '1')
assert.equal(href.includes('client'), false, 'the draft URL carries no customer details')

const draft = parseQuoteDraft({ ...params, amount: '1' }, [route])
assert.deepEqual({ date: draft.date, pickup: draft.pickup, dropoff: draft.dropoff, amount: draft.amount, toll: draft.toll },
  { date: '2026-12-05', pickup: 'JKIA', dropoff: 'Westlands', amount: 3950, toll: 250 },
  'the booking amount is recomputed from the current server rate, not the query')
assert.match(draft.notes, /Check rate and availability/)

assert.equal(parseQuoteDraft({ ...params, d: '2026-02-30' }, [route]), null)
assert.equal(parseQuoteDraft({ ...params, c: 'bus' }, [route]), null, 'an unset rate cannot become a booking draft')
assert.equal(parseQuoteDraft({ ...params, e: '-1' }, [route]), null)
assert.equal(parseQuoteDraft({ ...params, t: '9999' }, [route]), null)
assert.equal(parseQuoteDraft({ ...params, r: 'other' }, [route]), null)
assert.equal(quoteDraftHref({ routeId: route.id, vehicleClass: 'wagon', toll: 250, extras: 0, date: '2026-02-30' }), null)

console.log('PASS: quote handoff prefills a booked trip from server rates without putting customer details in the URL.')
