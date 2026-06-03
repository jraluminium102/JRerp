"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PROD_STATUS } from "@/lib/constants";
import { Spinner } from "@/components/ui/primitives";
import { TriangleAlert } from "@/components/ui/icons";
import { JobDrawer } from "@/components/jobs/JobDrawer";
import type { ProdStatus } from "@/lib/database.types";

type Row = { id: string; job_code: string; customer_name: string; customer_area: string | null; estimator: { full_name: string | null } | null; open_issues: number; productions: { status: ProdStatus }[] };
// ครบทุกสถานะ — กันงานหายจากบอร์ด
const COLS: ProdStatus[] = ["PENDING_MEASURE", "MEASURED", "PENDING_MEETING", "REVISING", "PENDING_CONFIRM", "QUEUED", "MANUFACTURING", "QC", "READY", "ISSUE"];

export default function ProductionPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["jobs", "prod"], queryFn: () => api.get<Row[]>("/jobs?limit=100") });
  const jobs = (data?.data ?? []).filter((j) => j.productions?.length);
  const canFinance = (data?.meta?.can_finance as boolean) ?? false;

  return (
    <div className="p-4 sm:p-6 fade-in">
      <h1 className="text-xl sm:text-2xl font-bold text-white">Production</h1>
      <p className="text-sm mb-5" style={{ color: "var(--t-low)" }}>วัดจริง → ผลิต → QC → พร้อมติดตั้ง · แตะการ์ดเพื่อเปลี่ยนสถานะ</p>
      {isLoading ? <Spinner /> : (
        <div className="flex gap-3 overflow-x-auto pb-4 snap-x">
          {COLS.map((col) => {
            const items = jobs.filter((j) => j.productions[0]?.status === col);
            return (
              <div key={col} className="glass-card rounded-2xl p-3 min-w-[210px] flex-shrink-0 snap-start">
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-white text-sm font-semibold">{PROD_STATUS[col]}</span>
                  <span className="text-[12px] tnum px-1.5 py-0.5 rounded-md bg-white/10" style={{ color: "var(--t-mid)" }}>{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((j) => (
                    <button key={j.id} onClick={() => setOpenId(j.id)} aria-label={`เปิด ${j.job_code}`}
                      className="focusable pressable w-full text-left bg-white/9 hover:bg-white/16 border border-white/10 rounded-xl p-3">
                      <div className="text-white text-sm font-medium tnum">{j.job_code}</div>
                      <div className="text-[12px]" style={{ color: "var(--t-mid)" }}>{j.customer_name}</div>
                      <div className="text-[11px] mt-1" style={{ color: "var(--t-low)" }}>{j.customer_area} · {j.estimator?.full_name ?? "—"}</div>
                      {j.open_issues > 0 && <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-rose-200"><TriangleAlert size={12} /> {j.open_issues} issue</span>}
                    </button>
                  ))}
                  {items.length === 0 && <div className="text-[12px] text-center py-4" style={{ color: "rgba(255,255,255,0.35)" }}>—</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {openId && <JobDrawer jobId={openId} canFinance={canFinance} onClose={() => setOpenId(null)} onChanged={refetch} />}
    </div>
  );
}
