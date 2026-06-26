-- =============================================================================
-- Seed data — real fleet, drivers and contractors from the BCD spreadsheets.
-- Run AFTER schema.sql. Safe to re-run.
-- Models/capacities are best-guess; edit them in the app once confirmed.
-- =============================================================================

-- Contractors (the "COMPANY" column: who the job comes through)
insert into contractors (name, code) values
  ('BCD',      'BCD'),
  ('FCM',      'FCM'),
  ('Absolute', 'ABS')
on conflict (name) do nothing;

-- Vehicles — real plates seen in the FUEL sheet
insert into vehicles (plate, model, vehicle_type) values
  ('KCD196X', null, null),
  ('KCH845Z', null, null),
  ('KCL947Z', null, null),
  ('KCC322A', null, null),
  ('KCL523S', null, null),
  ('KBN406B', null, null),
  ('KCN265J', null, null),
  ('KCQ389A', null, null),
  ('KCK334K', null, null),
  ('KCL497Z', null, null)
on conflict (plate) do nothing;

-- Drivers — names from the FUEL / 2018 sheets, linked to their usual vehicle
insert into drivers (name, default_vehicle_id) values
  ('David Matista',   (select id from vehicles where plate = 'KCD196X')),
  ('Moses Simiyu',    (select id from vehicles where plate = 'KCH845Z')),
  ('Titus Okola',     (select id from vehicles where plate = 'KCL947Z')),
  ('Daniel Muchina',  (select id from vehicles where plate = 'KCC322A')),
  ('Nicholas Ndavi',  (select id from vehicles where plate = 'KCL523S')),
  ('James Njogu',     (select id from vehicles where plate = 'KBN406B')),
  ('Abraham',         (select id from vehicles where plate = 'KCQ389A'))
on conflict do nothing;

-- Starter rate card — common JKIA routes priced per vehicle class
insert into routes (pickup, dropoff, price_saloon, price_wagon, price_van, price_bus, distance_km, duration_min) values
  ('Westlands', 'JKIA', 2100, 2300, 3500, 9000, 19, 35),
  ('JKIA', 'Westlands', 2100, 2300, 3500, 9000, 19, 35),
  ('Karen', 'JKIA', 3150, 3400, 4500, 11000, 24, 45),
  ('CBD', 'JKIA', 1900, 2100, 3200, 8500, 16, 30),
  ('Gigiri', 'JKIA', 2900, 3100, 4200, 10500, 23, 42),
  ('Runda', 'JKIA', 3000, 3200, 4300, 10500, 28, 50)
on conflict (pickup, dropoff) do nothing;

-- A starter set of end-client organizations seen in the data
insert into organizations (name) values
  ('World Bank'), ('Safaricom'), ('AATF'), ('AU IBAR'), ('APHRC'),
  ('IFC'), ('Stanbic Bank'), ('FHF Kenya'), ('World Vision'), ('Plan International'),
  ('SAP'), ('Bata'), ('ADRA Africa'), ('ECHO')
on conflict (name) do nothing;
