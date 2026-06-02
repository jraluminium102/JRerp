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
