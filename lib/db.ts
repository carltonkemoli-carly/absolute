// Single data-access layer. In DEV_MODE it reads/writes the file-backed store;
// otherwise it talks to Supabase. Pages and server actions use only this.
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/devmode'
import { loadStore, saveStore, uid, type StoreData } from '@/lib/devstore'
import type {
  Contractor, Driver, FuelEntry, Organization, Profile, Trip, Vehicle,
  VehicleService, Route, ComplianceDoc, Expense, Target, Invoice, Company,
} from '@/lib/types'
import { DEFAULT_COMPANY } from '@/lib/types'
import { assertNoDispatchOverlap } from '@/lib/dispatch-rules'

type Row = Record<string, unknown>

async function sb() {
  return await createClient()
}
const byField = (key: string, dir: 1 | -1 = 1) =>
  (a: unknown, b: unknown) => {
    const av = String((a as Row)[key] ?? '')
    const bv = String((b as Row)[key] ?? '')
    return av < bv ? -dir : av > bv ? dir : 0
  }

// A Supabase read resolves to rows + an optional error; wide reads also
// support `.range()` for paging.
type QueryResult = { data: unknown[] | null; error: { message: string } | null }
type PagedQuery = { range: (from: number, to: number) => PromiseLike<QueryResult> }

// Run a single-shot list query and surface any error instead of silently
// treating a failed query as "no data" — critical for a finance system.
async function rows<T>(ctx: string, q: PromiseLike<QueryResult>): Promise<T[]> {
  const { data, error } = await q
  if (error) console.error(`[db] ${ctx} failed: ${error.message}`)
  return (data ?? []) as T[]
}

// PostgREST caps every response at 1000 rows by default. For reads that can
// exceed that (trips/fuel over wide ranges), page through until exhausted so
// analytics and backups see the full dataset, not a silently-truncated slice.
const PAGE_SIZE = 1000
async function fetchAll<T>(ctx: string, build: () => PagedQuery): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build().range(from, from + PAGE_SIZE - 1)
    if (error) { console.error(`[db] ${ctx} failed: ${error.message}`); break }
    const batch = (data ?? []) as T[]
    out.push(...batch)
    if (batch.length < PAGE_SIZE) break
  }
  return out
}

// ---------- Reads ----------
export async function listVehicles(): Promise<Vehicle[]> {
  if (DEV_MODE) return [...loadStore().vehicles].sort(byField('plate'))
  return rows<Vehicle>('listVehicles', (await sb()).from('vehicles').select('*').order('plate'))
}
export async function listDrivers(): Promise<Driver[]> {
  if (DEV_MODE) return [...loadStore().drivers].sort(byField('name'))
  return rows<Driver>('listDrivers', (await sb()).from('drivers').select('*').order('name'))
}
export async function listContractors(): Promise<Contractor[]> {
  if (DEV_MODE) return [...loadStore().contractors].sort(byField('name'))
  return rows<Contractor>('listContractors', (await sb()).from('contractors').select('*').order('name'))
}
export async function listOrganizations(): Promise<Organization[]> {
  if (DEV_MODE) return [...loadStore().organizations].sort(byField('name'))
  return rows<Organization>('listOrganizations', (await sb()).from('organizations').select('*').order('name'))
}
export async function listProfiles(): Promise<Profile[]> {
  if (DEV_MODE) return [...loadStore().profiles]
  return rows<Profile>('listProfiles', (await sb()).from('profiles').select('*').order('created_at'))
}
export async function listTrips(start: string, end: string): Promise<Trip[]> {
  if (DEV_MODE) return loadStore().trips.filter((t) => t.trip_date >= start && t.trip_date <= end).sort(byField('trip_date'))
  const client = await sb()
  return fetchAll<Trip>(`listTrips(${start}..${end})`, () =>
    client.from('trips').select('*').gte('trip_date', start).lte('trip_date', end).order('trip_date'))
}
// All unassigned (booked) trips regardless of date — used by the dispatch pending queue.
// Capped so a huge backlog doesn't ship 1000s of rows to the browser; total count returned separately.
export async function listUnassignedTrips(limit = 400): Promise<{ trips: Trip[]; total: number }> {
  if (DEV_MODE) {
    const all = loadStore().trips.filter((t) => t.status === 'booked').sort(byField('trip_date'))
    return { trips: all.slice(0, limit), total: all.length }
  }
  const { data, count } = await (await sb())
    .from('trips').select('*', { count: 'exact' }).eq('status', 'booked').order('trip_date').limit(limit)
  return { trips: (data ?? []) as Trip[], total: count ?? (data?.length ?? 0) }
}
// Delete every still-unassigned (booked) trip — used to clear out bad/duplicate imports.
export async function clearUnassignedTrips(): Promise<number> {
  if (DEV_MODE) {
    const data = loadStore()
    const before = data.trips.length
    data.trips = data.trips.filter((t) => t.status !== 'booked')
    saveStore(data)
    return before - data.trips.length
  }
  const s = await sb()
  const { count } = await s.from('trips').delete({ count: 'exact' }).eq('status', 'booked')
  return count ?? 0
}
// The most recent month (on/before today) that has any trips — used to open
// dashboards on a month with data instead of an empty current month.
export async function latestTripMonth(today: string): Promise<{ year: number; month: number } | null> {
  let latest = ''
  if (DEV_MODE) {
    for (const t of loadStore().trips) if (t.trip_date <= today && t.trip_date > latest) latest = t.trip_date
  } else {
    const { data } = await (await sb())
      .from('trips').select('trip_date').lte('trip_date', today).order('trip_date', { ascending: false }).limit(1)
    latest = data?.[0]?.trip_date ?? ''
  }
  if (!latest) return null
  const [y, m] = latest.split('-')
  return { year: Number(y), month: Number(m) - 1 } // month → 0-indexed
}

// Trips for one contractor within a date range — used to build invoices from logged jobs.
export async function listContractorTrips(contractorId: string, start: string, end: string): Promise<Trip[]> {
  if (DEV_MODE) {
    return loadStore().trips
      .filter((t) => t.contractor_id === contractorId && t.status === 'completed' && t.trip_date >= start && t.trip_date <= end)
      .sort(byField('trip_date'))
  }
  const client = await sb()
  return fetchAll<Trip>(`listContractorTrips(${contractorId})`, () =>
    client.from('trips').select('*').eq('contractor_id', contractorId).eq('status', 'completed')
      .gte('trip_date', start).lte('trip_date', end).order('trip_date'))
}

export async function listFuel(start: string, end: string): Promise<FuelEntry[]> {
  if (DEV_MODE) return loadStore().fuel.filter((f) => f.fuel_date >= start && f.fuel_date <= end).sort(byField('fuel_date', -1))
  const client = await sb()
  return fetchAll<FuelEntry>(`listFuel(${start}..${end})`, () =>
    client.from('fuel_entries').select('*').gte('fuel_date', start).lte('fuel_date', end).order('fuel_date', { ascending: false }))
}

export async function listServices(): Promise<VehicleService[]> {
  if (DEV_MODE) return [...loadStore().services].sort(byField('service_date', -1))
  return rows<VehicleService>('listServices', (await sb()).from('vehicle_services').select('*').order('service_date', { ascending: false }))
}
export async function listRoutes(): Promise<Route[]> {
  if (DEV_MODE) return [...loadStore().routes].sort(byField('pickup'))
  return rows<Route>('listRoutes', (await sb()).from('routes').select('*').order('pickup'))
}
export async function listDocuments(): Promise<ComplianceDoc[]> {
  if (DEV_MODE) return [...loadStore().documents].sort(byField('expiry_date'))
  return rows<ComplianceDoc>('listDocuments', (await sb()).from('documents').select('*').order('expiry_date'))
}
export async function listExpenses(start?: string, end?: string): Promise<Expense[]> {
  if (DEV_MODE) {
    let list = loadStore().expenses
    if (start && end) list = list.filter((e) => e.expense_date >= start && e.expense_date <= end)
    return [...list].sort(byField('expense_date', -1))
  }
  const client = await sb()
  return fetchAll<Expense>(`listExpenses(${start ?? 'all'}..${end ?? 'all'})`, () => {
    let q = client.from('expenses').select('*')
    if (start && end) q = q.gte('expense_date', start).lte('expense_date', end)
    return q.order('expense_date', { ascending: false })
  })
}
export async function getInvoice(id: string): Promise<Invoice | null> {
  if (DEV_MODE) return loadStore().invoices.find((i) => i.id === id) ?? null
  const { data, error } = await (await sb()).from('invoices').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return (data ?? null) as Invoice | null
}

// Compare-and-set prevents one staff member's stale invoice screen from
// overwriting another staff member's payment update.
export async function updateInvoicePayment(
  id: string, amountPaid: number, paidDate: string | null, expectedAmount: number, expectedPaid: number,
): Promise<{ error: string | null }> {
  const changed = 'Invoice changed since this page loaded. Refresh and try again.'
  if (![amountPaid, expectedAmount, expectedPaid].every(Number.isFinite) || amountPaid < 0 || amountPaid > expectedAmount) {
    return { error: 'Paid total must be between zero and the invoice amount.' }
  }
  if (DEV_MODE) {
    const data = loadStore()
    const invoice = data.invoices.find((item) => item.id === id)
    if (!invoice || Number(invoice.amount) !== expectedAmount || Number(invoice.amount_paid) !== expectedPaid) return { error: changed }
    invoice.amount_paid = amountPaid
    invoice.paid_date = paidDate
    saveStore(data)
    return { error: null }
  }
  const { data, error } = await (await sb()).from('invoices')
    .update({ amount_paid: amountPaid, paid_date: paidDate })
    .eq('id', id).eq('amount', expectedAmount).eq('amount_paid', expectedPaid)
    .select('id').maybeSingle()
  if (error) return { error: error.message }
  return { error: data ? null : changed }
}
// Is this contractor-period already invoiced? Stops the same month being billed
// twice, which would silently double Outstanding on the dashboard.
export async function findInvoiceForPeriod(contractorId: string, start: string, end: string): Promise<Invoice | null> {
  if (DEV_MODE) {
    return loadStore().invoices.find((i) =>
      i.contractor_id === contractorId && i.period_start === start && i.period_end === end) ?? null
  }
  const { data } = await (await sb())
    .from('invoices').select('*')
    .eq('contractor_id', contractorId).eq('period_start', start).eq('period_end', end)
    .limit(1)
  return ((data ?? [])[0] ?? null) as Invoice | null
}

// Create an invoice and stamp it onto the trips it bills, so the two can never
// drift apart. Returns the new invoice id.
export async function createInvoiceForTrips(invoice: Row, tripIds: string[]): Promise<{ id: string | null; error: string | null }> {
  if (DEV_MODE) {
    const data = loadStore()
    const ids = new Set(tripIds)
    const trips = data.trips.filter((t) => ids.has(t.id))
    if (!ids.size || ids.size !== tripIds.length || trips.length !== ids.size || trips.some((t) =>
      t.invoice_id || t.status !== 'completed' || Number(t.amount) <= Number(t.express_charges || 0) || t.contractor_id !== invoice.contractor_id || t.trip_date < String(invoice.period_start) || t.trip_date > String(invoice.period_end))) {
      return { id: null, error: 'Trips changed or are already billed. Refresh and retry.' }
    }
    if (data.invoices.some((i) => i.contractor_id === invoice.contractor_id && i.period_start === invoice.period_start && i.period_end === invoice.period_end)) {
      return { id: null, error: 'This contractor period is already invoiced.' }
    }
    const amount = trips.reduce((sum, t) => sum + Number(t.amount), 0)
    const id = uid('invoices')
    data.invoices.unshift({ ...invoice, id, amount, amount_paid: 0, created_at: new Date().toISOString() } as unknown as Invoice)
    for (const t of trips) t.invoice_id = id
    saveStore(data)
    return { id, error: null }
  }
  // No fallback: a missing RPC must fail rather than leave a partial invoice.
  const { data, error } = await (await sb()).rpc('create_invoice_for_trips', { p_invoice: invoice, p_trip_ids: tripIds })
  return { id: error ? null : data as string, error: error?.message ?? null }
}

// The trips an invoice actually bills. Empty for invoices raised before trips
// were linked, and for manual invoices — callers fall back to the period range.
export async function listInvoiceTrips(invoiceId: string): Promise<Trip[]> {
  if (DEV_MODE) {
    return loadStore().trips.filter((t) => t.invoice_id === invoiceId).sort(byField('trip_date'))
  }
  const client = await sb()
  return fetchAll<Trip>(`listInvoiceTrips(${invoiceId})`, () =>
    client.from('trips').select('*').eq('invoice_id', invoiceId).order('trip_date'))
}

export async function listInvoices(): Promise<Invoice[]> {
  if (DEV_MODE) return [...loadStore().invoices].sort(byField('due_date', -1))
  return rows<Invoice>('listInvoices', (await sb()).from('invoices').select('*').order('due_date', { ascending: false }))
}
export async function listTargets(period?: string): Promise<Target[]> {
  if (DEV_MODE) {
    const list = loadStore().targets
    return period ? list.filter((t) => t.period === period) : [...list]
  }
  let q = (await sb()).from('targets').select('*')
  if (period) q = q.eq('period', period)
  return rows<Target>('listTargets', q)
}

// ---------- Company profile (single row) ----------
export async function getCompany(): Promise<Company> {
  if (DEV_MODE) return { ...DEFAULT_COMPANY, ...(loadStore().company ?? {}) }
  const { data } = await (await sb()).from('company').select('*').eq('id', 1).maybeSingle()
  if (!data) return DEFAULT_COMPANY
  return {
    name: data.name ?? DEFAULT_COMPANY.name,
    tagline: data.tagline ?? null,
    location: data.location ?? null,
    email: data.email ?? null,
    phone: data.phone ?? null,
  }
}
export async function saveCompany(c: Company): Promise<void> {
  if (DEV_MODE) { const d = loadStore(); d.company = c; saveStore(d); return }
  await (await sb()).from('company').upsert({ id: 1, ...c, updated_at: new Date().toISOString() })
}

// ---------- Writes ----------
type TableName = 'vehicles' | 'drivers' | 'contractors' | 'organizations' | 'trips' | 'fuel_entries'
  | 'vehicle_services' | 'routes' | 'documents' | 'expenses' | 'targets' | 'invoices'
const DEV_KEY: Record<TableName, keyof StoreData> = {
  vehicles: 'vehicles',
  drivers: 'drivers',
  contractors: 'contractors',
  organizations: 'organizations',
  trips: 'trips',
  fuel_entries: 'fuel',
  vehicle_services: 'services',
  routes: 'routes',
  documents: 'documents',
  expenses: 'expenses',
  targets: 'targets',
  invoices: 'invoices',
}

export async function saveRecord(table: TableName, row: Row, id: string | null): Promise<{ error: string | null }> {
  if (DEV_MODE) {
    const data = loadStore()
    const arr = data[DEV_KEY[table]] as unknown as ({ id: string } & Row)[]
    if (table === 'trips') {
      const previous = id ? data.trips.find((t) => t.id === id) : null
      if (id && !previous) return { error: 'Trip not found' }
      try { assertNoDispatchOverlap({ ...previous, ...row, id: id ?? undefined } as unknown as Trip, data.trips) }
      catch (error) { return { error: (error as Error).message } }
    }
    if (id) {
      const i = arr.findIndex((x) => x.id === id)
      if (i >= 0) arr[i] = { ...arr[i], ...row }
    } else {
      arr.unshift({ id: uid(table), created_at: new Date().toISOString(), ...row } as { id: string } & Row)
    }
    saveStore(data)
    return { error: null }
  }
  const s = await sb()
  const { error } = id ? await s.from(table).update(row).eq('id', id) : await s.from(table).insert(row)
  if (error) console.error(`[db] saveRecord(${table}) failed: ${error.message}`)
  return { error: error?.code === '23P01' ? 'Driver or vehicle has an overlapping trip. Choose another resource or pickup time.' : error?.message ?? null }
}

// Targets are keyed by (period, kind, category, contractor) — upsert by that, not
// by id. contractorId null = a company-wide target; set = that supplier's target.
export async function upsertTarget(
  period: string, kind: Target['kind'], category: string | null, amount: number, contractorId: string | null = null,
): Promise<void> {
  if (DEV_MODE) {
    const data = loadStore()
    const match = (t: Target) =>
      t.period === period && t.kind === kind &&
      (t.category ?? null) === (category ?? null) &&
      (t.contractor_id ?? null) === (contractorId ?? null)
    const i = data.targets.findIndex(match)
    if (amount > 0) {
      if (i >= 0) data.targets[i] = { ...data.targets[i], amount }
      else data.targets.unshift({ id: uid('tgt'), period, kind, category, contractor_id: contractorId, amount, created_at: new Date().toISOString() })
    } else if (i >= 0) {
      data.targets.splice(i, 1)
    }
    saveStore(data)
    return
  }
  const s = await sb()
  let q = s.from('targets').select('id').eq('period', period).eq('kind', kind)
  q = category === null ? q.is('category', null) : q.eq('category', category)
  q = contractorId === null ? q.is('contractor_id', null) : q.eq('contractor_id', contractorId)
  const { data: existing, error: lookupError } = await q.maybeSingle()
  if (lookupError) throw new Error(lookupError.message)
  if (amount > 0) {
    const { error } = existing
      ? await s.from('targets').update({ amount }).eq('id', existing.id)
      : await s.from('targets').insert({ period, kind, category, contractor_id: contractorId, amount })
    if (error) throw new Error(error.message)
  } else if (existing) {
    const { error } = await s.from('targets').delete().eq('id', existing.id)
    if (error) throw new Error(error.message)
  }
}

// Batch insert many rows at once — avoids N sequential round-trips on large imports.
// In dev mode: loads store once, pushes all, saves once.
// In Supabase: inserts in chunks of 100 (stays well under payload limits).
export async function batchInsert(table: TableName, rows: Row[]): Promise<void> {
  if (!rows.length) return
  if (DEV_MODE) {
    const data = loadStore()
    const arr = data[DEV_KEY[table]] as unknown as ({ id: string } & Row)[]
    if (table === 'trips') {
      const pending = [...data.trips]
      for (const row of rows) {
        const trip = { ...row, id: uid('trips') } as unknown as Trip
        assertNoDispatchOverlap(trip, pending)
        pending.push(trip)
      }
    }
    const now = new Date().toISOString()
    for (const row of rows) {
      arr.unshift({ id: uid(table), created_at: now, ...row } as { id: string } & Row)
    }
    saveStore(data)
    return
  }
  const s = await sb()
  const CHUNK = 100
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await s.from(table).insert(rows.slice(i, i + CHUNK))
    if (error) throw new Error(error.message)
  }
}

export async function deleteRecord(table: TableName, id: string): Promise<void> {
  if (DEV_MODE) {
    const data = loadStore()
    const arr = data[DEV_KEY[table]] as unknown as { id: string }[]
    const i = arr.findIndex((x) => x.id === id)
    if (i >= 0) arr.splice(i, 1)
    if (table === 'invoices') for (const t of data.trips) if (t.invoice_id === id) t.invoice_id = null
    saveStore(data)
    return
  }
  const { error } = await (await sb()).from(table).delete().eq('id', id)
  if (error) throw new Error(error.message)
}
