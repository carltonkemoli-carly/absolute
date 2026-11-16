-- Payment ledger: one row per receipt against an invoice.
-- Run once in Supabase → SQL Editor, after migration-integrity.sql.
--
-- Until now an invoice stored only a running amount_paid, which cannot prove
-- any individual receipt, refund or M-Pesa reference. Each payment is now its
-- own row, and the invoice's amount_paid / paid_date are derived from the rows
-- by trigger, so the two can never disagree. The application keeps working
-- before this runs (it falls back to adjusting amount_paid directly).
begin;

create table if not exists public.invoice_payments (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices(id) on delete cascade,
  amount      numeric(12,2) not null check (amount > 0),
  paid_on     date not null,
  method      text not null default 'other'
              check (method in ('mpesa','bank','cash','cheque','other')),
  reference   text,            -- M-Pesa code, bank reference, cheque number
  note        text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists invoice_payments_invoice_idx on public.invoice_payments(invoice_id, paid_on);

-- amount_paid is the sum of the ledger; paid_date is the day the balance
-- reached zero (null while anything is still owed). An insert that would take
-- the ledger past the invoice amount is refused.
create or replace function public.sync_invoice_paid()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare target uuid; total numeric; cleared date; billed numeric;
begin
  target := coalesce(new.invoice_id, old.invoice_id);
  select amount into billed from public.invoices where id = target for update;
  if billed is null then return null; end if;
  select coalesce(sum(amount), 0) into total from public.invoice_payments where invoice_id = target;
  if total > billed then
    raise exception 'Payments (%) would exceed the invoice amount (%)', total, billed using errcode = '23514';
  end if;
  if total >= billed and billed > 0 then
    -- the receipt that cleared the balance: latest date, then latest entered
    select paid_on into cleared from public.invoice_payments
      where invoice_id = target order by paid_on desc, created_at desc limit 1;
  end if;
  update public.invoices set amount_paid = total, paid_date = cleared where id = target;
  return null;
end $$;
drop trigger if exists sync_invoice_paid on public.invoice_payments;
create trigger sync_invoice_paid after insert or update or delete on public.invoice_payments
for each row execute function public.sync_invoice_paid();

-- Changing an invoice's amount below what has been received is refused too.
create or replace function public.protect_invoice_amount()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare total numeric;
begin
  if new.amount is distinct from old.amount then
    select coalesce(sum(amount), 0) into total from public.invoice_payments where invoice_id = new.id;
    if total > new.amount then
      raise exception 'Invoice amount (%) is below the payments already received (%)', new.amount, total using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists protect_invoice_amount on public.invoices;
create trigger protect_invoice_amount before update on public.invoices
for each row execute function public.protect_invoice_amount();

-- Same access as invoices: finance roles only.
alter table public.invoice_payments enable row level security;
drop policy if exists finance_access on public.invoice_payments;
create policy finance_access on public.invoice_payments for all to authenticated
  using (public.current_role_name() in ('owner','accountant'))
  with check (public.current_role_name() in ('owner','accountant'));
grant select, insert, update, delete on public.invoice_payments to authenticated;

-- Give every invoice that already carries a paid amount one opening ledger row,
-- so totals agree from day one. The trigger re-derives amount_paid from it.
insert into public.invoice_payments (invoice_id, amount, paid_on, method, note)
select id, amount_paid, coalesce(paid_date, issue_date, created_at::date), 'other',
       'Opening balance: payments received before the ledger existed'
from public.invoices
where amount_paid > 0
  and not exists (select 1 from public.invoice_payments p where p.invoice_id = invoices.id);

commit;
