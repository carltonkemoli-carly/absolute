-- Apply first to a disposable/staging database, after existing migrations.
-- Transactional: legacy duplicate periods or overlaps abort without changing data.
begin;
create extension if not exists btree_gist;

-- Self-service profile updates must never allow role escalation.
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null
     and public.current_role_name() is distinct from 'owner'::public.user_role then
    raise exception 'Only an owner can change roles' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role before update on public.profiles
for each row execute function public.protect_profile_role();

-- Remove broad finance policies; permissive policies combine with OR.
do $$
declare t text; p record;
begin
  foreach t in array array['invoices','expenses','targets'] loop
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('create policy finance_access on public.%I for all to authenticated using (public.current_role_name() in (''owner'',''accountant'')) with check (public.current_role_name() in (''owner'',''accountant''))', t);
  end loop;
end $$;

-- No driver-wide access until user-to-driver ownership exists.
do $$
declare t text; p record;
begin
  foreach t in array array['contractors','organizations','vehicles','drivers','trips','fuel_entries','vehicle_services','routes','documents'] loop
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I',p.policyname,t);
    end loop;
    execute format('create policy staff_access on public.%I for all to authenticated using (public.current_role_name() in (''owner'',''accountant'',''office'')) with check (public.current_role_name() in (''owner'',''accountant'',''office''))',t);
  end loop;
end $$;
drop policy if exists company_rw on public.company;
create policy company_read on public.company for select to authenticated
  using (public.current_role_name() in ('owner','accountant','office'));
create policy company_owner_write on public.company for all to authenticated
  using (public.current_role_name()='owner') with check (public.current_role_name()='owner');

alter table public.trips add column if not exists invoice_id uuid references public.invoices(id) on delete set null;
-- Office users may edit trip operations, but cannot forge billing links.
create or replace function public.protect_trip_invoice_link()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if ((tg_op='INSERT' and new.invoice_id is not null) or
      (tg_op='UPDATE' and new.invoice_id is distinct from old.invoice_id))
     and auth.uid() is not null and
     (public.current_role_name() is null or public.current_role_name() not in ('owner','accountant')) then
    raise exception 'Finance access required for billing links' using errcode='42501';
  end if;
  return new;
end $$;
create trigger protect_trip_invoice_link before insert or update on public.trips
for each row execute function public.protect_trip_invoice_link();
create unique index if not exists invoices_contractor_period_unique
on public.invoices(contractor_id,period_start,period_end)
where contractor_id is not null and period_start is not null and period_end is not null;
alter table public.invoices add constraint invoices_payment_bounds
  check (amount >= 0 and amount_paid >= 0 and amount_paid <= amount);

create or replace function public.create_invoice_for_trips(p_invoice jsonb, p_trip_ids uuid[])
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare n integer; total numeric; result uuid; contractor uuid; first_day date; last_day date;
begin
  if public.current_role_name() is null or public.current_role_name() not in ('owner','accountant') then
    raise exception 'Finance access required' using errcode='42501';
  end if;
  contractor := (p_invoice->>'contractor_id')::uuid;
  first_day := (p_invoice->>'period_start')::date;
  last_day := (p_invoice->>'period_end')::date;
  if contractor is null or first_day is null or last_day is null or first_day > last_day
    or coalesce(cardinality(p_trip_ids),0)=0 or cardinality(p_trip_ids)>10000
    or exists (select 1 from unnest(p_trip_ids) x group by x having count(*)>1) then
    raise exception 'Invalid invoice selection';
  end if;
  -- Stable lock order avoids deadlocks between overlapping selections.
  perform id from public.trips where id=any(p_trip_ids) order by id for update;
  select count(*),sum(amount) into n,total from public.trips
    where id=any(p_trip_ids) and invoice_id is null and status='completed' and amount>coalesce(express_charges,0) and contractor_id=contractor
      and trip_date between first_day and last_day;
  if n <> cardinality(p_trip_ids) then raise exception 'Trips changed or are already billed. Refresh and retry.'; end if;
  insert into public.invoices(contractor_id,invoice_no,period_label,period_start,period_end,issue_date,due_date,amount,amount_paid,notes,created_by)
    values(contractor,p_invoice->>'invoice_no',p_invoice->>'period_label',first_day,last_day,
      (p_invoice->>'issue_date')::date,(p_invoice->>'due_date')::date,total,0,p_invoice->>'notes',auth.uid()) returning id into result;
  update public.trips set invoice_id=result where id=any(p_trip_ids);
  get diagnostics n = row_count;
  if n <> cardinality(p_trip_ids) then raise exception 'Trip linking failed'; end if;
  return result;
end $$;
revoke all on function public.create_invoice_for_trips(jsonb,uuid[]) from public, anon;
grant execute on function public.create_invoice_for_trips(jsonb,uuid[]) to authenticated;

-- Nairobi local wall-clock ranges; [start,end) permits adjacent jobs.
-- Unknown pickup conservatively reserves the whole day; known pickup two hours.
create or replace function public.dispatch_window(d date,t text)
returns tsrange language plpgsql immutable strict as $$
begin
  if t <> '' and t !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Pickup time must be HH:MM'; end if;
  if t = '' then return tsrange(d::timestamp,d::timestamp+interval '1 day','[)'); end if;
  return tsrange(d+t::time,d+t::time+interval '2 hours','[)');
end $$;
alter table public.trips add constraint trips_driver_no_overlap exclude using gist
  (driver_id with =, (public.dispatch_window(trip_date,coalesce(pickup_time,''))) with &&)
  where (driver_id is not null and status <> 'cancelled');
alter table public.trips add constraint trips_vehicle_no_overlap exclude using gist
  (vehicle_id with =, (public.dispatch_window(trip_date,coalesce(pickup_time,''))) with &&)
  where (vehicle_id is not null and status <> 'cancelled');
commit;
