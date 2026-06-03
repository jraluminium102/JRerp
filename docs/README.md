# docs/ — คลังเอกสารทีม JR OMS

ทุก subagent ส่งมอบงานเป็นไฟล์ Markdown ในโฟลเดอร์ที่ตรงกับบทบาท

| โฟลเดอร์ | เจ้าของ | เนื้อหา |
|----------|---------|---------|
| `brd/` | Business Analyst | BRD, User Stories, Acceptance Criteria, AS-IS/TO-BE |
| `sdd/` | System Analyst | SDD/SRS, data model, API/BFF spec, NFR |
| `qa/` | QA Tester | Test plan, test cases, bug report |
| `uat/` | User Rep (คุณนัท) | ผล UAT, feedback จากผู้ใช้จริง |
| `finance/` | Accountant | รายงานตรวจการเงิน/VAT/audit |
| `advisory/` | Independent Consultant | architecture/risk/trade-off memo |
| `decisions/` | ทุกคน (PM อนุมัติ) | ADR — Architecture Decision Records |

## naming convention
`<TYPE>-<feature>.md` เช่น `BRD-export-excel.md`, `SDD-export-excel.md`, `TESTPLAN-export-excel.md`

## ADR (decisions/) — รูปแบบสั้น
```
# ADR-001: <หัวข้อการตัดสินใจ>
วันที่ · สถานะ (proposed/accepted/superseded)
## บริบท   (ทำไมต้องตัดสิน)
## ทางเลือก (มีอะไรบ้าง + trade-off)
## ตัดสิน   (เลือกอะไร + เพราะอะไร)
## ผลกระทบ  (ตามมาคืออะไร)
```
