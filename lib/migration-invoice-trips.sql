-- Links each trip to the invoice that billed it.
-- Without this the system cannot answer "what work have we not billed yet?",
-- and nothing stops the same month being invoiced twice.
-- Run this once in Supabase → SQL Editor → Run.
alter table trips add column if not exists invoice_id uuid references invoices(id) on delete set null;
create index if not exists trips_invoice_id_idx on trips(invoice_id);
