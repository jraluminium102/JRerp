"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const supabase = createClient();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/"; // full reload so middleware/server เห็น session
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          window.location.href = "/";
        } else {
          setInfo("สมัครแล้ว! ถ้าระบบเปิดยืนยันอีเมล กรุณาเช็คอีเมลก่อนเข้าสู่ระบบ");
          setMode("signin");
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
      setError(
        msg.includes("Invalid login")
          ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
          : msg.includes("already registered")
          ? "อีเมลนี้มีบัญชีแล้ว ลองเข้าสู่ระบบ"
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  const field =
    "focusable w-full glass-card rounded-xl px-3.5 py-3 text-sm text-white outline-none min-h-[48px] placeholder-white/40";

  return (
    <div className="app-bg min-h-[100dvh] flex items-center justify-center p-4">
      <form onSubmit={submit} className="glass rounded-3xl p-8 sm:p-10 w-full max-w-sm fade-in">
        <div className="text-center mb-7">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white font-bold text-2xl glass-card">JR</div>
          <h1 className="text-xl font-semibold text-white">JR Office Management</h1>
          <p className="text-sm mt-1" style={{ color: "var(--t-low)" }}>JR Aluminium and Glass</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[12px] mb-1.5" style={{ color: "var(--t-low)" }} htmlFor="email">อีเมล</label>
            <input id="email" type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} className={field} placeholder="you@company.com" />
          </div>
          <div>
            <label className="block text-[12px] mb-1.5" style={{ color: "var(--t-low)" }} htmlFor="password">รหัสผ่าน</label>
            <input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={field} placeholder="••••••••" />
          </div>
        </div>

        {error && <p role="alert" className="mt-3 text-[13px] text-rose-200 bg-rose-500/15 border border-rose-300/25 rounded-xl px-3 py-2">{error}</p>}
        {info && <p className="mt-3 text-[13px] text-sky-100 bg-sky-500/15 border border-sky-300/25 rounded-xl px-3 py-2">{info}</p>}

        <button type="submit" disabled={loading}
          className="focusable pressable mt-5 w-full flex items-center justify-center gap-2 bg-white text-[#1F4E78] rounded-xl px-4 py-3 text-sm font-semibold hover:bg-white/90 shadow-lg min-h-[48px] disabled:opacity-60">
          {loading && <span className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />}
          {mode === "signin" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
        </button>

        <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setInfo(null); }}
          className="focusable mt-4 w-full text-center text-[13px] text-white/70 hover:text-white">
          {mode === "signin" ? "ยังไม่มีบัญชี? สมัครสมาชิก" : "มีบัญชีแล้ว? เข้าสู่ระบบ"}
        </button>
      </form>
    </div>
  );
}
