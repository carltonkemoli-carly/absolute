// File-backed sample data used when DEV_MODE is on (no Supabase configured).
// Persisted to .devdata.json so add/edit/delete survive across requests and
// Next's dev workers. Delete that file to reset the demo data.
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type {
  Contractor, Driver, FuelEntry, Organization, Profile, Trip, Vehicle,
  VehicleService, Route, ComplianceDoc, Expense, Target, Invoice, Company,
} from '@/lib/types'

const FILE = join(process.cwd(), '.devdata.json')

// Two demo personas so you can preview the access levels in demo mode.
export type DemoUserKey = 'ceo' | 'rachel'
export const DEMO_USERS: Record<DemoUserKey, Profile> = {
  ceo: { id: 'demo-ceo', full_name: 'CEO (Admin)', role: 'owner', created_at: new Date().toISOString() },
  rachel: { id: 'demo-rachel', full_name: 'Rachel (Office)', role: 'office', created_at: new Date().toISOString() },
}

export const DEV_PROFILE: Profile = DEMO_USERS.ceo

export interface StoreData {
  contractors: Contractor[]
  vehicles: Vehicle[]
  drivers: Driver[]
  organizations: Organization[]
  profiles: Profile[]
  trips: Trip[]
  fuel: FuelEntry[]
  services: VehicleService[]
  routes: Route[]
  documents: ComplianceDoc[]
  expenses: Expense[]
  targets: Target[]
  invoices: Invoice[]
  company?: Company
}

export function uid(prefix = 'row') {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}
function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// In-memory cache. On a writable filesystem (local dev) we also persist to
// FILE so changes survive across Next's dev workers. On serverless/read-only
// hosts (Vercel) the file write is skipped and the cache holds the data for the
// life of the warm instance — enough for a demo, and it never crashes.
let cache: StoreData | null = null

export function loadStore(): StoreData {
  if (cache) return cache
  if (existsSync(FILE)) {
    try {
      const persisted = JSON.parse(readFileSync(FILE, 'utf8')) as Partial<StoreData>
      // Backfill any collections missing from an older-shape file so newer code
      // never crashes on undefined arrays (e.g. invoices added after a seed).
      const base = seed()
      const merged = { ...base } as Record<string, unknown>
      for (const k of Object.keys(base) as (keyof StoreData)[]) {
        const bv = base[k]
        const pv = persisted[k]
        merged[k] = Array.isArray(bv) ? (Array.isArray(pv) ? pv : bv) : (pv ?? bv)
      }
      cache = merged as unknown as StoreData
      return cache
    } catch {
      // fall through and reseed if the file is corrupt
    }
  }
  cache = seed()
  saveStore(cache)
  return cache
}

export function saveStore(data: StoreData): void {
  cache = data
  try {
    writeFileSync(FILE, JSON.stringify(data, null, 2))
  } catch {
    // read-only filesystem (e.g. Vercel) — cache is the source of truth
  }
}

// ---------------------------------------------------------------------------
function seed(): StoreData {
  const contractors: Contractor[] = [
    { id: 'con-bcd', name: 'BCD', code: 'BCD', billing_notes: null, active: true, created_at: '' },
    { id: 'con-fcm', name: 'FCM', code: 'FCM', billing_notes: null, active: true, created_at: '' },
    { id: 'con-abs', name: 'Absolute', code: 'ABS', billing_notes: null, active: true, created_at: '' },
  ]

  const v = (
    plate: string, model: string, type: string, cap: number,
    ownership: Vehicle['ownership'] = 'owned', owner_name: string | null = null, monthly_fee = 0,
    econ: { date?: string; price?: number; loan?: number; loanMo?: number } = {},
  ): Vehicle =>
    ({ id: `veh-${plate}`, plate, model, vehicle_type: type, capacity: cap, photo_url: null, status: 'active', ownership, owner_name, monthly_fee,
      purchase_date: econ.date ?? null, purchase_price: econ.price ?? 0, loan_amount: econ.loan ?? 0, loan_monthly: econ.loanMo ?? 0,
      notes: null, created_at: '' })
  const vehicles: Vehicle[] = [
    v('KCD196X', 'Toyota Noah', 'Van', 7, 'owned', null, 0, { date: '2024-01-15', price: 2800000, loan: 2000000, loanMo: 90000 }),
    v('KCH845Z', 'Toyota Hiace', 'Van', 14, 'owned', null, 0, { date: '2023-06-01', price: 3500000 }),
    v('KCL947Z', 'Toyota Fielder', 'Wagon', 5, 'owned', null, 0, { date: '2024-09-01', price: 2200000, loan: 1500000, loanMo: 70000 }),
    v('KCC322A', 'Toyota Axio', 'Saloon', 4, 'owned', null, 0, { date: '2022-03-01', price: 1900000 }),
    v('KCL523S', 'Toyota Alphard', 'Van', 7, 'monthly_hire', 'James Mwangi', 55000),
    v('KBN406B', 'Toyota Coaster', 'Bus', 26, 'monthly_hire', 'Grace Wanjiru', 60000),
    v('KCN265J', 'Toyota Noah', 'Van', 7, 'casual_hire', 'Peter Otieno', 0),
  ]

  const dr = (name: string, plate: string, phone: string): Driver =>
    ({ id: `drv-${plate}`, name, phone, license_no: null, default_vehicle_id: `veh-${plate}`, monthly_wage: 28000, status: 'active', created_at: '' })
  const drivers: Driver[] = [
    dr('David Matista', 'KCD196X', '0712 345 011'),
    dr('Moses Simiyu', 'KCH845Z', '0712 345 022'),
    dr('Titus Okola', 'KCL947Z', '0712 345 033'),
    dr('Daniel Muchina', 'KCC322A', '0712 345 044'),
    dr('Nicholas Ndavi', 'KCL523S', '0712 345 055'),
    dr('James Njogu', 'KBN406B', '0712 345 066'),
    dr('Abraham Otieno', 'KCN265J', '0712 345 077'),
  ]

  const organizations: Organization[] = [
    'World Bank', 'Safaricom', 'AATF', 'AU IBAR', 'APHRC', 'IFC', 'Stanbic Bank', 'FHF Kenya',
  ].map((name, i) => ({ id: `org-${i}`, name, contractor_id: null, active: true, created_at: '' }))

  const ROUTES: [string, string][] = [
    ['JKIA', 'Westlands'], ['Riverside Drive', 'JKIA'], ['JKIA', 'Kilimani'],
    ['Kitisuru', 'JKIA'], ['JKIA', 'South C'], ['Lavington', 'JKIA'],
    ['JKIA', 'Runda'], ['Karen', 'JKIA'], ['JKIA', 'Gigiri'], ['Hurlingham', 'JKIA'],
  ]
  const CLIENTS = [
    'AL Yamaa Kami', 'Judith Banu', 'John Oppong', 'Lydia Kinyanjui', 'Amadou Cisse',
    'Meimuna Abdikeir', 'Clayton Omwanga', 'Joyce Kimaru', 'Diana Opanga', 'Ernest Obeng',
    'Yeneneh Deneke', 'Caleb Muriuki', 'Martin Habel', 'Lucy Musira', 'Tania Begazo',
    'Vengai Chigudu', 'Bethel Wafula', 'Fred Gachoka', 'Gloria Tsentumbwe', 'Anne Kiura',
  ]
  const EXPRESS = [0, 250, 330, 410, 0, 250]
  const AMOUNTS = [1600, 2100, 2350, 2430, 2510, 2900, 3150, 3310]

  const now = new Date()
  const trips: Trip[] = []
  const fuel: FuelEntry[] = []
  let n = 0
  let fn = 0
  const odo: Record<string, number> = {}
  vehicles.forEach((v, i) => { odo[v.id] = 110000 + i * 7000 })

  // Six months of history (current month is partial up to today).
  for (let back = 5; back >= 0; back--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - back, 1)
    const y = monthDate.getFullYear(), m = monthDate.getMonth()
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const lastDay = back === 0 ? Math.min(now.getDate(), daysInMonth) : daysInMonth

    for (let day = 1; day <= lastDay; day++) {
      const perDay = 6 + (day % 4) // 6–9 trips a day across the fleet
      for (let k = 0; k < perDay; k++) {
        const [from, to] = ROUTES[n % ROUTES.length]
        const veh = vehicles[n % vehicles.length]
        const drv = drivers[n % drivers.length]
        const org = organizations[n % organizations.length]
        const con = contractors[n % contractors.length]
        const express = EXPRESS[n % EXPRESS.length]
        const amount = AMOUNTS[n % AMOUNTS.length] + express
        trips.push({
          id: uid('trip'),
          invoice_id: null,
          trip_date: iso(new Date(y, m, day)),
          client_name: CLIENTS[n % CLIENTS.length],
          slip_no: String(250000 + n),
          pickup: from, dropoff: to,
          pickup_time: `${String(5 + (n * 7) % 18).padStart(2, '0')}:${(n % 2) ? '30' : '00'}`,
          notes: express ? 'Via Expressway' : null,
          express_charges: express,
          voucher_no: String(170000 + n),
          organization_id: org.id,
          contractor_id: con.id,
          vehicle_id: veh.id,
          driver_id: drv.id,
          amount,
          distance_km: 12 + (n % 20),
          hire_cost: veh.ownership === 'casual_hire' ? Math.round(amount * 0.55) : 0,
          flight_no: null,
          flight_time: null,
          payment: n % 11 === 0 ? 'cash' : 'account',
          status: 'completed',
          assigned_by: null,
          assigned_at: null,
          created_by: null,
          created_at: '',
        })
        n++
      }
    }

    for (let day = 2; day <= lastDay; day += 2) {
      const veh = vehicles[fn % vehicles.length]
      const drv = drivers.find((x) => x.default_vehicle_id === veh.id) ?? null
      odo[veh.id] += 900 + (fn % 5) * 120
      fuel.push({
        id: uid('fuel'),
        fuel_date: iso(new Date(y, m, day)),
        vehicle_id: veh.id,
        driver_id: drv?.id ?? null,
        amount: 3000 + (fn % 4) * 1000,
        litres: 18 + (fn % 4) * 6,
        odometer: odo[veh.id],
        station: ['Shell', 'Total', 'Rubis'][fn % 3],
        mpesa_ref: null,
        notes: null,
        created_by: null,
        created_at: '',
      })
      fn++
    }
  }

  // Upcoming bookings for the dispatch & flights boards (today + next 2 days),
  // with a mix of statuses and some airport flights.
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const at = (dayOffset: number, hour: number, min = 0) =>
    new Date(today0.getFullYear(), today0.getMonth(), today0.getDate() + dayOffset, hour, min)
  type Booking = { d: number; client: string; from: string; to: string; org: number; con: number; amount: number; status: Trip['status']; veh?: number; drv?: number; flight?: string; fh?: number }
  const bookings: Booking[] = [
    { d: 0, client: 'Mr. Kwame Asante', from: 'JKIA', to: 'Villa Rosa Kempinski', org: 0, con: 0, amount: 2510, status: 'confirmed', veh: 0, drv: 0, flight: 'KQ101', fh: 9 },
    { d: 0, client: 'Ms. Aisha Mohammed', from: 'Westlands', to: 'JKIA', org: 1, con: 0, amount: 2100, status: 'confirmed', veh: 5, drv: 5, flight: 'WB402', fh: 14 },
    { d: 0, client: 'Dr. Samuel Eshetu', from: 'JKIA', to: 'Gigiri', org: 3, con: 2, amount: 2900, status: 'dispatched', veh: 2, drv: 2, flight: 'ET506', fh: 11 },
    { d: 0, client: 'Mrs. Linda Achieng', from: 'Karen', to: 'JKIA', org: 4, con: 0, amount: 3150, status: 'assigned', veh: 3, drv: 3 },
    { d: 0, client: 'Mr. Tendai Moyo', from: 'JKIA', to: 'Runda', org: 5, con: 1, amount: 3000, status: 'booked', flight: 'KL565', fh: 16 },
    { d: 0, client: 'Ms. Fatima Yusuf', from: 'CBD', to: 'JKIA', org: 1, con: 0, amount: 1900, status: 'booked' },
    { d: 0, client: 'Mr. George Otieno', from: 'Kitisuru', to: 'JKIA', org: 6, con: 2, amount: 2900, status: 'enroute', veh: 0, drv: 0 },
    { d: 1, client: 'Ms. Wanjiku Kamau', from: 'JKIA', to: 'Kilimani', org: 0, con: 0, amount: 2350, status: 'booked', flight: 'KQ310', fh: 8 },
    { d: 1, client: 'Mr. Ibrahim Diallo', from: 'Lavington', to: 'JKIA', org: 2, con: 1, amount: 2430, status: 'assigned', veh: 4, drv: 4 },
    { d: 1, client: 'Mrs. Grace Mensah', from: 'JKIA', to: 'Westlands', org: 7, con: 0, amount: 2100, status: 'confirmed', veh: 1, drv: 1, flight: 'QR1341', fh: 13 },
    { d: 2, client: 'Mr. Daniel Kiptoo', from: 'Runda', to: 'JKIA', org: 5, con: 2, amount: 3000, status: 'booked' },
    { d: 2, client: 'Ms. Zainab Ali', from: 'JKIA', to: 'South C', org: 3, con: 0, amount: 2350, status: 'assigned', veh: 6, drv: 6, flight: 'TK607', fh: 20 },
  ]
  bookings.forEach((b, i) => {
    const veh = b.veh != null ? vehicles[b.veh] : null
    const drv = b.drv != null ? drivers[b.drv] : null
    const airport = b.from === 'JKIA' || b.to === 'JKIA'
    trips.push({
      id: uid('trip'),
      invoice_id: null,
      trip_date: iso(at(b.d, 0)),
      client_name: b.client,
      slip_no: String(260000 + i),
      pickup: b.from, dropoff: b.to,
      pickup_time: `${String(6 + (i * 5) % 15).padStart(2, '0')}:00`,
      notes: null,
      express_charges: airport ? 330 : 0,
      voucher_no: String(181000 + i),
      organization_id: organizations[b.org].id,
      contractor_id: contractors[b.con].id,
      vehicle_id: veh ? veh.id : null,
      driver_id: drv ? drv.id : null,
      amount: b.amount,
      distance_km: 18,
      hire_cost: veh && veh.ownership === 'casual_hire' ? Math.round(b.amount * 0.55) : 0,
      flight_no: b.flight ?? null,
      flight_time: b.flight ? at(b.d, b.fh as number).toISOString() : null,
      payment: 'account',
      status: b.status,
      assigned_by: b.status === 'booked' ? null : 'Rachel (Office)',
      assigned_at: b.status === 'booked' ? null : at(b.d, 7, 30).toISOString(),
      created_by: null,
      created_at: '',
    })
  })

  // Servicing log — a couple of past services per vehicle
  const services: VehicleService[] = []
  vehicles.forEach((veh, i) => {
    const base = new Date(now.getFullYear(), now.getMonth() - (i % 4) - 1, 10 + (i % 15))
    services.push({
      id: uid('svc'),
      vehicle_id: veh.id,
      service_date: iso(base),
      odometer: (odo[veh.id] ?? 120000) - 3000,
      service_type: ['Full service', 'Brake pads', 'Tyres', 'Oil & filter'][i % 4],
      description: ['Engine oil, oil filter, air filter', 'Front brake pads replaced', '2 rear tyres replaced', 'Oil and oil filter change'][i % 4],
      cost: 8500 + (i % 5) * 2500,
      garage: ['Toyota Kenya', 'AutoXpress', 'Local garage'][i % 3],
      next_service_date: iso(new Date(now.getFullYear(), now.getMonth() + 1 + (i % 3), 10)),
      next_service_odometer: (odo[veh.id] ?? 120000) + 5000,
      notes: null,
      created_by: null,
      created_at: '',
    })
  })

  // Rate card — common JKIA routes priced per class
  const r = (pickup: string, dropoff: string, sal: number, wag: number, van: number, bus: number, km: number, min: number): Route =>
    ({ id: uid('route'), pickup, dropoff, price_saloon: sal, price_wagon: wag, price_van: van, price_bus: bus, distance_km: km, duration_min: min, active: true, notes: null, created_at: '' })
  const routes: Route[] = [
    r('Westlands', 'JKIA', 2100, 2300, 3500, 9000, 19, 35),
    r('JKIA', 'Westlands', 2100, 2300, 3500, 9000, 19, 35),
    r('Karen', 'JKIA', 3150, 3400, 4500, 11000, 24, 45),
    r('CBD', 'JKIA', 1900, 2100, 3200, 8500, 16, 30),
    r('Gigiri', 'JKIA', 2900, 3100, 4200, 10500, 23, 42),
    r('Runda', 'JKIA', 3000, 3200, 4300, 10500, 28, 50),
  ]

  // Compliance documents — insurance/inspection per vehicle, licence per driver,
  // with a few intentionally near expiry so the Attention panel lights up.
  const documents: ComplianceDoc[] = []
  const addDays = (days: number) => iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days))
  vehicles.forEach((veh, i) => {
    documents.push({
      id: uid('doc'), owner_kind: 'vehicle', vehicle_id: veh.id, driver_id: null,
      doc_type: 'Insurance', reference: `POL-${1000 + i}`, provider: ['Jubilee', 'APA', 'Britam'][i % 3],
      issue_date: addDays(-300 + i * 10), expiry_date: addDays([8, 25, 60, 95, 140, 200, 280][i % 7]),
      notes: null, attended: false, attended_on: null, attended_note: null, created_at: '',
    })
    documents.push({
      id: uid('doc'), owner_kind: 'vehicle', vehicle_id: veh.id, driver_id: null,
      doc_type: 'NTSA Inspection', reference: null, provider: 'NTSA',
      issue_date: addDays(-180 + i * 5), expiry_date: addDays([18, 45, 120, 5, 210, 75, 160][i % 7]),
      notes: null, attended: false, attended_on: null, attended_note: null, created_at: '',
    })
  })
  drivers.forEach((drv, i) => {
    documents.push({
      id: uid('doc'), owner_kind: 'driver', vehicle_id: null, driver_id: drv.id,
      doc_type: 'Driving Licence', reference: `DL-${5000 + i}`, provider: 'NTSA',
      issue_date: addDays(-700 + i * 20), expiry_date: addDays([30, 90, 12, 250, 400, -5, 180][i % 7]),
      notes: null, attended: false, attended_on: null, attended_note: null, created_at: '',
    })
  })

  // Expenses — driver wages each month + scattered running costs, across 6 months
  const expenses: Expense[] = []
  const exp = (date: Date, category: string, amount: number, opts: Partial<Expense> = {}) => {
    expenses.push({
      id: uid('exp'), expense_date: iso(date), category, amount,
      vehicle_id: opts.vehicle_id ?? null, driver_id: opts.driver_id ?? null,
      payee: opts.payee ?? null, description: opts.description ?? null, notes: null,
      created_by: null, created_at: '',
    })
  }
  for (let back = 5; back >= 0; back--) {
    const md = new Date(now.getFullYear(), now.getMonth() - back, 1)
    const y = md.getFullYear(), m = md.getMonth()
    // Driver wages (paid end of month)
    drivers.forEach((d, i) => exp(new Date(y, m, 28), 'Driver Wages', 6500 + (i % 3) * 500, { driver_id: d.id, payee: d.name }))
    // Recurring running costs
    exp(new Date(y, m, 5), 'Insurance', 4000, { description: 'Fleet insurance (monthly)' })
    exp(new Date(y, m, 1), 'Office/Admin', 5000)
    exp(new Date(y, m, 1), 'Airtime', 1500)
    exp(new Date(y, m, 12), 'Parking', 1200 + (m % 3) * 300)
    if (m % 2 === 0) exp(new Date(y, m, 18), 'Spare Parts', 3500 + (m % 4) * 800, { vehicle_id: vehicles[m % vehicles.length].id })
    if (m % 3 === 0) exp(new Date(y, m, 22), 'Fines', 1000, { description: 'Parking fine' })
    // Car wash — most cars washed 2–3×/month; the last vehicle is neglected (shows in insights)
    vehicles.forEach((veh, vi) => {
      if (vi === vehicles.length - 1) return
      exp(new Date(y, m, 8 + (vi % 4)), 'Car Wash', 500, { vehicle_id: veh.id })
      if (vi % 2 === 0) exp(new Date(y, m, 23), 'Car Wash', 500, { vehicle_id: veh.id })
    })
  }

  // Targets — current quarter: a deliberate mix of on-track and over-budget
  const q = Math.floor(now.getMonth() / 3) + 1
  const period = `${now.getFullYear()}-Q${q}`
  const targets: Target[] = [
    { id: uid('tgt'), period, kind: 'revenue', category: null, amount: 1800000, created_at: '' },
    { id: uid('tgt'), period, kind: 'profit', category: null, amount: 750000, created_at: '' },
    { id: uid('tgt'), period, kind: 'spend_cap', category: 'Fuel', amount: 180000, created_at: '' },
    { id: uid('tgt'), period, kind: 'spend_cap', category: 'Vehicle Hire', amount: 450000, created_at: '' },
    { id: uid('tgt'), period, kind: 'spend_cap', category: 'Driver Wages', amount: 150000, created_at: '' },
  ]

  // Invoices (receivables) — a mix of paid, outstanding and overdue
  const invoices: Invoice[] = []
  const inv = (con: Contractor, monthsAgo: number, amount: number, paid: number) => {
    const issue = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1)
    const due = new Date(issue.getFullYear(), issue.getMonth(), issue.getDate() + 30)
    const pStart = new Date(issue.getFullYear(), issue.getMonth() - 1, 1)
    const pEnd = new Date(issue.getFullYear(), issue.getMonth(), 0)
    invoices.push({
      id: uid('inv'), contractor_id: con.id,
      invoice_no: `INV-${1000 + invoices.length}`,
      period_label: `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][pStart.getMonth()]} ${pStart.getFullYear()}`,
      period_start: iso(pStart), period_end: iso(pEnd),
      issue_date: iso(issue), due_date: iso(due),
      amount, amount_paid: paid, paid_date: paid >= amount ? iso(due) : null,
      notes: null, created_by: null, created_at: '',
    })
  }
  inv(contractors[0], 3, 540000, 540000) // BCD, paid
  inv(contractors[0], 2, 610000, 610000) // BCD, paid
  inv(contractors[0], 1, 580000, 200000) // BCD, partial (overdue)
  inv(contractors[1], 2, 320000, 320000) // FCM, paid
  inv(contractors[1], 1, 410000, 0)      // FCM, unpaid (overdue)
  inv(contractors[1], 0, 380000, 0)      // FCM, current
  inv(contractors[0], 0, 600000, 0)      // BCD, current

  return { contractors, vehicles, drivers, organizations, profiles: [DEV_PROFILE], trips, fuel, services, routes, documents, expenses, targets, invoices }
}
