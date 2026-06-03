-- ============================================================
-- RESET — ล้างของเดิมทิ้งก่อน (รันซ้ำกี่รอบก็ได้ ไม่ error)
-- ============================================================
drop trigger if exists on_auth_user_created on auth.users;
drop schema if exists public cascade;
create schema public;
grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to postgres, service_role;

-- ============================================================
-- JR OMS — 0001 Schema (enums, tables, indexes)
-- ยอดงาน = ยอดก่อน VAT หักส่วนลดแล้ว (OQ-04)
-- Job code = JR{YYYY}-{NNN} ต่อเลขเดิม (OQ-01)
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- ENUMS ----------
create type role_t            as enum ('ADMIN','SALES','DESIGNER','PRODUCTION','INSTALLER','ACCOUNTING','VIEWER');
create type channel_t         as enum ('LINE','FACEBOOK','INSTAGRAM','OTHER');
create type job_status_t      as enum ('PENDING_QUOTE','QUOTE_SENT','PENDING_DECISION','DEPOSITED','CANCELLED','COMPLETED');
create type prod_status_t     as enum ('PENDING_MEASURE','MEASURED','PENDING_MEETING','REVISING','PENDING_CONFIRM','QUEUED','MANUFACTURING','QC','READY','ISSUE');
create type inst_status_t     as enum ('PENDING','INSTALLING','PENDING_INSPECT','REVISING','COMPLETED','ISSUE');
create type inspect_result_t  as enum ('PASSED','MINOR_FIX','REJECTED');
create type qc_result_t       as enum ('PASSED','FAILED');
create type issue_status_t    as enum ('OPEN','IN_PROGRESS','CLOSED');
create type issue_phase_t     as enum ('SALES','MEASUREMENT','PRODUCTION','INSTALLATION','POST_SALE');
create type issue_type_t      as enum ('WRONG_DESIGN','CUSTOMER_CHANGES','MATERIAL_SHORTAGE','PRODUCTION_DELAY','INSTALLATION_DELAY','CUSTOMER_COMPLAINT','OTHER');
create type payment_type_t    as enum ('DEPOSIT','INSTALLMENT_2','INSTALLMENT_3','FINAL');
create type payment_channel_t as enum ('TRANSFER','CASH','CHEQUE');

-- ---------- PROFILES (1:1 กับ auth.users, เก็บ role) ----------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  role        role_t not null default 'VIEWER',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- JOB SEQUENCE (running per year) ----------
create table public.job_sequence (
  year      int primary key,
  last_seq  int not null default 0
);

-- ---------- JOBS (Master) ----------
create table public.jobs (
  id              uuid primary key default gen_random_uuid(),
  job_code        text unique,                         -- JR2026-001 (auto trigger)
  year            int  not null,
  sequence        int  not null,
  customer_name   text not null,
  customer_tel    text,
  customer_area   text,
  channel         channel_t not null default 'OTHER',
  assess_date     date not null default current_date,
  estimator_id    uuid references public.profiles(id),
  designer_id     uuid references public.profiles(id),
  design_start    date,
  design_end      date,
  quote_sent_date date,
  -- การเงิน (OQ-04)
  discount_amount numeric(12,2),
  net_amount      numeric(12,2),                       -- ยอดก่อน VAT หักส่วนลดแล้ว
  vat_amount      numeric(12,2),                       -- net * 0.07
  total_amount    numeric(12,2),                       -- net + vat
  status          job_status_t not null default 'PENDING_QUOTE',
  deposit_amount  numeric(12,2),
  deposit_date    date,
  cancel_reason   text,
  remark          text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index jobs_status_idx   on public.jobs(status);
create index jobs_year_seq_idx on public.jobs(year, sequence);
create index jobs_name_idx     on public.jobs(customer_name);

-- ---------- PRODUCTION (Phase 2) ----------
create table public.productions (
  id                    uuid primary key default gen_random_uuid(),
  job_id                uuid not null unique references public.jobs(id) on delete cascade,
  status                prod_status_t not null default 'PENDING_MEASURE',
  planned_install_date  date,
  measure_scheduled     date,
  measure_actual        date,
  measurer_id           uuid references public.profiles(id),
  meeting_after_measure date,
  design_revision_done  date,
  quote_revision_done   date,
  customer_confirmed    date,
  production_queued     date,
  alum_order_date       date,
  glass_order_date      date,
  production_done       date,
  qc_result             qc_result_t,
  qc_date               date,
  qc_note               text,
  notes                 text,
  status_updated_at     timestamptz,
  remark                text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index productions_status_idx on public.productions(status);

-- ---------- INSTALLATION (Phase 3) ----------
create table public.installations (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid not null unique references public.jobs(id) on delete cascade,
  status            inst_status_t not null default 'PENDING',
  install_scheduled date,
  install_actual    date,
  lead_installer_id uuid references public.profiles(id),
  inspect_date      date,
  inspect_result    inspect_result_t,
  inspect_note      text,
  revision_done     date,
  completed_date    date,
  warranty_until    date,                              -- completed_date + 12 เดือน (auto)
  problem1 text, responsible1 text,
  problem2 text, responsible2 text,
  problem3 text, responsible3 text,
  problem4 text, responsible4 text,
  remark            text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index installations_status_idx on public.installations(status);

-- ---------- ISSUES ----------
create table public.issues (
  id              uuid primary key default gen_random_uuid(),
  issue_code      text unique,
  job_id          uuid not null references public.jobs(id) on delete cascade,
  phase           issue_phase_t not null,
  type            issue_type_t not null default 'OTHER',
  detail          text not null,
  is_auto_created boolean not null default false,
  reporter_id     uuid references public.profiles(id),
  reported_at     timestamptz not null default now(),
  owner_id        uuid references public.profiles(id),
  owner_name      text,                                -- ชื่อ free-text (auto-sync จาก Phase 3)
  resolved_at     timestamptz,
  resolution      text,
  status          issue_status_t not null default 'OPEN',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index issues_job_idx    on public.issues(job_id);
create index issues_status_idx on public.issues(status);

-- ---------- FINANCE ENTRIES (05_บัญชี) ----------
create table public.finance_entries (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references public.jobs(id) on delete cascade,
  payment_date    date not null,
  amount          numeric(12,2) not null,
  type            payment_type_t not null,
  channel         payment_channel_t not null default 'TRANSFER',
  note            text,
  is_auto_created boolean not null default false,
  is_voided       boolean not null default false,
  void_reason     text,
  voided_at       timestamptz,
  voided_by       uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index finance_job_idx  on public.finance_entries(job_id);
create index finance_date_idx on public.finance_entries(payment_date);

-- ---------- AUDIT LOG ----------
create table public.audit_logs (
  id         bigint generated always as identity primary key,
  job_id     uuid references public.jobs(id) on delete set null,
  user_id    uuid references public.profiles(id),
  action     text not null,
  table_name text not null,
  record_id  uuid,
  old_value  jsonb,
  new_value  jsonb,
  created_at timestamptz not null default now()
);
create index audit_job_idx  on public.audit_logs(job_id);
create index audit_time_idx on public.audit_logs(created_at);
-- ============================================================
-- JR OMS — 0002 Business-rule functions & triggers
-- ฝัง invariant ไว้ใน DB → data integrity ไม่พังเหมือน Sheets
-- ============================================================

-- ---------- updated_at auto-stamp ----------
create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger touch_jobs          before update on public.jobs          for each row execute function public.tg_touch_updated_at();
create trigger touch_productions   before update on public.productions   for each row execute function public.tg_touch_updated_at();
create trigger touch_installations before update on public.installations for each row execute function public.tg_touch_updated_at();
create trigger touch_issues        before update on public.issues        for each row execute function public.tg_touch_updated_at();
create trigger touch_finance       before update on public.finance_entries for each row execute function public.tg_touch_updated_at();
create trigger touch_profiles      before update on public.profiles      for each row execute function public.tg_touch_updated_at();

-- ---------- new auth user → profile ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
          new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- Job code: JR{YYYY}-{NNN} ต่อเลขเดิม (OQ-01) ----------
create or replace function public.tg_assign_job_code()
returns trigger language plpgsql as $$
declare y int; seq int;
begin
  if new.job_code is not null then return new; end if;       -- migration: เคารพ code เดิม
  y := extract(year from new.assess_date)::int;
  insert into public.job_sequence(year, last_seq) values (y, 1)
    on conflict (year) do update set last_seq = public.job_sequence.last_seq + 1
    returning last_seq into seq;
  new.year := y;
  new.sequence := seq;
  new.job_code := 'JR' || y::text || '-' || lpad(seq::text, 3, '0');
  return new;
end $$;

create trigger assign_job_code before insert on public.jobs
  for each row execute function public.tg_assign_job_code();

-- ---------- VAT/total auto จาก net (OQ-04) ----------
create or replace function public.tg_calc_financials()
returns trigger language plpgsql as $$
begin
  if new.net_amount is not null then
    new.vat_amount   := round(new.net_amount * 0.07, 2);
    new.total_amount := new.net_amount + new.vat_amount;
  end if;
  return new;
end $$;

create trigger calc_financials before insert or update of net_amount on public.jobs
  for each row execute function public.tg_calc_financials();

-- ---------- มัดจำแล้ว → auto สร้าง Production + Finance entry ----------
create or replace function public.tg_on_deposit()
returns trigger language plpgsql as $$
begin
  if new.status = 'DEPOSITED'
     and (tg_op = 'INSERT' or old.status is distinct from 'DEPOSITED') then

    -- 1) Production record (ครั้งเดียว)
    insert into public.productions(job_id, status)
    values (new.id, 'PENDING_MEASURE')
    on conflict (job_id) do nothing;

    -- 2) Finance entry สำหรับมัดจำ (ครั้งเดียว, วัน+ยอดจาก Master)
    if new.deposit_amount is not null and new.deposit_date is not null
       and not exists (
         select 1 from public.finance_entries
         where job_id = new.id and type = 'DEPOSIT' and is_auto_created and not is_voided
       ) then
      insert into public.finance_entries(job_id, payment_date, amount, type, channel, note, is_auto_created)
      values (new.id, new.deposit_date, new.deposit_amount, 'DEPOSIT', 'TRANSFER', 'มัดจำ (auto)', true);
    end if;
  end if;
  return new;
end $$;

create trigger on_deposit after insert or update of status on public.jobs
  for each row execute function public.tg_on_deposit();

-- ---------- Production: stamp status_updated_at + READY → auto Installation + notes → Issue ----------
create or replace function public.tg_production_changes()
returns trigger language plpgsql as $$
declare jcode text;
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.status_updated_at := now();
  end if;

  if new.status = 'READY' and (tg_op='INSERT' or old.status is distinct from 'READY') then
    insert into public.installations(job_id, status)
    values (new.job_id, 'PENDING') on conflict (job_id) do nothing;
  end if;

  if new.notes is not null and new.notes <> '' and (tg_op='INSERT' or new.notes is distinct from old.notes) then
    select job_code into jcode from public.jobs where id = new.job_id;
    if not exists (select 1 from public.issues where job_id=new.job_id and detail=new.notes and is_auto_created) then
      insert into public.issues(issue_code, job_id, phase, type, detail, is_auto_created, status)
      values ('ISS-'||jcode||'-'||substr(gen_random_uuid()::text,1,4), new.job_id, 'PRODUCTION','OTHER', new.notes, true,'OPEN');
    end if;
  end if;
  return new;
end $$;

create trigger production_changes before insert or update on public.productions
  for each row execute function public.tg_production_changes();

-- ---------- Installation: warranty +12เดือน + COMPLETED→job + ปัญหา→Issues ----------
create or replace function public.tg_installation_changes()
returns trigger language plpgsql as $$
declare jcode text; p text; r text; i int;
begin
  if new.completed_date is not null then
    new.warranty_until := new.completed_date + interval '12 months';
  end if;

  if new.status = 'COMPLETED' and (tg_op='INSERT' or old.status is distinct from 'COMPLETED') then
    update public.jobs set status = 'COMPLETED' where id = new.job_id;
  end if;

  select job_code into jcode from public.jobs where id = new.job_id;
  for i in 1..4 loop
    p := case i when 1 then new.problem1 when 2 then new.problem2 when 3 then new.problem3 else new.problem4 end;
    r := case i when 1 then new.responsible1 when 2 then new.responsible2 when 3 then new.responsible3 else new.responsible4 end;
    if p is not null and p <> '' then
      if not exists (select 1 from public.issues where job_id=new.job_id and detail=p and is_auto_created) then
        insert into public.issues(issue_code, job_id, phase, type, detail, owner_name, is_auto_created, status)
        values ('ISS-'||jcode||'-'||substr(gen_random_uuid()::text,1,4), new.job_id,'INSTALLATION','OTHER', p, r, true, 'OPEN');
      end if;
    end if;
  end loop;
  return new;
end $$;

create trigger installation_changes before insert or update on public.installations
  for each row execute function public.tg_installation_changes();

-- ---------- Issue code auto ----------
create or replace function public.tg_assign_issue_code()
returns trigger language plpgsql as $$
declare jcode text;
begin
  if new.issue_code is null then
    select job_code into jcode from public.jobs where id = new.job_id;
    new.issue_code := 'ISS-'||coalesce(jcode,'NA')||'-'||substr(gen_random_uuid()::text,1,4);
  end if;
  return new;
end $$;

create trigger assign_issue_code before insert on public.issues
  for each row execute function public.tg_assign_issue_code();
-- ============================================================
-- JR OMS — 0003 Row Level Security (defense-in-depth)
-- BFF บังคับ RBAC ชั้นแรก, RLS เป็นชั้นสุดท้ายที่ DB
-- ============================================================

-- helper: role ของ caller
create or replace function public.auth_role()
returns role_t language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_active()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_active from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.has_role(variadic roles role_t[])
returns boolean language sql stable as $$
  select public.is_active() and public.auth_role() = any(roles)
$$;

-- enable RLS
alter table public.profiles        enable row level security;
alter table public.jobs            enable row level security;
alter table public.productions     enable row level security;
alter table public.installations   enable row level security;
alter table public.issues          enable row level security;
alter table public.finance_entries enable row level security;
alter table public.audit_logs      enable row level security;
alter table public.job_sequence    enable row level security;

-- ---------- PROFILES ----------
create policy profiles_self_read on public.profiles for select using (auth.uid() = id or public.has_role('ADMIN'));
create policy profiles_self_upd  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy profiles_admin_all on public.profiles for all    using (public.has_role('ADMIN')) with check (public.has_role('ADMIN'));

-- ---------- JOBS ----------
-- ทุก active user อ่านได้ (finance fields ถูกกรองที่ BFF ตาม role)
create policy jobs_read on public.jobs for select using (public.is_active());
create policy jobs_write on public.jobs for insert with check (public.has_role('ADMIN','SALES','DESIGNER'));
create policy jobs_update on public.jobs for update using (public.has_role('ADMIN','SALES','DESIGNER')) with check (true);

-- ---------- PRODUCTIONS ----------
create policy prod_read on public.productions for select using (public.is_active());
create policy prod_write on public.productions for all using (public.has_role('ADMIN','PRODUCTION')) with check (public.has_role('ADMIN','PRODUCTION'));

-- ---------- INSTALLATIONS ----------
create policy inst_read on public.installations for select using (public.is_active());
create policy inst_write on public.installations for all using (public.has_role('ADMIN','INSTALLER')) with check (public.has_role('ADMIN','INSTALLER'));

-- ---------- ISSUES ----------
create policy issues_read on public.issues for select using (public.is_active());
create policy issues_write on public.issues for all using (public.has_role('ADMIN','PRODUCTION','INSTALLER','SALES')) with check (true);

-- ---------- FINANCE ----------
create policy finance_read on public.finance_entries for select using (public.has_role('ADMIN','ACCOUNTING','SALES'));
create policy finance_write on public.finance_entries for all using (public.has_role('ADMIN','ACCOUNTING')) with check (public.has_role('ADMIN','ACCOUNTING'));

-- ---------- AUDIT ----------
create policy audit_read on public.audit_logs for select using (public.has_role('ADMIN'));
create policy audit_insert on public.audit_logs for insert with check (public.is_active());

-- ---------- JOB SEQUENCE (เฉพาะ trigger ที่เป็น definer แตะ) ----------
create policy seq_read on public.job_sequence for select using (public.is_active());
-- ============================================================
-- JR OMS — 0004 FIX: trigger functions ที่เขียนข้ามตาราง ต้องเป็น SECURITY DEFINER
-- ปัญหา: trigger รันด้วยสิทธิ์ user → RLS บล็อกการเขียน job_sequence/productions/
--        finance_entries/installations/issues → user จริงสร้างงาน/มัดจำไม่ได้ (42501)
-- แก้: ให้ trigger function รันด้วยสิทธิ์เจ้าของ (bypass RLS) — เป็น pattern มาตรฐาน
-- create or replace ไม่กระทบ trigger เดิม (ผูกตามชื่อ function อยู่แล้ว)
-- ============================================================

-- Job code: เขียน job_sequence
create or replace function public.tg_assign_job_code()
returns trigger language plpgsql security definer set search_path = public as $$
declare y int; seq int;
begin
  if new.job_code is not null then return new; end if;
  y := extract(year from new.assess_date)::int;
  insert into public.job_sequence(year, last_seq) values (y, 1)
    on conflict (year) do update set last_seq = public.job_sequence.last_seq + 1
    returning last_seq into seq;
  new.year := y;
  new.sequence := seq;
  new.job_code := 'JR' || y::text || '-' || lpad(seq::text, 3, '0');
  return new;
end $$;

-- มัดจำ → เขียน productions + finance_entries
create or replace function public.tg_on_deposit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'DEPOSITED'
     and (tg_op = 'INSERT' or old.status is distinct from 'DEPOSITED') then
    insert into public.productions(job_id, status)
    values (new.id, 'PENDING_MEASURE')
    on conflict (job_id) do nothing;

    if new.deposit_amount is not null and new.deposit_date is not null
       and not exists (
         select 1 from public.finance_entries
         where job_id = new.id and type = 'DEPOSIT' and is_auto_created and not is_voided
       ) then
      insert into public.finance_entries(job_id, payment_date, amount, type, channel, note, is_auto_created)
      values (new.id, new.deposit_date, new.deposit_amount, 'DEPOSIT', 'TRANSFER', 'มัดจำ (auto)', true);
    end if;
  end if;
  return new;
end $$;

-- Production: READY → installations, notes → issues
create or replace function public.tg_production_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare jcode text;
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.status_updated_at := now();
  end if;

  if new.status = 'READY' and (tg_op='INSERT' or old.status is distinct from 'READY') then
    insert into public.installations(job_id, status)
    values (new.job_id, 'PENDING') on conflict (job_id) do nothing;
  end if;

  if new.notes is not null and new.notes <> '' and (tg_op='INSERT' or new.notes is distinct from old.notes) then
    select job_code into jcode from public.jobs where id = new.job_id;
    if not exists (select 1 from public.issues where job_id=new.job_id and detail=new.notes and is_auto_created) then
      insert into public.issues(issue_code, job_id, phase, type, detail, is_auto_created, status)
      values ('ISS-'||jcode||'-'||substr(gen_random_uuid()::text,1,4), new.job_id, 'PRODUCTION','OTHER', new.notes, true,'OPEN');
    end if;
  end if;
  return new;
end $$;

-- Installation: warranty + COMPLETED→job + problems → issues
create or replace function public.tg_installation_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare jcode text; p text; r text; i int;
begin
  if new.completed_date is not null then
    new.warranty_until := new.completed_date + interval '12 months';
  end if;

  if new.status = 'COMPLETED' and (tg_op='INSERT' or old.status is distinct from 'COMPLETED') then
    update public.jobs set status = 'COMPLETED' where id = new.job_id;
  end if;

  select job_code into jcode from public.jobs where id = new.job_id;
  for i in 1..4 loop
    p := case i when 1 then new.problem1 when 2 then new.problem2 when 3 then new.problem3 else new.problem4 end;
    r := case i when 1 then new.responsible1 when 2 then new.responsible2 when 3 then new.responsible3 else new.responsible4 end;
    if p is not null and p <> '' then
      if not exists (select 1 from public.issues where job_id=new.job_id and detail=p and is_auto_created) then
        insert into public.issues(issue_code, job_id, phase, type, detail, owner_name, is_auto_created, status)
        values ('ISS-'||jcode||'-'||substr(gen_random_uuid()::text,1,4), new.job_id,'INSTALLATION','OTHER', p, r, true, 'OPEN');
      end if;
    end if;
  end loop;
  return new;
end $$;

-- Issue code: อ่าน jobs (select ผ่าน RLS อยู่แล้ว แต่ทำ definer กันพลาดเวลา auto-insert)
create or replace function public.tg_assign_issue_code()
returns trigger language plpgsql security definer set search_path = public as $$
declare jcode text;
begin
  if new.issue_code is null then
    select job_code into jcode from public.jobs where id = new.job_id;
    new.issue_code := 'ISS-'||coalesce(jcode,'NA')||'-'||substr(gen_random_uuid()::text,1,4);
  end if;
  return new;
end $$;

-- ============================================================
-- GRANTS — ให้ PostgREST (anon/authenticated) เข้าถึงตารางได้
-- RLS ยังคุมสิทธิ์รายแถวอยู่ ตรงนี้แค่เปิด base privilege
-- ============================================================
grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines  in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines  to anon, authenticated, service_role;

-- ============================================================
-- JR OMS — seed (ตัวอย่างสำหรับ dev) — รันหลัง migrations
-- หมายเหตุ: ใส่ผ่าน service role / SQL editor (ข้าม RLS)
-- ============================================================

-- ตั้งเลข running เริ่มต้นให้ "ต่อจากของเดิม" (OQ-01)
insert into public.job_sequence(year, last_seq) values (2026, 0)
  on conflict (year) do nothing;

-- งานตัวอย่าง (trigger จะ gen job_code + vat ให้)
insert into public.jobs (customer_name, customer_tel, customer_area, channel, assess_date, net_amount, status, deposit_amount, deposit_date)
values
  ('คุณกฤติกา','081-234-5678','ภูเก็ต','LINE','2026-01-12', 85000, 'COMPLETED', 42500, '2026-01-20'),
  ('คุณสมชาย','089-111-2222','กรุงเทพฯ','FACEBOOK','2026-02-03', 128000, 'DEPOSITED', 64000, '2026-02-10'),
  ('คุณวีระ','062-333-4444','นนทบุรี','INSTAGRAM','2026-02-18', 54000, 'DEPOSITED', 27000, '2026-02-25'),
  ('คุณนภา','095-555-6666','ภูเก็ต','LINE','2026-03-01', 210000, 'DEPOSITED', 105000, '2026-03-08'),
  ('คุณอรุณี','061-999-0000','กรุงเทพฯ','INSTAGRAM','2026-03-22', 96000, 'QUOTE_SENT', null, null),
  ('คุณพิชัย','088-121-3434','สมุทรปราการ','LINE','2026-04-02', null, 'PENDING_QUOTE', null, null);

-- ตั้ง role ให้ user คนแรกเป็น ADMIN (แก้ email ให้ตรง)
-- update public.profiles set role='ADMIN' where email = 'you@company.com';
