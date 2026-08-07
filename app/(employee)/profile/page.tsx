"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { AppLogo } from "@/components/shared/AppLogo";
import { ROUTES } from "@/constants";
import type { User } from "@/types";

const BANK_OPTIONS = [
  "Bank BCA",
  "Bank Mandiri",
  "Bank BRI",
  "Bank BNI",
  "Bank Syariah Indonesia (BSI)",
  "Bank CIMB Niaga",
  "Bank Permata",
  "Bank Jago",
  "SeaBank",
  "DANA",
  "GoPay",
  "OVO",
  "Lainnya",
];

export default function EmployeeProfilePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Profile Form States
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bankName, setBankName] = useState("Bank BCA");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankAccountHolder, setBankAccountHolder] = useState("");

  // Password Form States
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Feedback states
  const [profileMsg, setProfileMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        router.push(ROUTES.LOGIN);
        return;
      }

      setEmail(authUser.email || "");

      const { data: profile } = await supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();

      if (profile) {
        const u = profile as User;
        setCurrentUser(u);
        setFullName(u.full_name || "");
        setPhone(u.phone || "");
        setBankName(u.bank_name || "Bank BCA");
        setBankAccountNumber(u.bank_account_number || "");
        setBankAccountHolder(u.bank_account_holder || u.full_name || "");
      } else {
        setFullName(authUser.user_metadata?.full_name || authUser.email || "");
      }
    } catch (err) {
      console.error("Fetch profile error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setProfileMsg({ text: "Nama lengkap wajib diisi.", type: "error" });
      return;
    }

    setIsSavingProfile(true);
    setProfileMsg(null);

    try {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) return;

      const updatePayload = {
        full_name: fullName.trim(),
        phone: phone.trim(),
        bank_name: bankName,
        bank_account_number: bankAccountNumber.trim(),
        bank_account_holder: bankAccountHolder.trim() || fullName.trim(),
      };

      const { error } = await supabase
        .from("users")
        .update(updatePayload)
        .eq("id", authUser.id);

      if (error) throw error;

      setProfileMsg({ text: "✅ Profil & Data Rekening berhasil diperbarui!", type: "success" });
      setTimeout(() => setProfileMsg(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan profil";
      setProfileMsg({ text: "Gagal menyimpan: " + msg, type: "error" });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPasswordMsg({ text: "Password baru minimal 6 karakter.", type: "error" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: "Konfirmasi password baru tidak cocok.", type: "error" });
      return;
    }

    setIsSavingPassword(true);
    setPasswordMsg(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) throw error;

      setNewPassword("");
      setConfirmPassword("");
      setPasswordMsg({ text: "🎉 Kata sandi berhasil diperbarui!", type: "success" });
      setTimeout(() => setPasswordMsg(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memperbarui kata sandi";
      setPasswordMsg({ text: "Gagal: " + msg, type: "error" });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(ROUTES.LOGIN);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] pb-16 transition-colors duration-200">
      {/* Top Sticky Header */}
      <header className="sticky top-0 z-10 bg-[var(--bg-surface)]/95 backdrop-blur-md border-b border-[var(--border)] px-4 py-3 shadow-xs">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AppLogo variant="icon" size="sm" />
            <div>
              <h1 className="text-sm font-bold text-[var(--text-primary)] leading-tight">Profil</h1>
              <p className="text-[11px] text-[var(--text-secondary)]">Atur data diri & kata sandi</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <Link href={ROUTES.EMPLOYEE_WORK_SESSION} className="text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] font-semibold px-2 py-1 transition-colors">
              ✏️ Catat Kerja
            </Link>
            <Link href={ROUTES.EMPLOYEE_HISTORY} className="text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] font-semibold px-2 py-1 transition-colors">
              📅 Riwayat
            </Link>
            <Link href={ROUTES.EMPLOYEE_ASSESSMENT} className="text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] font-semibold px-2 py-1 transition-colors">
              🧪 Assessment
            </Link>
            <Link href={ROUTES.EMPLOYEE_SOURCE} className="text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] font-semibold px-2 py-1 transition-colors">
              📂 Source
            </Link>
            <Link href={ROUTES.EMPLOYEE_PROFILE} className="text-xs text-[var(--primary)] font-bold px-2 py-1 bg-[var(--primary-soft)] rounded-lg transition-colors">
              👤 Profil
            </Link>
            <ThemeToggle />
            <button onClick={handleLogout} className="text-xs text-[var(--text-secondary)] hover:text-[var(--danger)] font-medium px-1.5 py-1 transition-colors cursor-pointer">
              Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-5">
        {isLoading ? (
          <div className="py-16 text-center text-xs text-[var(--text-secondary)]">Memuat profil...</div>
        ) : (
          <>
            {/* User Profile Card */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-3xl p-6 text-[var(--text-primary)] shadow-xs flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)] font-bold text-2xl flex items-center justify-center border border-[var(--primary)]/20 shrink-0">
                {fullName.charAt(0).toUpperCase()}
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--primary-soft)] text-[var(--primary)] px-2 py-0.5 rounded-md border border-[var(--primary)]/20">
                  {currentUser?.role === "owner" ? "👑 Owner" : "👤 Tim Anotator"}
                </span>
                <h2 className="text-lg font-bold mt-1 leading-tight">{fullName}</h2>
                <p className="text-xs text-[var(--text-secondary)]">{email}</p>
              </div>
            </div>

            {/* Section 1: Data Diri & Rekening Bank */}
            <div className="bg-[var(--bg-surface)] rounded-3xl p-6 border border-[var(--border)] shadow-xs space-y-5">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span>👤 Data Diri & Rekening Bank</span>
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Informasi ini digunakan oleh Admin untuk pencairan gaji (Payroll).
                </p>
              </div>

              {profileMsg && (
                <div className={`p-3.5 rounded-xl text-xs font-semibold ${
                  profileMsg.type === "success"
                    ? "bg-[var(--accent-teal-soft)] text-[var(--accent-teal)] border border-[var(--accent-teal)]/30"
                    : "bg-[var(--primary-soft)] text-[var(--danger)] border border-[var(--danger)]/30"
                }`}>
                  {profileMsg.text}
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Nama Lengkap *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Email Login
                    </label>
                    <input
                      type="email"
                      disabled
                      value={email}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-secondary)] text-sm cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Nomor WhatsApp / HP
                    </label>
                    <input
                      type="tel"
                      placeholder="Contoh: 081234567890"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--border)] space-y-3">
                  <p className="text-xs font-bold text-[var(--primary)] uppercase tracking-wider">
                    💳 Detail Rekening Bank Pembayaran
                  </p>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Nama Bank / E-Wallet *
                    </label>
                    <select
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer"
                    >
                      {BANK_OPTIONS.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Nomor Rekening *
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: 1234567890"
                        value={bankAccountNumber}
                        onChange={(e) => setBankAccountNumber(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Nama Pemilik Rekening *
                      </label>
                      <input
                        type="text"
                        placeholder="Sesuai buku tabungan"
                        value={bankAccountHolder}
                        onChange={(e) => setBankAccountHolder(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="w-full py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSavingProfile ? "Memproses..." : "Simpan Profil & Data Bank"}
                </button>
              </form>
            </div>

            {/* Section 2: Ganti Kata Sandi */}
            <div className="bg-[var(--bg-surface)] rounded-3xl p-6 border border-[var(--border)] shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <span>🔑 Ganti Kata Sandi (Password)</span>
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Ubah kata sandi akun Anda untuk keamanan.
                </p>
              </div>

              {passwordMsg && (
                <div className={`p-3.5 rounded-xl text-xs font-semibold ${
                  passwordMsg.type === "success"
                    ? "bg-[var(--accent-teal-soft)] text-[var(--accent-teal)] border border-[var(--accent-teal)]/30"
                    : "bg-[var(--primary-soft)] text-[var(--danger)] border border-[var(--danger)]/30"
                }`}>
                  {passwordMsg.text}
                </div>
              )}

              <form onSubmit={handleUpdatePassword} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Password Baru *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Minimal 6 karakter"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Konfirmasi Password Baru *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Ulangi password baru"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSavingPassword}
                  className="w-full py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSavingPassword ? "Memproses..." : "Perbarui Kata Sandi"}
                </button>
              </form>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
