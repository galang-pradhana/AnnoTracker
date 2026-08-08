"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { ROUTES } from "@/constants";

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────
interface GuidelineLink {
  label: string;
  url: string;
}

interface SourceGuideline {
  id: string;
  title: string;
  description: string | null;
  category: string;
  icon: string;
  drive_url: string;          // legacy field (primary link)
  links: GuidelineLink[];     // multi-link array (new)
  display_order: number;
  is_active: boolean;
}

const EMPTY_FORM = {
  title: "",
  description: "",
  category: "Umum",
  icon: "📄",
  display_order: 0,
};

const EMPTY_LINK: GuidelineLink = { label: "", url: "" };

const ICON_OPTIONS = [
  "📄", "🇹🇭", "🇨🇳", "🇯🇵", "🇮🇩", "🇲🇾", "🇬🇧",
  "🎧", "🖼️", "🎙️", "📝", "🗂️", "🔍", "🤖", "📊",
];

// Helper: ambil semua link dari satu guideline (merge legacy + links)
function getAllLinks(g: SourceGuideline): GuidelineLink[] {
  const multiLinks = Array.isArray(g.links) ? g.links : [];
  if (multiLinks.length > 0) return multiLinks;
  // Fallback ke drive_url lama
  if (g.drive_url) return [{ label: "Buka Guideline", url: g.drive_url }];
  return [];
}

// ────────────────────────────────────────────
// Component
// ────────────────────────────────────────────
export default function OwnerSourcePage() {
  const [guidelines, setGuidelines] = useState<SourceGuideline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formLinks, setFormLinks] = useState<GuidelineLink[]>([{ ...EMPTY_LINK }]);
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
    } catch {
      showFeedback("Gagal memuat data guideline.", "error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchGuidelines(); }, [fetchGuidelines]);

  const categories = ["Semua", ...Array.from(new Set(guidelines.map((g) => g.category)))];
  const filtered = activeCategory === "Semua" ? guidelines : guidelines.filter((g) => g.category === activeCategory);

  // ── Form handlers ──
  const handleOpenForm = (g?: SourceGuideline) => {
    if (g) {
      setEditingId(g.id);
      setForm({
        title: g.title,
        description: g.description ?? "",
        category: g.category,
        icon: g.icon,
        display_order: g.display_order,
      });
      const existingLinks = getAllLinks(g);
      setFormLinks(existingLinks.length > 0 ? existingLinks : [{ ...EMPTY_LINK }]);
    } else {
      setEditingId(null);
      setForm({ ...EMPTY_FORM, display_order: guidelines.length + 1 });
      setFormLinks([{ ...EMPTY_LINK }]);
    }
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormLinks([{ ...EMPTY_LINK }]);
  };

  const handleLinkChange = (idx: number, field: "label" | "url", val: string) => {
    setFormLinks((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l));
  };

  const handleAddLink = () => setFormLinks((prev) => [...prev, { ...EMPTY_LINK }]);

  const handleRemoveLink = (idx: number) => {
    if (formLinks.length === 1) return; // minimal 1 link
    setFormLinks((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLinks = formLinks.filter((l) => l.url.trim());
    if (!form.title.trim() || validLinks.length === 0) {
      showFeedback("Judul dan minimal satu link wajib diisi.", "error");
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
        display_order: Number(form.display_order) || 0,
        links: validLinks,
        // Set drive_url to first link for backward compat
        drive_url: validLinks[0].url,
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

  const handleCopy = (key: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // ────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-5">
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

        {/* ─── FORM ─── */}
        {showForm && (
          <div className="bg-[var(--bg-surface)] border-2 border-[var(--primary)]/30 rounded-2xl p-6 space-y-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                {editingId ? "✏️ Edit Guideline" : "➕ Tambah Guideline Baru"}
              </h2>
              <button onClick={handleCloseForm} className="text-[var(--text-secondary)] hover:text-[var(--danger)] text-lg font-bold cursor-pointer transition-colors">✕</button>
            </div>

            <form onSubmit={handleSave} className="space-y-5">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Nama Task / Judul Guideline *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PR – Preference Ranking"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>

              {/* ─ MULTI-LINK SECTION ─ */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                    🔗 Daftar Link Sumber ({formLinks.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddLink}
                    className="flex items-center gap-1 text-xs font-bold text-[var(--primary)] hover:text-[var(--primary-hover)] cursor-pointer transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Tambah Link
                  </button>
                </div>

                <div className="space-y-3">
                  {formLinks.map((link, idx) => (
                    <div key={idx} className="flex gap-2 items-start p-3 bg-[var(--bg-surface-alt)] rounded-xl border border-[var(--border)]">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center text-[10px] font-bold mt-2.5">
                        {idx + 1}
                      </div>
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          placeholder={`Label link (Contoh: Guideline v${idx + 1}, Update Maret, dll)`}
                          value={link.label}
                          onChange={(e) => handleLinkChange(idx, "label", e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        />
                        <input
                          type="url"
                          required
                          placeholder="https://drive.google.com/file/d/..."
                          value={link.url}
                          onChange={(e) => handleLinkChange(idx, "url", e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                        />
                      </div>
                      {formLinks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLink(idx)}
                          className="mt-2.5 text-[var(--text-secondary)] hover:text-[var(--danger)] text-sm font-bold cursor-pointer transition-colors p-1"
                          title="Hapus link ini"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Deskripsi (opsional)</label>
                <textarea
                  rows={2}
                  placeholder="Keterangan singkat tentang guideline ini..."
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Category */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Kategori</label>
                  <input
                    type="text"
                    placeholder="Contoh: PR, AFM, Umum"
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
              </div>

              {/* Icon picker */}
              <div>
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
                  <input
                    type="text"
                    placeholder="Emoji lain"
                    value={ICON_OPTIONS.includes(form.icon) ? "" : form.icon}
                    onChange={(e) => e.target.value && setForm((f) => ({ ...f, icon: e.target.value }))}
                    className="w-24 px-2 py-1 text-sm rounded-xl border border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
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

        {/* ─── GRID ─── */}
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
            {filtered.map((g) => {
              const allLinks = getAllLinks(g);
              return (
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
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--primary-soft)] text-[var(--primary)]">
                          {g.category}
                        </span>
                        <span className="text-[10px] text-[var(--text-secondary)]">
                          {allLinks.length} link
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

                  {/* ─ Multi-link buttons ─ */}
                  <div className="space-y-2">
                    {allLinks.map((lnk, idx) => {
                      const copyKey = `${g.id}-${idx}`;
                      return (
                        <div key={idx} className="flex gap-2">
                          <a
                            href={lnk.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center gap-2 py-2 px-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold rounded-xl transition-colors overflow-hidden"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            <span className="truncate">
                              {lnk.label || `Link ${idx + 1}`}
                            </span>
                          </a>
                          <button
                            onClick={() => handleCopy(copyKey, lnk.url)}
                            className={`px-2.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer shrink-0 ${
                              copiedKey === copyKey
                                ? "bg-[var(--accent-teal-soft)] border-[var(--accent-teal)]/30 text-[var(--accent-teal)]"
                                : "bg-[var(--bg-surface-alt)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            }`}
                          >
                            {copiedKey === copyKey ? "✓" : "📋"}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Owner actions */}
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
                      {g.is_active ? "🙈 Sembunyi" : "👁 Tampil"}
                    </button>
                    <button
                      onClick={() => handleDelete(g.id)}
                      className="flex-1 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--primary-soft)] rounded-lg transition-colors cursor-pointer"
                    >
                      🗑 Hapus
                    </button>
                  </div>
                </div>
              );
            })}
            </div>
          )}
      </div>
    );
}
