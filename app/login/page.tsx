"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const signIn = async () => {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <div className="app-bg min-h-[100dvh] flex items-center justify-center p-4">
      <div className="glass rounded-3xl p-8 sm:p-10 w-full max-w-sm text-center fade-in">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white font-bold text-2xl glass-card">JR</div>
        <h1 className="text-xl font-semibold text-white">JR Office Management</h1>
        <p className="text-sm mt-1 mb-8" style={{ color: "var(--t-low)" }}>JR Aluminium and Glass</p>
        <button onClick={signIn} disabled={loading} aria-label="เข้าสู่ระบบด้วย Google"
          className="focusable pressable w-full flex items-center justify-center gap-3 bg-white rounded-xl px-4 py-3 text-sm font-medium text-gray-700 hover:bg-white/90 shadow-lg min-h-[48px] disabled:opacity-60">
          {loading ? <span className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" /> : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          )}
          เข้าสู่ระบบด้วย Google
        </button>
        <p className="text-xs mt-4" style={{ color: "var(--t-low)" }}>เข้าสู่ระบบด้วย Google Account ของบริษัทเท่านั้น</p>
      </div>
    </div>
  );
}
