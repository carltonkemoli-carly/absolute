-- Fuel from M-Pesa: allow fuel records without a vehicle (she pays the station
-- directly, so a payment isn't tied to one car) + store the M-Pesa reference so
-- re-importing a statement never double-counts. Run once in Supabase SQL Editor.
alter table fuel_entries alter column vehicle_id drop not null;
alter table fuel_entries add column if not exists mpesa_ref text;
create unique index if not exists fuel_mpesa_ref_uidx on fuel_entries(mpesa_ref) where mpesa_ref is not null;
