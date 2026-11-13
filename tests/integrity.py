"""Synthetic integration tests. Requires a local postgres:17 Docker container.
Run: python tests/integrity.py [container-name] (default: absolute-test-db).
Creates and drops its own database; never accepts a remote database URL.
"""
import concurrent.futures
import json
from pathlib import Path
import subprocess
import sys
import uuid

container = sys.argv[1] if len(sys.argv) > 1 else 'absolute-test-db'
database = 'act_synthetic_' + uuid.uuid4().hex
root = Path(__file__).resolve().parents[1]

def sql(text, ok=True, db=database):
    r = subprocess.run(['docker', '--host=unix:///var/run/docker.sock', 'exec', '-i', container,
                        'psql', '-X', '-U', 'postgres', '-d', db, '-At', '-v', 'ON_ERROR_STOP=1'],
                       input=text, text=True, capture_output=True)
    if ok and r.returncode:
        raise AssertionError(r.stderr)
    if not ok:
        assert r.returncode != 0, 'Expected database rejection'
    return r

def uid(): return str(uuid.uuid4())
owner, accountant, office, driver = [uid() for _ in range(4)]
contractor, v, d = uid(), uid(), uid()
def as_user(user, statement):
    return f"set role authenticated; set request.jwt.claim.sub='{user}'; {statement}"

def trip(id=None, date='2026-11-10', time='10:00', resource=None, status='assigned', amount=1250):
    id = id or uid()
    vehicle = f"'{resource}'" if resource else 'null'
    pickup = f"'{time}'" if time is not None else 'null'
    return f"insert into trips(id,trip_date,pickup_time,client_name,contractor_id,vehicle_id,amount,status) values('{id}','{date}',{pickup},'Synthetic passenger','{contractor}',{vehicle},{amount},'{status}');"

def invoice(ids, start='2026-11-01', end='2026-11-30'):
    payload = json.dumps(dict(contractor_id=contractor,period_start=start,period_end=end,amount=0,amount_paid=999999))
    return f"select create_invoice_for_trips('{payload}'::jsonb, ARRAY[{','.join(repr(x) for x in ids)}]::uuid[]);"

try:
    sql(f'create database {database}', db='postgres')
    sql("""create schema auth;
create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth,public to authenticated,anon;
""" + (root/'lib/schema.sql').read_text() + (root/'lib/migration-company.sql').read_text()
        + (root/'lib/migration-integrity.sql').read_text()
        + '\ngrant select,insert,update,delete on all tables in schema public to authenticated;')
    for user, role in [(owner,'owner'),(accountant,'accountant'),(office,'office'),(driver,'driver')]:
        sql(f"insert into auth.users(id,email) values('{user}','synthetic-{role}@example.invalid'); update profiles set role='{role}' where id='{user}';")
    sql(f"insert into contractors(id,name) values('{contractor}','Synthetic contractor'); insert into vehicles(id,plate) values('{v}','TEST-ONLY'); insert into drivers(id,name) values('{d}','Synthetic driver');")
    sql(as_user(office,f"update profiles set full_name='Synthetic name' where id='{office}';"))
    sql(as_user(office,f"update profiles set role='owner' where id='{office}';"),ok=False)
    sql(as_user(owner,f"update profiles set role='accountant' where id='{office}'; update profiles set role='office' where id='{office}';"))
    print('PASS: self escalation denied; self name and owner role management allowed')
    for user in [office,driver]:
        sql(as_user(user,"insert into invoices(amount) values(1);"),ok=False)
        assert sql(as_user(user,'select count(*) from invoices;')).stdout.strip().endswith('0')
    sql(as_user(driver,trip()),ok=False)
    sql(as_user(office,trip()))
    print('PASS: finance RLS and driver operational denial')
    t1,t2=uid(),uid()
    sql(trip(t1,status='completed')+trip(t2,amount=2750,status='completed'))
    booked,cancelled,no_fare=uid(),uid(),uid()
    sql(trip(booked,time='15:00',status='booked')+trip(cancelled,time='17:00',status='cancelled'))
    sql(trip(no_fare,time='19:00',status='completed',amount=0))
    sql(as_user(owner,invoice([booked])),ok=False)
    sql(as_user(owner,invoice([cancelled])),ok=False)
    sql(as_user(owner,invoice([no_fare])),ok=False)
    sql(as_user(office,invoice([t1,t2])),ok=False)
    sql(as_user(owner,invoice([t1,uid()])),ok=False)
    assert sql('select count(*) from invoices').stdout.strip()=='0'
    sql(as_user(accountant,invoice([t1,t2])))
    assert sql('select amount,amount_paid from invoices').stdout.strip()=='4000.00|0.00'
    sql(as_user(owner,"update invoices set amount_paid=4001;"),ok=False)
    sql(as_user(owner,"update invoices set amount_paid=-1;"),ok=False)
    sql(as_user(office,f"update trips set invoice_id=null where id='{t1}';"),ok=False)
    sql(as_user(owner,invoice([t1])),ok=False)
    assert sql('select count(*) from invoices').stdout.strip()=='1'
    assert sql(f"select count(*) from trips where id in ('{t1}','{t2}') and invoice_id is not null").stdout.strip()=='2'
    sql(as_user(owner,'delete from invoices;'))
    assert sql('select count(*) from trips where invoice_id is not null').stdout.strip()=='0'
    print('PASS: atomic invoice total/linking; invalid selection rollback; billed trip rejection; FK release')
    # A trigger failure during linking must roll back the inserted invoice.
    sql("create function fail_link() returns trigger language plpgsql as $$ begin raise exception 'synthetic linking failure'; end $$; create trigger fail_link before update of invoice_id on trips for each row execute function fail_link();")
    sql(as_user(owner,invoice([t1,t2])),ok=False)
    assert sql('select count(*) from invoices').stdout.strip()=='0'
    sql('drop trigger fail_link on trips;')
    print('PASS: linking failure leaves no partial invoice')
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        def race(_):
            return sql(as_user(owner,'begin;'+invoice([t1,t2])+'select pg_sleep(0.3); commit;'),ok=True)
        futures=[pool.submit(race,i) for i in range(2)]
        results=[]
        for f in futures:
            try: f.result(); results.append(True)
            except AssertionError: results.append(False)
    assert sum(results)==1
    assert sql('select count(*) from invoices').stdout.strip()=='1'
    extra=uid(); sql(trip(extra,status='completed'))
    sql(as_user(owner,invoice([extra])),ok=False)
    assert sql(f"select invoice_id is null from trips where id='{extra}'").stdout.strip()=='t'
    print('PASS: concurrent invoice requests create exactly one invoice; same-period different trips rejected')
    sql(trip(resource=v,time='23:30'))
    sql(trip(resource=v,date='2026-11-11',time='00:30'),ok=False)
    sql(trip(resource=v,date='2026-11-11',time='01:30'))
    sql(trip(resource=v,date='2026-11-11',time=None),ok=False)
    sql(trip(resource=v,time='23:40',status='cancelled'))
    print('PASS: cross-midnight overlaps denied; adjacent windows allowed; unknown time reserves day; cancellation releases')
    sql(f"insert into trips(trip_date,client_name,driver_id,pickup_time) values('2026-11-12','Synthetic','{d}','09:00');")
    sql(f"insert into trips(trip_date,client_name,driver_id,pickup_time) values('2026-11-12','Synthetic','{d}','09:30');",ok=False)
    free=uid(); sql(trip(free,date='2026-11-12',time='10:00'))
    sql(f"update trips set driver_id='{d}' where id='{free}';",ok=False)
    sql(trip(date='2026-11-12',time='25:00',resource=v),ok=False)
    print('PASS: driver conflicts and direct-edit bypass denied; invalid time rejected')
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        def race_dispatch(_):
            try:
                sql('begin;'+trip(resource=v,date='2026-11-15')+'select pg_sleep(0.3); commit;')
                return True
            except AssertionError: return False
        assert sum(pool.map(race_dispatch,range(2)))==1
    print('PASS: concurrent dispatch requests cannot double book')
finally:
    sql(f'drop database if exists {database} with (force)', db='postgres')
