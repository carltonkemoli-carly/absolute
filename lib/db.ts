// Single data-access layer. In DEV_MODE it reads/writes the file-backed store;
// otherwise it talks to Supabase. Pages and server actions use only this.
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/devmode'
import { loadStore, saveStore, uid, type StoreData } from '@/lib/devstore'
import type {
  Contractor, Driver, FuelEntry, Organization, Profile, Trip, Vehicle,
  VehicleService, Route, ComplianceDoc, Expense, Target, Invoice,
} from '@/lib/types'

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

// ---------- Reads ----------
export async function listVehicles(): Promise<Vehicle[]> {
  if (DEV_MODE) return [...loadStore().vehicles].sort(byField('plate'))
  const { data } = await (await sb()).from('vehicles').select('*').order('plate')
  return (data ?? []) as Vehicle[]
}
export async function listDrivers(): Promise<Driver[]> {
  if (DEV_MODE) return [...loadStore().drivers].sort(byField('name'))
  const { data } = await (await sb()).from('drivers').select('*').order('name')
  return (data ?? []) as Driver[]
}
export async function listContractors(): Promise<Contractor[]> {
  if (DEV_MODE) return [...loadStore().contractors].sort(byField('name'))
  const { data } = await (await sb()).from('contractors').select('*').order('name')
  return (data ?? []) as Contractor[]
}
export async function listOrganizations(): Promise<Organization[]> {
  if (DEV_MODE) return [...loadStore().organizations].sort(byField('name'))
  const { data } = await (await sb()).from('organizations').select('*').order('name')
  return (data ?? []) as Organization[]
}
export async function listProfiles(): Promise<Profile[]> {
  if (DEV_MODE) return [...loadStore().profiles]
  const { data } = await (await sb()).from('profiles').select('*').order('created_at')
  return (data ?? []) as Profile[]
}
export async function listTrips(start: string, end: string): Promise<Trip[]> {
  if (DEV_MODE) return loadStore().trips.filter((t) => t.trip_date >= start && t.trip_date <= end).sort(byField('trip_date'))
  const { data } = await (await sb()).from('trips').select('*').gte('trip_date', start).lte('trip_date', end).order('trip_date')
  return (data ?? []) as Trip[]
}
export async function listFuel(start: string, end: string): Promise<FuelEntry[]> {
  if (DEV_MODE) return loadStore().fuel.filter((f) => f.fuel_date >= start && f.fuel_date <= end).sort(byField('fuel_date', -1))
  const { data } = await (await sb()).from('fuel_entries').select('*').gte('fuel_date', start).lte('fuel_date', end).order('fuel_date', { ascending: false })
  return (data ?? []) as FuelEntry[]
}

export async function listServices(): Promise<VehicleService[]> {
  if (DEV_MODE) return [...loadStore().services].sort(byField('service_date', -1))
  const { data } = await (await sb()).from('vehicle_services').select('*').order('service_date', { ascending: false })
  return (data ?? []) as VehicleService[]
}
export async function listRoutes(): Promise<Route[]> {
  if (DEV_MODE) return [...loadStore().routes].sort(byField('pickup'))
  const { data } = await (await sb()).from('routes').select('*').order('pickup')
  return (data ?? []) as Route[]
}
export async function listDocuments(): Promise<ComplianceDoc[]> {
  if (DEV_MODE) return [...loadStore().documents].sort(byField('expiry_date'))
  const { data } = await (await sb()).from('documents').select('*').order('expiry_date')
  return (data ?? []) as ComplianceDoc[]
}
export async function listExpenses(start?: string, end?: string): Promise<Expense[]> {
  if (DEV_MODE) {
    let rows = loadStore().expenses
    if (start && end) rows = rows.filter((e) => e.expense_date >= start && e.expense_date <= end)
    return [...rows].sort(byField('expense_date', -1))
  }
  let q = (await sb()).from('expenses').select('*')
  if (start && end) q = q.gte('expense_date', start).lte('expense_date', end)
  const { data } = await q.order('expense_date', { ascending: false })
  return (data ?? []) as Expense[]
}
export async function listInvoices(): Promise<Invoice[]> {
  if (DEV_MODE) return [...loadStore().invoices].sort(byField('due_date', -1))
  const { data } = await (await sb()).from('invoices').select('*').order('due_date', { ascending: false })
  return (data ?? []) as Invoice[]
}
export async function listTargets(period?: string): Promise<Target[]> {
  if (DEV_MODE) {
    const rows = loadStore().targets
    return period ? rows.filter((t) => t.period === period) : [...rows]
  }
  let q = (await sb()).from('targets').select('*')
  if (period) q = q.eq('period', period)
  const { data } = await q
  return (data ?? []) as Target[]
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

export async function saveRecord(table: TableName, row: Row, id: string | null): Promise<void> {
  if (DEV_MODE) {
    const data = loadStore()
    const arr = data[DEV_KEY[table]] as unknown as ({ id: string } & Row)[]
    if (id) {
      const i = arr.findIndex((x) => x.id === id)
      if (i >= 0) arr[i] = { ...arr[i], ...row }
    } else {
      arr.unshift({ id: uid(table), created_at: new Date().toISOString(), ...row } as { id: string } & Row)
    }
    saveStore(data)
    return
  }
  const s = await sb()
  if (id) await s.from(table).update(row).eq('id', id)
  else await s.from(table).insert(row)
}

// Targets are keyed by (period, kind, category) — upsert by that, not by id.
export async function upsertTarget(period: string, kind: Target['kind'], category: string | null, amount: number): Promise<void> {
  if (DEV_MODE) {
    const data = loadStore()
    const match = (t: Target) => t.period === period && t.kind === kind && (t.category ?? null) === (category ?? null)
    const i = data.targets.findIndex(match)
    if (amount > 0) {
      if (i >= 0) data.targets[i] = { ...data.targets[i], amount }
      else data.targets.unshift({ id: uid('tgt'), period, kind, category, amount, created_at: new Date().toISOString() })
    } else if (i >= 0) {
      data.targets.splice(i, 1)
    }
    saveStore(data)
    return
  }
  const s = await sb()
  let q = s.from('targets').select('id').eq('period', period).eq('kind', kind)
  q = category === null ? q.is('category', null) : q.eq('category', category)
  const { data: existing } = await q.maybeSingle()
  if (amount > 0) {
    if (existing) await s.from('targets').update({ amount }).eq('id', existing.id)
    else await s.from('targets').insert({ period, kind, category, amount })
  } else if (existing) {
    await s.from('targets').delete().eq('id', existing.id)
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
    await s.from(table).insert(rows.slice(i, i + CHUNK))
  }
}

export async function deleteRecord(table: TableName, id: string): Promise<void> {
  if (DEV_MODE) {
    const data = loadStore()
    const arr = data[DEV_KEY[table]] as unknown as { id: string }[]
    const i = arr.findIndex((x) => x.id === id)
    if (i >= 0) arr.splice(i, 1)
    saveStore(data)
    return
  }
  await (await sb()).from(table).delete().eq('id', id)
}
