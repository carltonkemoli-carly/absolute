export type UserRole = 'owner' | 'accountant' | 'office' | 'driver'
export type VehicleStatus = 'active' | 'in_shop' | 'retired'
export type VehicleOwnership = 'owned' | 'monthly_hire' | 'casual_hire'
export type DriverStatus = 'active' | 'inactive'
export type TripStatus =
  | 'booked'
  | 'assigned'
  | 'dispatched'
  | 'confirmed'
  | 'enroute'
  | 'completed'
  | 'cancelled'
export type PaymentType = 'account' | 'cash'

export interface Profile {
  id: string
  full_name: string | null
  role: UserRole
  created_at: string
}

export interface Contractor {
  id: string
  name: string
  code: string | null
  billing_notes: string | null
  active: boolean
  created_at: string
}

export interface Organization {
  id: string
  name: string
  contractor_id: string | null
  active: boolean
  created_at: string
}

export interface Vehicle {
  id: string
  plate: string
  model: string | null
  vehicle_type: string | null
  capacity: number | null
  photo_url: string | null
  status: VehicleStatus
  ownership: VehicleOwnership
  owner_name: string | null
  monthly_fee: number
  purchase_date: string | null
  purchase_price: number
  loan_amount: number
  loan_monthly: number
  notes: string | null
  created_at: string
}

export const OWNERSHIP_LABELS: Record<VehicleOwnership, string> = {
  owned: 'Owned',
  monthly_hire: 'Monthly hire',
  casual_hire: 'Casual hire',
}

export interface Driver {
  id: string
  name: string
  phone: string | null
  license_no: string | null
  default_vehicle_id: string | null
  monthly_wage: number
  status: DriverStatus
  created_at: string
}

export interface Trip {
  id: string
  trip_date: string
  client_name: string
  slip_no: string | null
  pickup: string | null
  pickup_time: string | null   // "HH:MM" 24h — when the car picks up
  dropoff: string | null
  notes: string | null
  express_charges: number
  voucher_no: string | null
  organization_id: string | null
  contractor_id: string | null
  vehicle_id: string | null
  driver_id: string | null
  amount: number
  distance_km: number | null
  hire_cost: number
  invoice_id: string | null   // the invoice that billed this trip (null = unbilled)
  flight_no: string | null
  flight_time: string | null
  payment: PaymentType
  status: TripStatus
  assigned_by: string | null
  assigned_at: string | null
  created_by: string | null
  created_at: string
}

export interface FuelEntry {
  id: string
  fuel_date: string
  vehicle_id: string | null   // null = paid to station, car not attributed
  driver_id: string | null
  amount: number
  litres: number | null
  odometer: number | null
  station: string | null
  mpesa_ref: string | null    // M-Pesa receipt no. (dedup on statement re-import)
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface VehicleService {
  id: string
  vehicle_id: string
  service_date: string
  odometer: number | null
  service_type: string | null
  description: string | null
  cost: number
  garage: string | null
  next_service_date: string | null
  next_service_odometer: number | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface Route {
  id: string
  pickup: string
  dropoff: string
  price_saloon: number
  price_wagon: number
  price_van: number
  price_bus: number
  distance_km: number | null
  duration_min: number | null
  active: boolean
  notes: string | null
  created_at: string
}

export type DocOwnerKind = 'vehicle' | 'driver'
export interface ComplianceDoc {
  id: string
  owner_kind: DocOwnerKind
  vehicle_id: string | null
  driver_id: string | null
  doc_type: string
  reference: string | null
  provider: string | null
  issue_date: string | null
  expiry_date: string | null
  notes: string | null
  attended: boolean
  attended_on: string | null
  attended_note: string | null
  created_at: string
}

// Document type options by owner
export const VEHICLE_DOC_TYPES = ['Insurance', 'NTSA Inspection', 'Speed Governor', 'Logbook'] as const
export const DRIVER_DOC_TYPES = ['Driving Licence', 'PSV Badge', 'Good Conduct', 'Medical'] as const

// Vehicle classes used for route pricing (aligned with vehicles.vehicle_type)
export const VEHICLE_CLASSES = ['Saloon', 'Wagon', 'Van', 'Bus'] as const
export type VehicleClass = (typeof VEHICLE_CLASSES)[number]

export interface Expense {
  id: string
  expense_date: string
  category: string
  amount: number
  vehicle_id: string | null
  driver_id: string | null
  payee: string | null
  description: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export type TargetKind = 'revenue' | 'profit' | 'spend_cap'
export interface Target {
  id: string
  period: string // e.g. '2026-Q3'
  kind: TargetKind
  category: string | null // for spend_cap: the cost category
  amount: number
  created_at: string
}

// Expense categories (everything except Fuel & Servicing, which have their own logs)
export const EXPENSE_CATEGORIES = [
  'Driver Wages', 'Driver Allowance', 'Car Wash', 'Insurance', 'Parking', 'Fines',
  'Spare Parts', 'Tyres', 'Office/Admin', 'Airtime', 'Licensing & Fees',
  'Commission', 'Other',
] as const

// All cost categories used in the P&L. Fuel & Servicing come from their tables;
// Vehicle Hire is computed from hired vehicles + casual trip hire costs.
export const COST_CATEGORIES = ['Fuel', 'Servicing', 'Vehicle Hire', ...EXPENSE_CATEGORIES] as const

export interface Invoice {
  id: string
  contractor_id: string | null
  invoice_no: string | null
  period_label: string | null
  period_start: string | null   // trip-generated invoices: billed range start (YYYY-MM-DD)
  period_end: string | null     // billed range end
  issue_date: string | null
  due_date: string | null
  amount: number
  amount_paid: number
  paid_date: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

// Company profile shown on invoices (editable in Settings → Company)
export interface Company {
  name: string
  tagline: string | null
  location: string | null
  email: string | null
  phone: string | null
}
export const DEFAULT_COMPANY: Company = {
  name: 'Absolute Comfort Travel',
  tagline: 'Executive Airport Transfers & Client Transport',
  location: 'Nairobi, Kenya',
  email: 'absolutecomfort@gmail.com',
  phone: '+254 700 000 000',
}

// Roles allowed to view financial figures (revenue, profit, fuel index)
export const FINANCE_ROLES: UserRole[] = ['owner', 'accountant']
