-- Company profile for invoices (Settings → Company). Run once in Supabase SQL Editor.
create table if not exists company (
  id         int primary key default 1,
  name       text not null default 'Absolute Comfort Travel',
  tagline    text,
  location   text,
  email      text,
  phone      text,
  updated_at timestamptz not null default now(),
  constraint company_singleton check (id = 1)
);
insert into company (id, name) values (1, 'Absolute Comfort Travel') on conflict (id) do nothing;
alter table company enable row level security;
drop policy if exists company_rw on company;
create policy company_rw on company for all to authenticated using (true) with check (true);
