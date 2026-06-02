/**
 * Migrate ข้อมูลจาก JR Tracking Sheet (.xlsx) → Supabase
 *
 *   npx tsx scripts/migrate-xlsx.ts ./path/to/JR_Tracking.xlsx [--sheet=Master] [--dry]
 *
 * ต้องมี env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (.env)
 *
 * หลักการ (OQ-01/02/04):
 *  - เคารพ Job ID เดิม (insert พร้อม job_code → trigger ไม่ override)
 *  - DEPOSITED → DB trigger สร้าง Production + Finance (มัดจำ) ให้อัตโนมัติ
 *  - net_amount → trigger คิด VAT 7% + total
 *  - จบงาน ตั้ง job_sequence ต่อปี = เลขมากสุด → งานใหม่รันต่อ
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import path from "node:path";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error("❌ ตั้ง NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY ใน .env ก่อน"); process.exit(1); }

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const sheetArg = args.find((a) => a.startsWith("--sheet="))?.split("=")[1];
const DRY = args.includes("--dry");
if (!file) { console.error("❌ ระบุ path ไฟล์ xlsx: npx tsx scripts/migrate-xlsx.ts ./file.xlsx"); process.exit(1); }

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// ---------- helpers ----------
const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
function pick(row: Record<string, any>, ...aliases: string[]) {
  const keys = Object.keys(row);
  for (const a of aliases) {
    const k = keys.find((k) => norm(k).includes(norm(a)));
    if (k != null && row[k] !== "" && row[k] != null) return row[k];
  }
  return null;
}
function toISO(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
function toNum(v: any): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[,\s฿]/g, ""));
  return isNaN(n) ? null : n;
}
const CHANNEL: Record<string, string> = { l: "LINE", line: "LINE", f: "FACEBOOK", fb: "FACEBOOK", facebook: "FACEBOOK", ig: "INSTAGRAM", instagram: "INSTAGRAM" };
const STATUS: Record<string, string> = {
  "รอเสนอราคา": "PENDING_QUOTE", "ส่งลูกค้าแล้ว": "QUOTE_SENT", "รอลูกค้าตัดสินใจ": "PENDING_DECISION",
  "มัดจำ": "DEPOSITED", "มัดจำแล้ว": "DEPOSITED", "ยกเลิก": "CANCELLED", "จบงาน": "COMPLETED",
};

async function main() {
  const wb = XLSX.readFile(path.resolve(file!), { cellDates: true });
  const sheetName = sheetArg
    ? wb.SheetNames.find((n) => norm(n).includes(norm(sheetArg))) ?? wb.SheetNames[0]
    : wb.SheetNames.find((n) => norm(n).includes("master")) ?? wb.SheetNames[0];
  console.log(`📄 Sheet: "${sheetName}"  ${DRY ? "(DRY RUN)" : ""}`);

  // raw:true → date cells (cellDates) คงเป็น Date object, ตัวเลขคงเป็น number
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[sheetName], { defval: null, raw: true });

  // map profiles full_name → id (best-effort ผูกช่างประเมิน)
  const { data: profiles } = await sb.from("profiles").select("id, full_name");
  const nameToId = new Map((profiles ?? []).filter((p) => p.full_name).map((p) => [String(p.full_name).trim(), p.id]));

  const maxSeqByYear: Record<number, number> = {};
  let created = 0, skipped = 0, failed = 0;

  for (const row of rows) {
    const name = pick(row, "ชื่อลูกค้า", "ชื่อ", "customer");
    if (!name || String(name).trim() === "") { skipped++; continue; }

    const rawCode = String(pick(row, "Job ID", "JobID", "รหัส") ?? "").trim();
    const m = rawCode.match(/^JR(\d{4})-(\d+)$/i);
    if (!m) { console.warn(`⚠️  ข้าม "${name}" — Job ID ไม่ถูกรูปแบบ ("${rawCode}")`); skipped++; continue; }
    const year = Number(m[1]); const seq = Number(m[2]);
    maxSeqByYear[year] = Math.max(maxSeqByYear[year] ?? 0, seq);

    const statusTh = String(pick(row, "สถานะ", "Status") ?? "").trim();
    const status = STATUS[statusTh] ?? "PENDING_QUOTE";
    const channelRaw = String(pick(row, "ช่องทาง", "channel") ?? "").trim().toLowerCase();
    const estName = pick(row, "ช่างประเมิน") ? String(pick(row, "ช่างประเมิน")).trim() : null;
    const designerName = pick(row, "คนทำแบบ") ? String(pick(row, "คนทำแบบ")).trim() : null;

    const remarkParts: string[] = [];
    const remarkExisting = pick(row, "หมายเหตุ");
    if (remarkExisting) remarkParts.push(String(remarkExisting));
    if (estName && !nameToId.has(estName)) remarkParts.push(`ช่างประเมิน: ${estName}`);
    if (designerName && !nameToId.has(designerName)) remarkParts.push(`คนทำแบบ: ${designerName}`);

    const record: Record<string, any> = {
      job_code: rawCode.toUpperCase(),
      year, sequence: seq,
      customer_name: String(name).trim(),
      customer_tel: pick(row, "เบอร์", "โทร", "tel") ? String(pick(row, "เบอร์", "โทร", "tel")) : null,
      customer_area: pick(row, "พื้นที่", "จังหวัด", "area") ? String(pick(row, "พื้นที่", "จังหวัด", "area")) : null,
      channel: CHANNEL[channelRaw] ?? "OTHER",
      assess_date: toISO(pick(row, "วันเข้าประเมิน", "วันประเมิน")) ?? `${year}-01-01`,
      estimator_id: estName ? nameToId.get(estName) ?? null : null,
      designer_id: designerName ? nameToId.get(designerName) ?? null : null,
      net_amount: toNum(pick(row, "ยอดเสนอ", "ยอดงาน")),
      status,
      deposit_amount: toNum(pick(row, "ยอดมัดจำ")),
      deposit_date: toISO(pick(row, "วันมัดจำ", "วันที่มัดจำ")),
      cancel_reason: pick(row, "เหตุผลยกเลิก") ? String(pick(row, "เหตุผลยกเลิก")) : null,
      remark: remarkParts.length ? remarkParts.join(" | ") : null,
    };

    if (DRY) { console.log(`  ✓ ${record.job_code}  ${record.customer_name}  [${status}]`); created++; continue; }

    const { error } = await sb.from("jobs").insert(record);
    if (error) {
      if (error.code === "23505") { skipped++; } // duplicate job_code → ข้าม
      else { console.error(`❌ ${record.job_code}: ${error.message}`); failed++; }
    } else created++;
  }

  // OQ-01: ตั้งเลขรันต่อจากของเดิม
  if (!DRY) {
    for (const [y, mx] of Object.entries(maxSeqByYear)) {
      const { error } = await sb.from("job_sequence").upsert({ year: Number(y), last_seq: mx }, { onConflict: "year" });
      if (!error) console.log(`🔢 job_sequence[${y}] = ${mx}  → งานใหม่เริ่มที่ ${mx + 1}`);
    }
  }

  console.log(`\n📊 เสร็จ: สร้าง ${created} · ข้าม ${skipped} · ล้มเหลว ${failed}`);
  console.log(DRY ? "ℹ️  DRY RUN — ยังไม่เขียนจริง (เอา --dry ออกเพื่อ migrate)" : "✅ migrate เข้า Supabase แล้ว");
}

main().catch((e) => { console.error(e); process.exit(1); });
