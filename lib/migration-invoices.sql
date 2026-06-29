-- Receivables: run this once in Supabase → SQL Editor → Run
create table if not exists invoices (
  id            uuid primary key default gen_random_uuid(),
  contractor_id uuid references contractors(id) on delete set null,
  invoice_no    text,
  period_label  text,
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
create index if not exists invoices_due_idx on invoices(due_date);
alter table invoices enable row level security;
drop policy if exists invoices_rw on invoices;
create policy invoices_rw on invoices for all to authenticated using (true) with check (true);
