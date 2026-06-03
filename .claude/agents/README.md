# JR OMS — ทีม Multi-Agent

ไฟล์ในโฟลเดอร์นี้คือ **Claude Code subagents** ที่ Claude อ่านอัตโนมัติ
**Project Manager** อยู่ที่ `CLAUDE.md` (root) ทำหน้าที่ orchestrator เรียกใช้ทีมข้างล่าง

| Agent (เรียกด้วยชื่อนี้) | บทบาท | model | สิทธิ์เครื่องมือ |
|---|---|---|---|
| *(CLAUDE.md)* | **Project Manager** — orchestrator | — | — |
| `business-analyst` | Business Analyst — requirement, user story, AC | opus | read + write docs |
| `system-analyst` | System Analyst — data model, API/BFF design, NFR | opus | read + write docs |
| `fullstack-developer` | Developer — Next.js + Supabase | sonnet | read + edit + bash |
| `qa-tester` | QA / Tester — verify ตาม AC, RBAC, business rule | sonnet | read + bash + write |
| `user-rep-nat` | ตัวแทนผู้ใช้ "คุณนัท" — UAT, มุม user จริง | sonnet | read + write docs |
| `accountant` | นักบัญชีมืออาชีพ — ตรวจการเงิน/VAT/audit | opus | read + write docs |
| `independent-consultant` | ที่ปรึกษาอิสระ — architecture/risk/trade-off | opus | read + web + write docs |

## วิธีเรียกใช้
- ปล่อยให้ Claude (PM) เลือกเองตาม `description` ของแต่ละ agent, หรือ
- สั่งตรง เช่น *"ให้ business-analyst เขียน BRD ฟีเจอร์ export Excel"*

## Flow มาตรฐาน
```
User Rep / Consultant → Business Analyst → System Analyst
   → Fullstack Developer → QA Tester → (Accountant ถ้าเกี่ยวเงิน) → PM ปิดงาน
```

## ส่งงานที่ไหน
ทุก agent ส่ง deliverable เป็นไฟล์ใน `docs/` (ดู `docs/README.md`) + สรุปสั้นกลับ PM

> รายละเอียดเต็มของแต่ละบทบาทอยู่ในไฟล์ `.md` ของ agent นั้น ๆ
> กฎทีม + Definition of Done อยู่ใน `CLAUDE.md`
