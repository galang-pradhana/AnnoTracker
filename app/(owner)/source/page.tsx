"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { ROUTES } from "@/constants";

interface SourceGuideline {
  id: string;
  title: string;
  description: string | null;
  category: string;
  icon: string;
  drive_url: string;
  display_order: number;
  is_active: boolean;
}

const EMPTY_FORM = {
  title: "",
  description: "",
  category: "Umum",
  icon: "📄",
  drive_url: "",
  display_order: 0,
};

const ICON_OPTIONS = ["📄", "🇹🇭", "🇨🇳", "🇯🇵", "🇮🇩", "🇲🇾", "🇬🇧", "🎧", "🖼️", "🎙️", "📝", "🗂️", "🔍", "🤖", "📊"];

export default function OwnerSourcePage() {
  const [guidelines, setGuidelines] = useState<SourceGuideline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showFeedback = (msg: string, type: "success" | "error" = "success") => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  const fetchGuidelines = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("source_guidelines")
        .select("*")
        .order("display_order")
        .order("created_at");
      if (error) throw error;
      setGuidelines((data as SourceGuideline[]) ?? []);
    } catch (err) {
      console.error("Fetch guidelines error:", err);
      showFeedback("Gagal memuat data guideline.", "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGuidelines();
  }, [fetchGuidelines]);

  const categories = ["Semua", ...Array.from(new Set(guidelines.map((g) => g.category)))];
  const filtered = activeCategory === "Semua" ? guidelines : guidelines.filter((g) => g.category === activeCategory);

  const handleOpenForm = (g?: SourceGuideline) => {
    if (g) {
      setEditingId(g.id);
      setForm({
        title: g.title,
        description: g.description ?? "",
        category: g.category,
        icon: g.icon,
        drive_url: g.drive_url,
        display_order: g.display_order,
      });
    } else {
      setEditingId(null);
      setForm({ ...EMPTY_FORM, display_order: guidelines.length + 1 });
    }
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.drive_url.trim()) {
      showFeedback("Judul dan URL wajib diisi.", "error");
      return;
    }
    setIsSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || "Umum",
        icon: form.icon,
        drive_url: form.drive_url.trim(),
        display_order: Number(form.display_order) || 0,
      };

      if (editingId) {
        const { error } = await supabase.from("source_guidelines").update(payload).eq("id", editingId);
        if (error) throw error;
        showFeedback("✅ Guideline berhasil diperbarui!");
      } else {
        const { error } = await supabase.from("source_guidelines").insert({ ...payload, is_active: true });
        if (error) throw error;
        showFeedback("✅ Guideline baru berhasil ditambahkan!");
      }

      handleCloseForm();
      fetchGuidelines();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan";
      showFeedback("Gagal: " + msg, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (g: SourceGuideline) => {
    const supabase = createClient();
    await supabase.from("source_guidelines").update({ is_active: !g.is_active }).eq("id", g.id);
    setGuidelines((prev) => prev.map((x) => (x.id === g.id ? { ...x, is_active: !g.is_active } : x)));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus guideline ini? Tindakan tidak bisa dibatalkan.")) return;
    const supabase = createClient();
    const { error } = await supabase.from("source_guidelines").delete().eq("id", id);
    if (error) {
      showFeedback("Gagal menghapus: " + error.message, "error");
    } else {
      setGuidelines((prev) => prev.filter((g) => g.id !== id));
      showFeedback("🗑️ Guideline berhasil dihapus.");
    }
  };

  const handleCopy = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] pb-16 transition-colors duration-200">
      {/* Header */}
      <header className="bg-[var(--bg-surface)] border-b border-[var(--border)] px-6 py-4 sticky top-0 z-10 shadow-2xs transition-colors">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">📂 Source Guideline</h1>
            <p className="text-xs text-[var(--text-secondary)]">Kelola link PDF panduan pengerjaan task annotasi</p>
          </div>
          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-1 bg-[var(--bg-surface-alt)] p-1 rounded-xl text-xs font-semibold overflow-x-auto border border-[var(--border)]">
              <Link href={ROUTES.OWNER_DASHBOARD} className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Dashboard</Link>
              <Link href={ROUTES.OWNER_PAYROLL} className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Payroll</Link>
              <Link href={ROUTES.OWNER_MASTER_DATA} className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Master Data</Link>
              <Link href={ROUTES.OWNER_USERS} className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">User</Link>
              <Link href={ROUTES.OWNER_ASSESSMENT} className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Assessment</Link>
              <Link href={ROUTES.OWNER_SOURCE} className="px-3 py-1.5 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] font-bold border border-[var(--primary)]/30">Source</Link>
              <Link href={ROUTES.OWNER_SETTINGS} className="px-3 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Settings</Link>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pt-6 space-y-5">
        {/* Feedback */}
        {feedback && (
          <div className={`p-3.5 rounded-xl text-sm font-semibold border transition-all ${
            feedback.type === "success"
              ? "bg-[var(--accent-teal-soft)] text-[var(--accent-teal)] border-[var(--accent-teal)]/30"
              : "bg-[var(--primary-soft)] text-[var(--danger)] border-[var(--danger)]/30"
          }`}>
            {feedback.msg}
          </div>
        )}

        {/* ─── FORM TAMBAH / EDIT ─── */}
        {showForm && (
          <div className="bg-[var(--bg-surface)] border-2 border-[var(--primary)]/30 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                {editingId ? "✏️ Edit Guideline" : "➕ Tambah Guideline Baru"}
              </h2>
              <button onClick={handleCloseForm} className="text-[var(--text-secondary)] hover:text-[var(--danger)] text-lg font-bold cursor-pointer transition-colors">✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Title */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Judul Guideline *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Guideline PR – Thailand (Preecha)"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>

                {/* Drive URL */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Link Google Drive (URL) *</label>
                  <input
                    type="url"
                    required
                    placeholder="https://drive.google.com/file/d/..."
                    value={form.drive_url}
                    onChange={(e) => setForm((f) => ({ ...f, drive_url: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>

                {/* Description */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Deskripsi (opsional)</label>
                  <textarea
                    rows={2}
                    placeholder="Keterangan singkat tentang isi guideline ini..."
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Kategori</label>
                  <input
                    type="text"
                    placeholder="Contoh: Thailand, China, Umum"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>

                {/* Order */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Urutan Tampil</label>
                  <input
                    type="number"
                    min={0}
                    value={form.display_order}
                    onChange={(e) => setForm((f) => ({ ...f, display_order: Number(e.target.value) }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                </div>

                {/* Icon picker */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Ikon</label>
                  <div className="flex flex-wrap gap-2">
                    {ICON_OPTIONS.map((ic) => (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, icon: ic }))}
                        className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center border-2 transition-all cursor-pointer ${
                          form.icon === ic
                            ? "border-[var(--primary)] bg-[var(--primary-soft)] scale-110"
                            : "border-[var(--border)] bg-[var(--bg-surface-alt)] hover:border-[var(--primary)]/50"
                        }`}
                      >
                        {ic}
                      </button>
                    ))}
                    {/* Custom icon input */}
                    <input
                      type="text"
                      placeholder="Emoji lain"
                      value={ICON_OPTIONS.includes(form.icon) ? "" : form.icon}
                      onChange={(e) => e.target.value && setForm((f) => ({ ...f, icon: e.target.value }))}
                      className="w-24 px-2 py-1 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold text-sm rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? "Menyimpan..." : editingId ? "✓ Simpan Perubahan" : "➕ Tambah Guideline"}
                </button>
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="px-5 py-2.5 bg-[var(--bg-surface-alt)] border border-[var(--border)] text-[var(--text-secondary)] font-semibold text-sm rounded-xl transition-colors hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ─── TOOLBAR ─── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">Filter:</span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  activeCategory === cat
                    ? "bg-[var(--primary)] text-white shadow-sm"
                    : "bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {cat}
              </button>
            ))}
            <span className="text-xs text-[var(--text-secondary)] ml-1">{filtered.length} guideline</span>
          </div>

          {!showForm && (
            <button
              onClick={() => handleOpenForm()}
              className="flex items-center gap-1.5 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Tambah Guideline
            </button>
          )}
        </div>

        {/* ─── LIST / GRID ─── */}
        {isLoading ? (
          <div className="py-16 text-center">
            <div className="text-2xl mb-2 animate-pulse">📂</div>
            <p className="text-sm text-[var(--text-secondary)]">Memuat guideline...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-sm text-[var(--text-secondary)]">Belum ada guideline. Klik "Tambah Guideline" untuk mulai.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((g) => (
              <div
                key={g.id}
                className={`bg-[var(--bg-surface)] rounded-2xl border p-5 flex flex-col gap-3 transition-shadow hover:shadow-md ${
                  g.is_active ? "border-[var(--border)]" : "border-[var(--border)] opacity-50"
                }`}
              >
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 bg-[var(--primary-soft)] border border-[var(--primary)]/20">
                    {g.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[var(--text-primary)] leading-tight">{g.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--primary-soft)] text-[var(--primary)]">
                        {g.category}
                      </span>
                      {!g.is_active && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--border)] text-[var(--text-secondary)]">
                          Disembunyikan
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {g.description && (
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{g.description}</p>
                )}

                {/* URL preview */}
                <div className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-surface-alt)] rounded-xl border border-[var(--border)] overflow-hidden">
                  <span className="text-xs shrink-0">🔗</span>
                  <span className="text-[11px] text-[var(--text-secondary)] truncate flex-1 font-mono">{g.drive_url}</span>
                </div>

                {/* Open + Copy */}
                <div className="flex gap-2">
                  <a
                    href={g.drive_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold rounded-xl transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Buka
                  </a>
                  <button
                    onClick={() => handleCopy(g.id, g.drive_url)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      copiedId === g.id
                        ? "bg-[var(--accent-teal-soft)] border-[var(--accent-teal)]/30 text-[var(--accent-teal)]"
                        : "bg-[var(--bg-surface-alt)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {copiedId === g.id ? "✓" : "Salin"}
                  </button>
                </div>

                {/* Owner Actions */}
                <div className="flex gap-2 pt-1 border-t border-[var(--border)]">
                  <button
                    onClick={() => handleOpenForm(g)}
                    className="flex-1 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--primary)] hover:bg-[var(--primary-soft)] rounded-lg transition-colors cursor-pointer"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(g)}
                    className="flex-1 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent-teal)] hover:bg-[var(--accent-teal-soft)] rounded-lg transition-colors cursor-pointer"
                  >
                    {g.is_active ? "🙈 Sembunyikan" : "👁 Tampilkan"}
                  </button>
                  <button
                    onClick={() => handleDelete(g.id)}
                    className="flex-1 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--primary-soft)] rounded-lg transition-colors cursor-pointer"
                  >
                    🗑 Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
