# JR Office Management System (JR-OMS)

ระบบจัดการงานแทน Google Sheets — **Next.js 14 · Supabase · Vercel** · BFF architecture
บริษัท: **JR Aluminium and Glass**

---

## 🟢 สถานะ: Phase 1 COMPLETE — พร้อมใช้งานจริง

- **เว็บใช้งานจริง:** https://j-rerp.vercel.app *(อย่าใช้ลิงก์ `…git-main…` — เป็น preview ที่ Vercel ล็อก)*
- **เข้าระบบ admin:** `admin@jr.local` / `JRoms@2026` (ควรเปลี่ยนรหัสเมื่อใช้จริง)
- **ผ่าน live test 31/31** บน production — ดู `docs/qa/phase1-report.html`
- ครอบคลุม: Sales (ใบเสนอราคา→มัดจำ) · Production · Installation · Issues · Finance (รับเงิน/ค้างรับ/void) · Dashboard · Users/RBAC

**เพิ่มพนักงานใหม่:** ให้สมัครผ่านหน้า login (ถ้า Supabase เปิดยืนยันอีเมล ต้องยืนยันก่อน) → admin เข้าเมนู **Users** กำหนด role ให้

---

## สถาปัตยกรรม (BFF)

```
Browser (React Client Components)
   │  fetch /api/*  (lib/api.ts — typed client)
   ▼
BFF = Next.js Route Handlers (app/api/*)
   • getContext(): โหลด session + role ครั้งเดียว/req   (lib/bff/context.ts)
   • requirePermission(resource, action): บังคับ RBAC   (lib/rbac.ts)
   • withRoute(): แปลง error เป็น response shape เดียว   (lib/bff/handler.ts)
   • กรอง finance fields ตาม role ก่อนส่งกลับ
   │  supabase-js (user session, ผ่าน @supabase/ssr)
   ▼
Supabase Postgres
   • RLS policies — ด่านสุดท้ายที่ DB            (0003_rls.sql)
   • Triggers = business rules ฝังใน DB         (0002_functions.sql)
```

**ทำไม BFF:** client ไม่แตะ DB ตรง — ทุกอย่างผ่าน /api ที่คุม authz + shape ได้
**ทำไม business rule อยู่ใน DB:** invariant สำคัญ (job_code, มัดจำ→auto, รับประกัน, issue sync)
รันใน trigger → ข้อมูลไม่มีทางหลุด integrity แม้เขียนจากหลายทาง (แก้ pain หลักของ Sheets)

---

## โครงสร้าง

```
supabase/migrations/
  0001_schema.sql      enums + tables + indexes
  0002_functions.sql   triggers: job_code, VAT, deposit→prod+finance, warranty, issue-sync
  0003_rls.sql         RLS policies ตาม RBAC
  seed.sql             ข้อมูลตัวอย่าง

lib/
  supabase/{server,client,admin}.ts   Supabase clients (SSR + service role)
  bff/{context,handler,response}.ts    BFF core
  rbac.ts            permission matrix (7 roles) — ตรงกับ RLS
  finance.ts         VAT 7% (ยอดก่อน VAT หักส่วนลด — OQ-04)
  database.types.ts  typed schema (รัน `npm run db:types` เพื่อ regenerate)

app/
  login/                       Google SSO
  auth/{callback,signout}/     OAuth flow
  (app)/                       protected — Shell + sidebar/bottom-nav
    page.tsx                   Dashboard
    jobs/ production/ installation/ issues/ finance/ settings/users/
  api/                         BFF endpoints

components/
  shell/Shell.tsx              responsive nav (sidebar desktop / bottom-nav mobile)
  jobs/{CreateJobModal,JobDrawer}.tsx
  ui/{icons,primitives}.tsx
```

---

## Setup

### 1. สร้าง Supabase project
[supabase.com](https://supabase.com) → New project → จด **Project URL** + **anon key** + **service_role key**

### 2. รัน migrations
**ทางง่าย:** Supabase Dashboard → SQL Editor → วาง `0001` → `0002` → `0003` → `seed.sql` ตามลำดับ

**ทาง CLI:**
```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

### 3. เปิด Google OAuth ใน Supabase
Authentication → Providers → **Google** → ใส่ Client ID/Secret จาก [Google Cloud Console](https://console.cloud.google.com)
- Authorized redirect URI: `https://<ref>.supabase.co/auth/v1/callback`

### 4. ตั้ง ENV
```bash
cp .env.example .env   # แล้วเติมค่าจริง
```

### 5. รัน
```bash
npm install
npm run dev      # http://localhost:3000
```

### 6. ตั้ง Admin คนแรก
หลัง login ครั้งแรก (profile ถูกสร้าง auto) → Supabase SQL Editor:
```sql
update public.profiles set role='ADMIN' where email='you@company.com';
```

---

## Migrate ข้อมูลเดิมจาก Google Sheets (OQ-01/02)

Export ชีตเดิมเป็น `.xlsx` แล้ว:
```bash
# ลองดูก่อน (ไม่เขียนจริง)
npm run migrate:xlsx -- ./JR_Tracking.xlsx --dry

# migrate จริง (อ่าน sheet ที่ชื่อมี "master")
npm run migrate:xlsx -- ./JR_Tracking.xlsx
# ระบุชีตเอง: -- ./JR_Tracking.xlsx --sheet=2569
```
สคริปต์จะ:
- เคารพ **Job ID เดิม** และตั้ง `job_sequence` ต่อปี → งานใหม่รันเลขต่อ
- map สถานะ/ช่องทางไทย → enum, คิด VAT ให้ผ่าน trigger
- งานที่ `มัดจำแล้ว` → trigger สร้าง Production + Finance (มัดจำ) อัตโนมัติ
- ผูกช่างประเมิน/คนทำแบบกับ user ถ้า `full_name` ตรง ไม่ตรงเก็บไว้ใน remark

> ใช้ `SUPABASE_SERVICE_ROLE_KEY` (bypass RLS) — รันจากเครื่อง dev เท่านั้น

---

## Deploy (Vercel)

1. Push repo ขึ้น GitHub
2. [vercel.com](https://vercel.com) → Import project
3. ใส่ Environment Variables (เหมือน `.env`) — อย่าลืม `SUPABASE_SERVICE_ROLE_KEY`
4. ตั้ง `NEXT_PUBLIC_SITE_URL` = โดเมน production
5. เพิ่ม redirect URI ของ production ใน Supabase Auth + Google Console
6. Deploy

---

## RBAC (REQ-06)

| Role | Jobs | ยอดเงิน | Production | ติดตั้ง | Finance | Dashboard |
|------|------|--------|-----------|--------|---------|-----------|
| ADMIN | RW | ✓ | RW | RW | RW+void | R |
| SALES | RW | ✓ | R | – | – | R |
| DESIGNER | RW | – | R | – | – | R |
| PRODUCTION | R | – | RW | – | – | R |
| INSTALLER | R | – | R | RW | – | R |
| ACCOUNTING | R | ✓ | – | – | RW+void | R |
| VIEWER | R | – | – | – | – | R |

บังคับ 2 ชั้น: **BFF** (`requirePermission`) + **RLS** (`has_role()` ใน Postgres)

---

## Business rules (อยู่ใน DB triggers)

| กฎ | Trigger |
|----|---------|
| Job ID `JR{ปี}-{NNN}` ต่อเลขเดิม | `tg_assign_job_code` |
| VAT 7% + total auto จาก net | `tg_calc_financials` |
| มัดจำแล้ว → สร้าง Production + Finance entry | `tg_on_deposit` |
| Production READY → สร้าง Installation | `tg_production_changes` |
| Production notes / ปัญหาติดตั้ง → Issues | `tg_production_changes` / `tg_installation_changes` |
| รับประกัน = วันจบงาน + 12 เดือน | `tg_installation_changes` |
| ห้ามลบ Finance — void เท่านั้น | BFF `/finance/[id]/void` |

---

## Open Questions ที่ตอบแล้ว
- **OQ-01** Job ID ต่อเลขเดิม → `job_sequence` + `tg_assign_job_code`
- **OQ-02** Migrate เข้า DB → seed.sql / import script
- **OQ-03** Google SSO → Supabase Auth Google provider
- **OQ-04** ยอดก่อน VAT หักส่วนลด → `net_amount` + `tg_calc_financials`

ยังค้าง: OQ-05 (Designer workflow), OQ-06 (SLA), OQ-07 (host — ใช้ Vercel+Supabase), OQ-08 (budget)
