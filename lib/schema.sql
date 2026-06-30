-- =============================================================================
-- Absolute Comfort Travel — Operations & Finance System
-- Supabase / Postgres schema
--
-- Run this in your Supabase project: SQL Editor → paste → Run.
-- Safe to re-run (uses IF NOT EXISTS / ON CONFLICT where possible).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('owner', 'accountant', 'office', 'driver');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vehicle_status as enum ('active', 'in_shop', 'retired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vehicle_ownership as enum ('owned', 'monthly_hire', 'casual_hire');
exception when duplicate_object then null; end $$;

do $$ begin
  create type driver_status as enum ('active', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  -- Full dispatch lifecycle; V1 logging uses 'completed' by default.
  create type trip_status as enum
    ('booked', 'assigned', 'dispatched', 'confirmed', 'enroute', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_type as enum ('account', 'cash');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user, carries the role
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        user_role not null default 'office',
  created_at  timestamptz not null default now()
);

-- New signups get a profile automatically (role defaults to 'office';
-- an owner promotes them from the Users screen).
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_first boolean;
begin
  -- The very first person to register becomes the owner; everyone after
  -- starts as 'office' and an owner promotes them from the Users screen.
  select not exists (select 1 from public.profiles) into is_first;
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    case when is_first then 'owner'::user_role else 'office'::user_role end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Helper: current user's role (used in RLS policies)
create or replace function current_role_name()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- contractors — who the job comes through (your "COMPANY" column)
-- ---------------------------------------------------------------------------
create table if not exists contractors (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  code         text,
  billing_notes text,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- organizations — the end client (your "ORGANIZATION" column)
-- ---------------------------------------------------------------------------
create table if not exists organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  contractor_id uuid references contractors(id) on delete set null,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- vehicles — the fleet
-- ---------------------------------------------------------------------------
create table if not exists vehicles (
  id           uuid primary key default gen_random_uuid(),
  plate        text not null unique,
  model        text,                       -- e.g. Toyota Noah, Hiace, Coaster
  vehicle_type text,                        -- Saloon / Van / Bus / Wagon
  capacity     int,
  photo_url    text,
  status       vehicle_status not null default 'active',
  ownership    vehicle_ownership not null default 'owned',
  owner_name   text,                         -- for hired vehicles: who owns it
  monthly_fee  numeric(10,2) not null default 0,  -- for monthly_hire: fixed fee
  notes        text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- drivers
-- ---------------------------------------------------------------------------
create table if not exists drivers (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  phone              text,
  license_no         text,
  default_vehicle_id uuid references vehicles(id) on delete set null,
  status             driver_status not null default 'active',
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- trips — the core record (one row per job, like a spreadsheet line)
-- ---------------------------------------------------------------------------
create table if not exists trips (
  id              uuid primary key default gen_random_uuid(),
  trip_date       date not null,
  client_name     text not null,
  slip_no         text,                     -- internal job slip / ticket no
  pickup          text,                     -- FROM
  dropoff         text,                     -- TO
  notes           text,
  express_charges numeric(10,2) not null default 0,  -- expressway toll (reimbursable)
  voucher_no      text,                     -- contractor's reference
  organization_id uuid references organizations(id) on delete set null,
  contractor_id   uuid references contractors(id) on delete set null,
  vehicle_id      uuid references vehicles(id) on delete set null,
  driver_id       uuid references drivers(id) on delete set null,
  amount          numeric(10,2) not null default 0,   -- billed amount
  distance_km     numeric(10,2),
  hire_cost       numeric(10,2) not null default 0,    -- paid to owner for a casual-hired vehicle
  flight_no       text,                                -- airport jobs: flight number
  flight_time     timestamptz,                         -- scheduled arrival/departure
  assigned_by     text,                                -- who assigned the driver
  assigned_at     timestamptz,                         -- when it was assigned
  payment         payment_type not null default 'account',
  status          trip_status not null default 'completed',
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists trips_date_idx        on trips(trip_date);
create index if not exists trips_contractor_idx   on trips(contractor_id);
create index if not exists trips_vehicle_idx      on trips(vehicle_id);
create index if not exists trips_driver_idx       on trips(driver_id);

-- ---------------------------------------------------------------------------
-- fuel_entries — fuel put per car, per day
-- ---------------------------------------------------------------------------
create table if not exists fuel_entries (
  id         uuid primary key default gen_random_uuid(),
  fuel_date  date not null,
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  driver_id  uuid references drivers(id) on delete set null,
  amount     numeric(10,2) not null default 0,  -- KES
  litres     numeric(10,2),
  odometer   int,
  station    text,
  notes      text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists fuel_date_idx    on fuel_entries(fuel_date);
create index if not exists fuel_vehicle_idx  on fuel_entries(vehicle_id);

-- ---------------------------------------------------------------------------
-- vehicle_services — maintenance / servicing log
-- ---------------------------------------------------------------------------
create table if not exists vehicle_services (
  id                    uuid primary key default gen_random_uuid(),
  vehicle_id            uuid not null references vehicles(id) on delete cascade,
  service_date          date not null,
  odometer              int,
  service_type          text,                 -- Full service, Tyres, Brakes…
  description           text,                 -- what was changed
  cost                  numeric(10,2) not null default 0,
  garage                text,
  next_service_date     date,
  next_service_odometer int,
  notes                 text,
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now()
);
create index if not exists services_vehicle_idx on vehicle_services(vehicle_id);
create index if not exists services_date_idx     on vehicle_services(service_date);

-- ---------------------------------------------------------------------------
-- routes — rate card with per-class pricing
-- ---------------------------------------------------------------------------
create table if not exists routes (
  id           uuid primary key default gen_random_uuid(),
  pickup       text not null,
  dropoff      text not null,
  price_saloon numeric(10,2) not null default 0,
  price_wagon  numeric(10,2) not null default 0,
  price_van    numeric(10,2) not null default 0,
  price_bus    numeric(10,2) not null default 0,
  distance_km  numeric(10,2),
  duration_min int,
  active       boolean not null default true,
  notes        text,
  created_at   timestamptz not null default now(),
  unique (pickup, dropoff)
);

-- ---------------------------------------------------------------------------
-- documents — compliance docs with expiry (vehicle & driver)
-- ---------------------------------------------------------------------------
create table if not exists documents (
  id          uuid primary key default gen_random_uuid(),
  owner_kind  text not null check (owner_kind in ('vehicle', 'driver')),
  vehicle_id  uuid references vehicles(id) on delete cascade,
  driver_id   uuid references drivers(id) on delete cascade,
  doc_type    text not null,         -- Insurance, NTSA Inspection, Driving Licence…
  reference   text,
  provider    text,
  issue_date  date,
  expiry_date date,
  notes       text,
  attended      boolean not null default false,
  attended_on   date,
  attended_note text,
  created_at  timestamptz not null default now()
);
create index if not exists documents_expiry_idx on documents(expiry_date);

-- ---------------------------------------------------------------------------
-- expenses — all costs except fuel & servicing (which have their own logs):
-- driver wages, insurance, parking, fines, spares, admin…
-- ---------------------------------------------------------------------------
create table if not exists expenses (
  id           uuid primary key default gen_random_uuid(),
  expense_date date not null,
  category     text not null,
  amount       numeric(10,2) not null default 0,
  vehicle_id   uuid references vehicles(id) on delete set null,
  driver_id    uuid references drivers(id) on delete set null,
  payee        text,
  description  text,
  notes        text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists expenses_date_idx     on expenses(expense_date);
create index if not exists expenses_category_idx  on expenses(category);

-- ---------------------------------------------------------------------------
-- targets — quarterly revenue / profit goals and per-category spend caps
-- ---------------------------------------------------------------------------
create table if not exists targets (
  id         uuid primary key default gen_random_uuid(),
  period     text not null,                 -- e.g. '2026-Q3'
  kind       text not null,                 -- revenue | profit | spend_cap
  category   text,                          -- cost category for spend_cap
  amount     numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (period, kind, category)
);

-- ---------------------------------------------------------------------------
-- invoices — receivables: what you've billed each contractor vs paid
-- ---------------------------------------------------------------------------
create table if not exists invoices (
  id            uuid primary key default gen_random_uuid(),
  contractor_id uuid references contractors(id) on delete set null,
  invoice_no    text,
  period_label  text,                  -- e.g. 'June 2026'
  period_start  date,                  -- trip-generated invoices: billed range start
  period_end    date,                  -- billed range end
  issue_date    date,
  due_date      date,
  amount        numeric(12,2) not null default 0,
  amount_paid   numeric(12,2) not null default 0,
  paid_date     date,
  notes         text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists invoices_contractor_idx on invoices(contractor_id);
create index if not exists invoices_due_idx        on invoices(due_date);

-- =============================================================================
-- Row Level Security
-- V1: any authenticated staff member can read/write operational data.
-- Only owners can manage profiles/roles. Finance gating is enforced in the
-- app layer (owner + accountant) for V1; tighten here later if needed.
-- =============================================================================
alter table profiles      enable row level security;
alter table contractors   enable row level security;
alter table organizations enable row level security;
alter table vehicles      enable row level security;
alter table drivers       enable row level security;
alter table trips         enable row level security;
alter table fuel_entries  enable row level security;
alter table vehicle_services enable row level security;
alter table routes        enable row level security;
alter table documents     enable row level security;
alter table expenses      enable row level security;
alter table targets       enable row level security;
alter table invoices      enable row level security;

-- profiles: everyone reads; users update their own name; owners manage all
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select to authenticated using (true);

drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_owner_all on profiles;
create policy profiles_owner_all on profiles for all to authenticated
  using (current_role_name() = 'owner') with check (current_role_name() = 'owner');

-- Operational tables: authenticated full access (V1). Applied per table below.
do $$
declare t text;
begin
  foreach t in array array['contractors','organizations','vehicles','drivers','trips','fuel_entries','vehicle_services','routes','documents','expenses','targets','invoices']
  loop
    execute format('drop policy if exists %I_rw on %I', t, t);
    execute format(
      'create policy %I_rw on %I for all to authenticated using (true) with check (true)',
      t, t);
  end loop;
end $$;
