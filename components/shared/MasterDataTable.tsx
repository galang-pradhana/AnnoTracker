"use client";

import React, { useState } from "react";

export interface MasterDataItem {
  id: string;
  name: string;
  language?: string | null;
  is_active: boolean;
}

interface MasterDataTableProps {
  title: string;
  description: string;
  items: MasterDataItem[];
  hasLanguageColumn?: boolean;
  onAddItem: (name: string, language?: string) => Promise<void>;
  onToggleStatus: (id: string, currentStatus: boolean) => Promise<void>;
  onEditItem?: (id: string, newName: string, newLanguage?: string) => Promise<void>;
  onDeleteItem?: (id: string, force?: boolean) => Promise<{ success: boolean; hasHistory?: boolean; error?: string }>;
}

const COMMON_LANGUAGES = ["Thailand", "China", "Indonesia", "Malaysia", "English", "Japan", "Korea"];

function renderLanguageBadge(language?: string | null) {
  if (!language) {
    return <span className="text-xs text-[var(--text-secondary)] italic">-</span>;
  }
  const flagMap: Record<string, string> = {
    thailand: "🇹🇭",
    thai: "🇹🇭",
    china: "🇨🇳",
    chinese: "🇨🇳",
    indonesia: "🇮🇩",
    indonesian: "🇮🇩",
    malaysia: "🇲🇾",
    malay: "🇲🇾",
    english: "🇬🇧",
    us: "🇺🇸",
    japan: "🇯🇵",
    japanese: "🇯🇵",
    korea: "🇰🇷",
    korean: "🇰🇷",
  };

  const lower = language.toLowerCase().trim();
  const flag = flagMap[lower] || "🌐";

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
      <span>{flag}</span>
      <span>{language}</span>
    </span>
  );
}

export function MasterDataTable({
  title,
  description,
  items,
  hasLanguageColumn = false,
  onAddItem,
  onToggleStatus,
  onEditItem,
  onDeleteItem,
}: MasterDataTableProps) {
  const [newItemName, setNewItemName] = useState("");
  const [newItemLanguage, setNewItemLanguage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Status Filter State
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");

  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingLanguage, setEditingLanguage] = useState("");
  const [isEditingSaving, setIsEditingSaving] = useState(false);

  // Deleting State
  const [deletingItem, setDeletingItem] = useState<MasterDataItem | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);
  const [isDeletingLoading, setIsDeletingLoading] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) {
      setErrorMsg("Nama tidak boleh kosong.");
      return;
    }

    if (items.some((item) => item.name.toLowerCase() === newItemName.trim().toLowerCase())) {
      setErrorMsg("Nama tersebut sudah ada.");
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await onAddItem(newItemName.trim(), hasLanguageColumn ? newItemLanguage.trim() : undefined);
      setNewItemName("");
      setNewItemLanguage("");
    } catch {
      setErrorMsg("Gagal menambahkan item baru.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (item: MasterDataItem) => {
    setEditingId(item.id);
    setEditingName(item.name);
    setEditingLanguage(item.language || "");
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingName.trim()) return;
    if (items.some((i) => i.id !== id && i.name.toLowerCase() === editingName.trim().toLowerCase())) {
      setErrorMsg("Nama tersebut sudah digunakan.");
      return;
    }

    setErrorMsg(null);
    setIsEditingSaving(true);
    try {
      if (onEditItem) {
        await onEditItem(id, editingName.trim(), hasLanguageColumn ? editingLanguage.trim() : undefined);
      }
      setEditingId(null);
    } catch {
      setErrorMsg("Gagal memperbarui item.");
    } finally {
      setIsEditingSaving(false);
    }
  };

  const handleConfirmDelete = async (force = false) => {
    if (!deletingItem || !onDeleteItem) return;
    setIsDeletingLoading(true);
    setDeleteWarning(null);
    try {
      const res = await onDeleteItem(deletingItem.id, force);
      if (!res.success) {
        if (res.hasHistory) {
          setDeleteWarning(res.error || "Item ini pernah digunakan dalam data sesi kerja.");
          return;
        }
        setErrorMsg(res.error || "Gagal menghapus item.");
      } else {
        setDeletingItem(null);
      }
    } catch {
      setErrorMsg("Gagal menghapus item.");
    } finally {
      setIsDeletingLoading(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (statusFilter === "active") return item.is_active;
    if (statusFilter === "inactive") return !item.is_active;
    return true;
  });

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl p-6 border border-[var(--border)] shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
            {title}
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{description}</p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-[var(--bg-surface-alt)] p-1 rounded-xl text-xs font-semibold border border-[var(--border)] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              statusFilter === "active"
                ? "bg-[var(--accent-teal-soft)] text-[var(--accent-teal)] font-bold border border-[var(--accent-teal)]/30"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Aktif ({items.filter((i) => i.is_active).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("inactive")}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              statusFilter === "inactive"
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/30"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Nonaktif ({items.filter((i) => !i.is_active).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
              statusFilter === "all"
                ? "bg-[var(--primary-soft)] text-[var(--primary)] font-bold border border-[var(--primary)]/30"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            Semua ({items.length})
          </button>
        </div>
      </div>

      {/* Add Item Form */}
      <form onSubmit={handleAdd} className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder={`Tambah ${title.toLowerCase()} baru...`}
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] placeholder:text-[var(--text-secondary)]"
          />

          {hasLanguageColumn && (
            <input
              type="text"
              placeholder="Bahasa (misal: Thailand, China)"
              value={newItemLanguage}
              onChange={(e) => setNewItemLanguage(e.target.value)}
              className="sm:w-64 px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] placeholder:text-[var(--text-secondary)]"
            />
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:brightness-95 disabled:opacity-50 text-white font-medium text-xs rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
          >
            {isSubmitting ? "Menambahkan..." : "+ Tambah"}
          </button>
        </div>

        {hasLanguageColumn && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs">
            <span className="text-[11px] text-[var(--text-secondary)] font-medium">Pilihan cepat bahasa:</span>
            {COMMON_LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setNewItemLanguage(lang)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-colors cursor-pointer ${
                  newItemLanguage.toLowerCase() === lang.toLowerCase()
                    ? "bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary)]/30 font-bold"
                    : "bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--text-primary)]"
                }`}
              >
                + {lang}
              </button>
            ))}
          </div>
        )}
      </form>

      {errorMsg && (
        <p className="text-xs text-[var(--danger)] bg-[var(--primary-soft)] p-2.5 rounded-lg border border-[var(--danger)]/30 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="font-bold text-xs cursor-pointer">✕</button>
        </p>
      )}

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              <th className="pb-3">Nama</th>
              {hasLanguageColumn && <th className="pb-3">Bahasa</th>}
              <th className="pb-3">Status</th>
              <th className="pb-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={hasLanguageColumn ? 4 : 3} className="py-6 text-center text-[var(--text-secondary)] text-xs">
                  Tidak ada data untuk status filter ini.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-[var(--bg-surface-alt)]/50 transition-colors">
                  <td className="py-3 font-medium text-[var(--text-primary)]">
                    {editingId === item.id ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="px-2.5 py-1 text-xs rounded-lg border border-[var(--primary)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none"
                        autoFocus
                      />
                    ) : (
                      <span>{item.name}</span>
                    )}
                  </td>

                  {hasLanguageColumn && (
                    <td className="py-3">
                      {editingId === item.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="Bahasa"
                            value={editingLanguage}
                            onChange={(e) => setEditingLanguage(e.target.value)}
                            className="w-32 px-2.5 py-1 text-xs rounded-lg border border-[var(--primary)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none"
                          />
                        </div>
                      ) : (
                        renderLanguageBadge(item.language)
                      )}
                    </td>
                  )}

                  <td className="py-3">
                    {item.is_active ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--accent-teal-soft)] text-[var(--accent-teal)] border border-[var(--accent-teal)]/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-teal)]" />
                        Aktif
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Nonaktif (Arsip)
                      </span>
                    )}
                  </td>

                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {editingId === item.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(item.id)}
                            disabled={isEditingSaving}
                            className="px-2.5 py-1 text-xs bg-[var(--accent-teal)] hover:brightness-95 text-white rounded-md font-bold cursor-pointer transition-colors"
                          >
                            {isEditingSaving ? "..." : "✓ Simpan"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <>
                          {onEditItem && (
                            <button
                              type="button"
                              onClick={() => startEdit(item)}
                              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] transition-colors cursor-pointer"
                            >
                              ✏️ Edit
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onToggleStatus(item.id, item.is_active)}
                            className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                              item.is_active
                                ? "border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                                : "border-[var(--accent-teal)]/30 text-[var(--accent-teal)] hover:bg-[var(--accent-teal-soft)]"
                            }`}
                          >
                            {item.is_active ? "Nonaktifkan" : "Aktifkan"}
                          </button>

                          {onDeleteItem && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingItem(item);
                                setDeleteWarning(null);
                              }}
                              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[var(--danger)]/30 text-[var(--danger)] hover:bg-[var(--primary-soft)] transition-colors cursor-pointer"
                              title="Hapus permanen master data ini"
                            >
                              🗑️ Hapus
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={() => setDeletingItem(null)}>
          <div className="w-full max-w-md bg-[var(--bg-surface)] rounded-3xl shadow-2xl overflow-hidden border border-[var(--border)]" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[var(--primary)] px-6 py-5 text-white">
              <h3 className="text-base font-bold">🗑️ Konfirmasi Hapus Master Data</h3>
              <p className="text-xs text-white/90 mt-0.5">{deletingItem.name}</p>
            </div>

            <div className="p-6 space-y-4">
              {deleteWarning ? (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-700 dark:text-amber-300 text-xs space-y-3">
                  <p className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-200">
                    <span>⚠️ Proteksi Riwayat Kerjaan:</span>
                  </p>
                  <p>{deleteWarning}</p>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Pilih <strong>Nonaktifkan</strong> untuk mengarsip secara aman, atau <strong>Tetap Hapus Permanen</strong> jika ini data dummy test yang ingin dibersihkan dari database.
                  </p>
                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        onToggleStatus(deletingItem.id, deletingItem.is_active);
                        setDeletingItem(null);
                      }}
                      className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      🔒 Nonaktifkan Master Data Ini Saja (Aman)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmDelete(true)}
                      disabled={isDeletingLoading}
                      className="w-full py-2 bg-[var(--danger)] hover:bg-[var(--danger-hover)] text-white font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {isDeletingLoading ? "Menghapus..." : "🔥 Tetap Hapus Permanen Master Data Ini"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-primary)] leading-relaxed">
                  Apakah Anda yakin ingin menghapus master data <span className="font-bold">&quot;{deletingItem.name}&quot;</span> secara permanen? Data yang belum pernah terikat ke catatan sesi kerja karyawan akan dihapus bersih.
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingItem(null)}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-alt)] text-xs font-semibold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                {!deleteWarning && (
                  <button
                    type="button"
                    onClick={() => handleConfirmDelete(false)}
                    disabled={isDeletingLoading}
                    className="flex-1 py-2.5 rounded-xl bg-[var(--danger)] hover:bg-[var(--danger-hover)] text-white text-xs font-bold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isDeletingLoading ? "Hapus..." : "🗑️ Ya, Hapus Permanen"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
