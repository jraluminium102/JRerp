-- ============================================================
-- RESET — ล้างของเดิมทิ้งก่อน (รันซ้ำกี่รอบก็ได้ ไม่ error)
-- ============================================================
drop trigger if exists on_auth_user_created on auth.users;
drop schema if exists public cascade;
create schema public;
grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to postgres, service_role;

