"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah } from "@/lib/utils";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { AppLogo } from "@/components/shared/AppLogo";
import {
  DEFAULT_SALARY_TIERS,
  DEFAULT_BONUS_THRESHOLD_HOURS,
  DEFAULT_BONUS_AMOUNT,
  ROUTES,
} from "@/constants";
import type { SalaryTier, BonusRule, UserSalaryRate, User } from "@/types";

export default function SettingsPage() {
  const router = useRouter();
  const [salaryTiers, setSalaryTiers] = useState<SalaryTier[]>([]);
  const [bonusRules, setBonusRules] = useState<BonusRule[]>([]);
  const [userSalaryRates, setUserSalaryRates] = useState<UserSalaryRate[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit tier state
  const [editingTier, setEditingTier] = useState<SalaryTier | null>(null);

  // New tier form state
  const [minHours, setMinHours] = useState("");
  const [maxHours, setMaxHours] = useState("");
  const [ratePerHour, setRatePerHour] = useState("");
  const [showAddTier, setShowAddTier] = useState(false);

  // Bonus rule form state
  const [minWeeklyHours, setMinWeeklyHours] = useState(DEFAULT_BONUS_THRESHOLD_HOURS.toString());
  const [bonusAmount, setBonusAmount] = useState(DEFAULT_BONUS_AMOUNT.toString());

  // User Custom Salary Rate form state
  const [selectedUserId, setSelectedUserId] = useState("");
  const [userRatePerHour, setUserRatePerHour] = useState("15000");
  const [userEffectiveFrom, setUserEffectiveFrom] = useState(new Date().toISOString().split("T")[0]);
  const [userRateNote, setUserRateNote] = useState("Penyesuaian gaji khusus");

  // Feedback states
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const showFeedback = (msg: string, isError = false) => {
    if (isError) setErrorMsg(msg);
    else setSuccessMsg(msg);
    setTimeout(() => { setSuccessMsg(null); setErrorMsg(null); }, 4000);
  };

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push(ROUTES.LOGIN); return; }

      const [tiersRes, bonusRes, userRatesRes, usersRes] = await Promise.all([
        supabase.from("salary_tiers").select("*").order("min_hours").order("effective_from", { ascending: false }),
        supabase.from("bonus_rules").select("*").order("effective_from", { ascending: false }),
        supabase.from("user_salary_rates").select("*, user:users(*)").order("effective_from", { ascending: false }),
        supabase.from("users").select("*").eq("is_active", true).order("full_name"),
      ]);

      if (tiersRes.data && tiersRes.data.length > 0) {
        const allTiers: SalaryTier[] = tiersRes.data;
        const latestDate = allTiers.reduce((max, t) => t.effective_from > max ? t.effective_from : max, allTiers[0].effective_from);
        const activeTiers = allTiers.filter(t => t.effective_from === latestDate);
        setSalaryTiers(activeTiers.length > 0 ? activeTiers : allTiers.slice(0, DEFAULT_SALARY_TIERS.length));
      } else {
        setSalaryTiers(
          DEFAULT_SALARY_TIERS.map((t, idx) => ({
            id: `st-${idx}`,
            ...t,
            effective_from: new Date().toISOString().split("T")[0],
          }))
        );
      }

      if (bonusRes.data && bonusRes.data.length > 0) {
        setBonusRules(bonusRes.data);
        setBonusAmount(bonusRes.data[0].bonus_amount.toString());
        setMinWeeklyHours(bonusRes.data[0].min_weekly_hours.toString());
      }

      if (userRatesRes.data) {
        setUserSalaryRates(userRatesRes.data as unknown as UserSalaryRate[]);
      }

      if (usersRes.data) {
        setUsers(usersRes.data);
        if (usersRes.data.length > 0 && !selectedUserId) {
          setSelectedUserId(usersRes.data[0].id);
        }
      }
    } catch (err) {
      console.error("Fetch settings error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [router, selectedUserId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleAddTier = async (e: React.FormEvent) => {
    e.preventDefault();
    const minH = parseFloat(minHours);
    const maxH = maxHours ? parseFloat(maxHours) : null;
    const rate = parseInt(ratePerHour, 10);

    if (isNaN(minH) || isNaN(rate) || rate <= 0) {
      showFeedback("Masukkan nilai rentang jam dan rate gaji yang valid.", true);
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const supabase = createClient();
    const { data, error } = await supabase
      .from("salary_tiers")
      .insert({ min_hours: minH, max_hours: maxH, rate_per_hour: rate, effective_from: todayStr })
      .select()
      .single();

    if (error) {
      showFeedback("Gagal menyimpan tier: " + error.message, true);
    } else if (data) {
      setSalaryTiers((prev) => [...prev, data].sort((a, b) => a.min_hours - b.min_hours));
      setMinHours(""); setMaxHours(""); setRatePerHour("");
      setShowAddTier(false);
      showFeedback("✅ Tingkatan rate gaji baru berhasil disimpan!");
    }
  };

  const handleUpdateTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTier) return;
    const rate = parseInt(ratePerHour, 10);
    if (isNaN(rate) || rate <= 0) {
      showFeedback("Masukkan rate gaji yang valid.", true);
      return;
    }
    const supabase = createClient();
    const { error } = await supabase
      .from("salary_tiers")
      .update({ rate_per_hour: rate })
      .eq("id", editingTier.id);

    if (error) {
      showFeedback("Gagal memperbarui tier: " + error.message, true);
    } else {
      setSalaryTiers((prev) => prev.map(t => t.id === editingTier.id ? { ...t, rate_per_hour: rate } : t));
      setEditingTier(null);
      setRatePerHour("");
      showFeedback("✅ Rate tier berhasil diperbarui!");
    }
  };

  const handleDeleteTier = async (tierId: string) => {
    if (!confirm("Hapus tier ini? Data historis tidak terpengaruh.")) return;
    const supabase = createClient();
    const { error } = await supabase.from("salary_tiers").delete().eq("id", tierId);
    if (!error) {
      setSalaryTiers(prev => prev.filter(t => t.id !== tierId));
      showFeedback("Tier berhasil dihapus.");
    }
  };

  const handleSaveBonusRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const minW = parseFloat(minWeeklyHours);
    const amount = parseInt(bonusAmount, 10);

    if (isNaN(minW) || isNaN(amount) || amount <= 0) {
      showFeedback("Masukkan nilai bonus mingguan yang valid.", true);
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const supabase = createClient();
    const { data, error } = await supabase
      .from("bonus_rules")
      .insert({ min_weekly_hours: minW, bonus_amount: amount, effective_from: todayStr })
      .select()
      .single();

    if (error) {
      showFeedback("Gagal menyimpan aturan bonus: " + error.message, true);
    } else if (data) {
      setBonusRules((prev) => [data, ...prev]);
      showFeedback("✅ Aturan bonus mingguan berhasil diperbarui!");
    }
  };

  const handleSaveUserRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      showFeedback("Pilih karyawan terlebih dahulu.", true);
      return;
    }

    const rate = parseInt(userRatePerHour, 10);
    if (isNaN(rate) || rate <= 0) {
      showFeedback("Masukkan rate per jam yang valid.", true);
      return;
    }

    if (!userEffectiveFrom) {
      showFeedback("Pilih tanggal mulai berlaku tarif.", true);
      return;
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("user_salary_rates")
        .insert({
          user_id: selectedUserId,
          rate_per_hour: rate,
          effective_from: userEffectiveFrom,
          note: userRateNote.trim(),
        })
        .select("*, user:users(*)")
        .single();

      if (error) throw error;

      if (data) {
        setUserSalaryRates((prev) => [data as unknown as UserSalaryRate, ...prev]);
        showFeedback("✅ Tarif khusus karyawan berhasil disimpan!");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan tarif khusus";
      showFeedback("Gagal: " + msg, true);
    }
  };

  const handleDeleteUserRate = async (id: string) => {
    if (!confirm("Hapus pengaturan tarif khusus ini?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("user_salary_rates").delete().eq("id", id);
    if (!error) {
      setUserSalaryRates((prev) => prev.filter((r) => r.id !== id));
      showFeedback("Tarif khusus berhasil dihapus.");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] pb-12 transition-colors duration-200">
      {/* Header */}
      <header className="bg-[var(--bg-surface)] border-b border-[var(--border)] px-6 py-4 sticky top-0 z-10 transition-colors">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AppLogo variant="icon" size="sm" />
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">Pengaturan Rate Gaji & Bonus</h1>
              <p className="text-xs text-[var(--text-secondary)]">Atur skema rate bertingkat, bonus mingguan, & rate khusus karyawan</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-1 bg-[var(--bg-surface-alt)] p-1 rounded-xl text-xs font-semibold overflow-x-auto">
              <Link href={ROUTES.OWNER_DASHBOARD} className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Dashboard</Link>
              <Link href={ROUTES.OWNER_PAYROLL} className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Payroll</Link>
              <Link href={ROUTES.OWNER_MASTER_DATA} className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Master Data</Link>
              <Link href={ROUTES.OWNER_USERS} className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">User</Link>
              <Link href={ROUTES.OWNER_ASSESSMENT} className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Assessment</Link>
              <Link href={ROUTES.OWNER_SETTINGS} className="px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] text-[var(--primary)] font-bold shadow-xs">Settings</Link>
              <Link href={ROUTES.OWNER_SOURCE} className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Source</Link>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 pt-6 space-y-6">
        {/* Feedback */}
        {successMsg && (
          <div className="p-4 bg-[var(--accent-teal-soft)] border border-[var(--accent-teal)]/30 text-[var(--accent-teal)] rounded-xl text-sm font-semibold">
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="p-4 bg-[var(--primary-soft)] border border-[var(--danger)]/30 text-[var(--danger)] rounded-xl text-sm font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Section 1: Salary Tiers Global */}
        <section className="bg-[var(--bg-surface)] rounded-2xl p-6 border border-[var(--border)] shadow-xs space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">1. Rate Gaji Harian Bertingkat (Tier Global)</h2>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Rate standar dihitung <strong>flat per tier</strong> untuk karyawan yang tidak memiliki tarif khusus.
              </p>
            </div>
            <button
              onClick={() => { setShowAddTier(v => !v); setEditingTier(null); setRatePerHour(""); }}
              className="shrink-0 ml-4 px-3 py-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              {showAddTier ? "✕ Batal" : "+ Tambah Tier"}
            </button>
          </div>

          {/* Active Tiers Table */}
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-[var(--bg-surface-alt)] text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  <th className="px-4 py-3">Rentang Jam Harian</th>
                  <th className="px-4 py-3">Rate / Jam</th>
                  <th className="px-4 py-3">Berlaku Sejak</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-xs text-[var(--text-secondary)]">Memuat data tier...</td>
                  </tr>
                ) : salaryTiers.map((tier) => (
                  <tr key={tier.id} className="hover:bg-[var(--bg-surface-alt)]/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
                      {tier.min_hours} jam – {tier.max_hours ? `${tier.max_hours} jam` : "Seterusnya"}
                    </td>
                    <td className="px-4 py-3">
                      {editingTier?.id === tier.id ? (
                        <form onSubmit={handleUpdateTier} className="flex items-center gap-2">
                          <input
                            type="number"
                            value={ratePerHour}
                            onChange={e => setRatePerHour(e.target.value)}
                            className="w-28 px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg-surface-alt)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                            autoFocus
                          />
                          <button type="submit" className="px-2.5 py-1 bg-[var(--primary)] text-white text-xs rounded-lg font-semibold cursor-pointer">✓ Simpan</button>
                          <button type="button" onClick={() => { setEditingTier(null); setRatePerHour(""); }} className="px-2 py-1 text-[var(--text-secondary)] text-xs cursor-pointer">✕</button>
                        </form>
                      ) : (
                        <span className="font-bold text-[var(--primary)]">{formatRupiah(tier.rate_per_hour)} / jam</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{tier.effective_from}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditingTier(tier); setRatePerHour(tier.rate_per_hour.toString()); setShowAddTier(false); }}
                          className="px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--primary-soft)] rounded-lg transition-colors font-medium cursor-pointer"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTier(tier.id)}
                          className="px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--primary-soft)] rounded-lg transition-colors cursor-pointer"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add New Tier Form */}
          {showAddTier && (
            <form onSubmit={handleAddTier} className="p-4 bg-[var(--bg-surface-alt)] rounded-xl border border-[var(--border)] space-y-3">
              <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">+ Tier Baru</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Minimal Jam</label>
                  <input type="number" step="0.1" placeholder="Contoh: 0" value={minHours} onChange={e => setMinHours(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Maksimal Jam (kosong = unlimited)</label>
                  <input type="number" step="0.1" placeholder="Contoh: 8" value={maxHours} onChange={e => setMaxHours(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Rate per Jam (Rp)</label>
                  <input type="number" placeholder="Contoh: 10000" value={ratePerHour} onChange={e => setRatePerHour(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
                </div>
              </div>
              <button type="submit" className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-semibold text-xs rounded-lg shadow-xs transition-colors cursor-pointer">
                + Simpan Tier Baru
              </button>
            </form>
          )}
        </section>

        {/* Section 2: Tarif Khusus / Group Rate Karyawan (User Salary Overrides) */}
        <section className="bg-[var(--bg-surface)] rounded-2xl p-6 border border-[var(--border)] shadow-xs space-y-5">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
              <span>👤 2. Tarif Khusus / Group Rate Karyawan (Effective Date)</span>
              <span className="text-[10px] bg-[var(--primary-soft)] text-[var(--primary)] px-2 py-0.5 rounded-full font-bold">
                Baru
              </span>
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Atur tarif per jam khusus untuk karyawan tertentu (misal: karyawan lama naik gaji ke <strong>Rp 15.000/jam</strong> mulai tanggal pertengahan bulan).
            </p>
          </div>

          {/* Form Tambah Tarif Khusus */}
          <form onSubmit={handleSaveUserRate} className="p-4 bg-[var(--bg-surface-alt)] rounded-2xl border border-[var(--border)] space-y-4">
            <h3 className="text-xs font-bold text-[var(--primary)] uppercase tracking-wider">
              + Tambah / Perbarui Tarif Khusus Karyawan
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Pilih Karyawan *
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role === "owner" ? "Owner" : "Anotator"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Tarif Per Jam (Rp) *
                </label>
                <input
                  type="number"
                  required
                  placeholder="Contoh: 15000"
                  value={userRatePerHour}
                  onChange={(e) => setUserRatePerHour(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Tanggal Mulai Berlaku *
                </label>
                <input
                  type="date"
                  required
                  value={userEffectiveFrom}
                  onChange={(e) => setUserEffectiveFrom(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                Catatan / Alasan (Opsional)
              </label>
              <input
                type="text"
                placeholder="Contoh: Kenaikan gaji karyawan senior"
                value={userRateNote}
                onChange={(e) => setUserRateNote(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              + Simpan Tarif Khusus Karyawan
            </button>
          </form>

          {/* Tabel Daftar Tarif Khusus */}
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-[var(--bg-surface-alt)] text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  <th className="px-4 py-3">Nama Karyawan</th>
                  <th className="px-4 py-3">Tarif Khusus / Jam</th>
                  <th className="px-4 py-3">Mulai Berlaku</th>
                  <th className="px-4 py-3">Catatan</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {userSalaryRates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-[var(--text-secondary)]">
                      Belum ada penyesuaian tarif khusus karyawan. Semua karyawan menggunakan tarif global.
                    </td>
                  </tr>
                ) : (
                  userSalaryRates.map((r) => (
                    <tr key={r.id} className="hover:bg-[var(--bg-surface-alt)]/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-[var(--text-primary)]">
                        {r.user?.full_name || "Karyawan"}
                      </td>
                      <td className="px-4 py-3 font-extrabold text-[var(--primary)]">
                        {formatRupiah(r.rate_per_hour)} / jam
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-[var(--accent-teal)]">
                        {new Date(r.effective_from + "T00:00:00").toLocaleDateString("id-ID", {
                          day: "numeric", month: "short", year: "numeric"
                        })}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--text-secondary)] italic">
                        {r.note || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteUserRate(r.id)}
                          className="px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--primary-soft)] rounded-lg transition-colors cursor-pointer"
                        >
                          🗑 Hapus
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Bonus Rules Global */}
        <section className="bg-[var(--bg-surface)] rounded-2xl p-6 border border-[var(--border)] shadow-xs space-y-5">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">3. Aturan Bonus Mingguan (Global)</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Bonus otomatis ditambahkan ke payroll jika jam kerja mingguan mencapai threshold minimal.
            </p>
          </div>

          {/* Current active rule summary */}
          {bonusRules.length > 0 && (
            <div className="flex items-center gap-4 p-4 bg-[var(--accent-teal-soft)] rounded-xl border border-[var(--accent-teal)]/30">
              <div className="text-2xl">🎯</div>
              <div>
                <p className="text-xs font-bold text-[var(--accent-teal)] uppercase tracking-wider">Aturan Aktif</p>
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  Kerja ≥ {bonusRules[0].min_weekly_hours} jam/minggu → Bonus {formatRupiah(bonusRules[0].bonus_amount)}
                </p>
                <p className="text-[11px] text-[var(--text-secondary)]">Berlaku sejak {bonusRules[0].effective_from}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSaveBonusRule} className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Threshold Jam per Minggu</label>
              <input type="number" step="0.5" value={minWeeklyHours} onChange={e => setMinWeeklyHours(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Nominal Bonus (Rp)</label>
              <input type="number" value={bonusAmount} onChange={e => setBonusAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="py-2.5 px-5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer">
                Simpan Aturan Bonus Baru
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
