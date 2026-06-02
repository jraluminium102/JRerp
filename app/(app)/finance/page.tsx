"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { baht, thDate } from "@/lib/format";
import { Tag, Spinner, EmptyState } from "@/components/ui/primitives";
import { Download, Plus, X } from "@/components/ui/icons";
import { RecordPaymentModal } from "@/components/finance/RecordPaymentModal";
import { VoidDialog } from "@/components/finance/VoidDialog";
import type { PaymentType, PaymentChannel } from "@/lib/database.types";

type Row = {
  id: string; payment_date: string; amount: number; type: PaymentType; channel: PaymentChannel; is_auto_created: boolean;
  job: { job_code: string; customer_name: string } | null;
};
const TYPE_TH: Record<PaymentType, string> = { DEPOSIT: "มัดจำ", INSTALLMENT_2: "งวด 2", INSTALLMENT_3: "งวด 3", FINAL: "งวดสุดท้าย" };
const CH_TH: Record<PaymentChannel, string> = { TRANSFER: "โอน", CASH: "เงินสด", CHEQUE: "เช็ค" };

export default function FinancePage() {
  const [creating, setCreating] = useState(false);
  const [voiding, setVoiding] = useState<Row | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["finance"],
    queryFn: () => api.get<Row[]>("/finance"),
  });
  const rows = data?.data ?? [];
  const canWrite = (data?.meta?.can_write as boolean) ?? false;
  const canVoid = (data?.meta?.can_void as boolean) ?? false;
  const total = rows.reduce((s, f) => s + Number(f.amount), 0);

  const VoidBtn = ({ r }: { r: Row }) => (
    <button onClick={() => setVoiding(r)} aria-label={`ยกเลิกรายการ ${r.job?.job_code}`}
      className="focusable pressable inline-flex items-center gap-1 text-[12px] text-rose-200 hover:text-rose-100 hover:bg-rose-500/15 rounded-lg px-2 py-1 min-h-[32px]">
      <X size={14} /> void
    </button>
  );

  return (
    <div className="p-4 sm:p-6 fade-in">
      <div className="flex items-start sm:items-center justify-between mb-5 gap-3 flex-col sm:flex-row">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">บัญชี — รับเงิน</h1>
          <p className="text-sm tnum" style={{ color: "var(--t-low)" }}>รับรวม {baht(total)} ฿ · {rows.length} รายการ</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button className="focusable pressable flex items-center gap-2 glass-card text-white rounded-xl px-4 py-2.5 text-sm hover:bg-white/20 min-h-[44px] flex-1 sm:flex-none justify-center"><Download size={17} /> Export</button>
          {canWrite && (
            <button onClick={() => setCreating(true)} className="focusable pressable flex items-center gap-2 bg-white text-[#1F4E78] rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-white/90 shadow-lg min-h-[44px] flex-1 sm:flex-none justify-center"><Plus size={18} /> บันทึกรับเงิน</button>
          )}
        </div>
      </div>

      {isLoading ? <Spinner /> : rows.length === 0 ? <EmptyState title="ยังไม่มีรายการรับเงิน" /> : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-[12px] border-b border-white/12" style={{ color: "var(--t-mid)" }}>
                  <th className="text-left font-medium px-4 py-3">วันที่</th><th className="text-left font-medium px-4 py-3">Job ID</th>
                  <th className="text-left font-medium px-4 py-3">ลูกค้า</th><th className="text-left font-medium px-4 py-3">ประเภท</th>
                  <th className="text-left font-medium px-4 py-3">ช่องทาง</th><th className="text-right font-medium px-4 py-3">ยอดรับ</th>
                  {canVoid && <th className="text-right font-medium px-4 py-3">จัดการ</th>}
                </tr></thead>
                <tbody>
                  {rows.map((f) => (
                    <tr key={f.id} className="border-b border-white/6 hover:bg-white/10">
                      <td className="px-4 py-3 tnum" style={{ color: "var(--t-mid)" }}>{thDate(f.payment_date)}</td>
                      <td className="px-4 py-3 text-white font-medium tnum">{f.job?.job_code}</td>
                      <td className="px-4 py-3" style={{ color: "var(--t-mid)" }}>{f.job?.customer_name}</td>
                      <td className="px-4 py-3"><span style={{ color: "var(--t-hi)" }}>{TYPE_TH[f.type]}</span>{f.is_auto_created && <span className="ml-1.5"><Tag tone="sky">auto</Tag></span>}</td>
                      <td className="px-4 py-3" style={{ color: "var(--t-low)" }}>{CH_TH[f.channel]}</td>
                      <td className="px-4 py-3 text-right text-emerald-300 font-semibold tnum">{baht(f.amount)}</td>
                      {canVoid && <td className="px-4 py-3 text-right"><VoidBtn r={f} /></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2.5">
            {rows.map((f) => (
              <div key={f.id} className="glass-card rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><span className="text-white font-medium text-sm tnum">{f.job?.job_code}</span>{f.is_auto_created && <Tag tone="sky">auto</Tag>}</div>
                  <div className="text-[13px] mt-0.5" style={{ color: "var(--t-mid)" }}>{f.job?.customer_name} · {TYPE_TH[f.type]}</div>
                  <div className="text-[12px] mt-0.5 tnum" style={{ color: "var(--t-low)" }}>{thDate(f.payment_date)} · {CH_TH[f.channel]}</div>
                  {canVoid && <div className="mt-2"><VoidBtn r={f} /></div>}
                </div>
                <span className="text-emerald-300 font-bold text-sm tnum shrink-0">{baht(f.amount)} ฿</span>
              </div>
            ))}
          </div>
        </>
      )}

      {creating && <RecordPaymentModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); refetch(); }} />}
      {voiding && <VoidDialog
        entry={{ id: voiding.id, amount: voiding.amount, payment_date: voiding.payment_date, type: TYPE_TH[voiding.type], job_code: voiding.job?.job_code }}
        onClose={() => setVoiding(null)}
        onVoided={() => { setVoiding(null); refetch(); }}
      />}
    </div>
  );
}
