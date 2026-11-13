-- Read-only; run in staging/admin SQL Editor before migration-integrity.sql.
select role, count(*) from public.profiles group by role;
select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies where schemaname='public' order by tablename,policyname;
select contractor_id,period_start,period_end,count(*) from public.invoices
where contractor_id is not null and period_start is not null and period_end is not null
group by contractor_id,period_start,period_end having count(*)>1;
select id,amount,amount_paid from public.invoices
where amount < 0 or amount_paid < 0 or amount_paid > amount;
select id,invoice_id,status from public.trips
where invoice_id is not null and status <> 'completed';
select id,trip_date,pickup_time from public.trips
where coalesce(pickup_time,'')<>'' and pickup_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';
-- Invalid times produce NULL windows for reporting; fix them before migrating.
with reservations as (
 select id,driver_id,vehicle_id,
 case when coalesce(pickup_time,'')='' then tsrange(trip_date::timestamp,trip_date::timestamp+interval '1 day','[)')
 when pickup_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then tsrange(trip_date+pickup_time::time,trip_date+pickup_time::time+interval '2 hours','[)') end as slot
 from public.trips where status<>'cancelled'
)
select a.id as trip_a,b.id as trip_b,a.driver_id=b.driver_id as same_driver,a.vehicle_id=b.vehicle_id as same_vehicle
from reservations a join reservations b on a.id<b.id and a.slot && b.slot
and ((a.driver_id is not null and a.driver_id=b.driver_id) or (a.vehicle_id is not null and a.vehicle_id=b.vehicle_id));
