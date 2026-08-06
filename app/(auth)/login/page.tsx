"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { AppLogo } from "@/components/shared/AppLogo";
import { ROUTES } from "@/constants";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg("Email atau kata sandi tidak valid. Silakan coba lagi.");
        setIsLoading(false);
        return;
      }

      if (data.user) {
        const { data: profile } = await supabase
          .from("users")
          .select("role")
          .eq("id", data.user.id)
          .single();

        if (profile?.role === "owner") {
          router.push(ROUTES.OWNER_DASHBOARD);
        } else {
          router.push(ROUTES.EMPLOYEE_HISTORY);
        }
      }
    } catch {
      setErrorMsg("Terjadi kesalahan sistem saat mencoba masuk. Coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-base)] text-[var(--text-primary)] px-4 py-8 relative transition-colors duration-200">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md bg-[var(--bg-surface)] rounded-2xl shadow-xs border border-[var(--border)] p-8 space-y-6">
        {/* App Logo & Header */}
        <div className="text-center space-y-3">
          <AppLogo variant="full" size="lg" className="mx-auto" />
          <p className="text-xs text-[var(--text-secondary)]">
            Masuk ke akun Anda untuk mulai mencatat pekerjaan
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 bg-[var(--primary-soft)] border border-[var(--danger)]/30 rounded-lg text-sm text-[var(--danger)] text-center font-medium">
            {errorMsg}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-colors placeholder:text-[var(--text-secondary)]"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1"
            >
              Kata Sandi
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-colors placeholder:text-[var(--text-secondary)]"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:scale-[0.99] disabled:opacity-50 text-white font-bold text-sm rounded-lg shadow-xs transition-all focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 cursor-pointer"
          >
            {isLoading ? "Memproses..." : "Masuk"}
          </button>
        </form>

        <div className="text-center pt-2">
          <p className="text-xs text-[var(--text-secondary)]">
            AnnoTracker &copy; 2026 — Data Annotation Team Tool
          </p>
        </div>
      </div>
    </div>
  );
}
