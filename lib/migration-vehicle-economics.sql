-- Vehicle lifetime economics + loan payback. Run once in Supabase → SQL Editor.
alter table vehicles add column if not exists purchase_date  date;
alter table vehicles add column if not exists purchase_price numeric(12,2) not null default 0;
alter table vehicles add column if not exists loan_amount    numeric(12,2) not null default 0;
alter table vehicles add column if not exists loan_monthly   numeric(12,2) not null default 0;
