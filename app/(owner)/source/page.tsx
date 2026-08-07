"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { ROUTES } from "@/constants";

// ─────────────────────────────────────────────────────────────
// 📌 EDIT DAFTAR GUIDELINE DI SINI
// Tambahkan / hapus item sesuai kebutuhan
// ─────────────────────────────────────────────────────────────
const GUIDELINES = [
  {
    id: 1,
    title: "Guideline PR – Thailand (Preecha)",
    description: "Panduan lengkap pengerjaan task PR untuk akun klien Preecha bahasa Thailand.",
    category: "Thailand",
    account: "preecha",
    icon: "🇹🇭",
    color: "var(--accent-teal)",
    colorSoft: "var(--accent-teal-soft)",
    driveUrl: "https://drive.google.com/your-link-here",
  },
  {
    id: 2,
    title: "Guideline AFM – China (Syimei)",
    description: "Panduan pengerjaan task AFM untuk akun klien Syimei bahasa Mandarin.",
    category: "China",
    account: "syimei",
    icon: "🇨🇳",
    color: "#e74c3c",
    colorSoft: "rgba(231,76,60,0.08)",
    driveUrl: "https://drive.google.com/your-link-here",
  },
  {
    id: 3,
    title: "Guideline AFM – China (Bjunwen)",
    description: "Panduan pengerjaan task AFM untuk akun klien Bjunwen bahasa Mandarin.",
    category: "China",
    account: "bjunwen",
    icon: "🇨🇳",
    color: "#e74c3c",
    colorSoft: "rgba(231,76,60,0.08)",
    driveUrl: "https://drive.google.com/your-link-here",
  },
  {
    id: 4,
    title: "Guideline Umum – Audio Transcription",
    description: "Panduan standar untuk semua task audio transcription lintas akun.",
    category: "Umum",
    account: "all",
    icon: "🎧",
    color: "#8e44ad",
    colorSoft: "rgba(142,68,173,0.08)",
    driveUrl: "https://drive.google.com/your-link-here",
  },
  {
    id: 5,
    title: "Guideline Umum – Image Bounding Box",
    description: "Panduan anotasi gambar bounding box untuk semua akun klien.",
    category: "Umum",
    account: "all",
    icon: "🖼️",
    color: "#e67e22",
    colorSoft: "rgba(230,126,34,0.08)",
    driveUrl: "https://drive.google.com/your-link-here",
  },
];
// ─────────────────────────────────────────────────────────────

const CATEGORIES = ["Semua", ...Array.from(new Set(GUIDELINES.map((g) => g.category)))];

export default function OwnerSourcePage() {
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const filtered =
    activeCategory === "Semua"
      ? GUIDELINES
      : GUIDELINES.filter((g) => g.category === activeCategory);

  const handleCopy = (id: number, url: string) => {
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
            <p className="text-xs text-[var(--text-secondary)]">Kumpulan link PDF panduan pengerjaan task annotasi</p>
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

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 pt-8 space-y-6">

        {/* Info Banner */}
        <div className="flex items-start gap-4 p-4 bg-[var(--primary-soft)] border border-[var(--primary)]/20 rounded-2xl">
          <div className="text-2xl mt-0.5">💡</div>
          <div>
            <p className="text-sm font-bold text-[var(--primary)]">Cara menggunakan halaman ini</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Klik tombol <strong>Buka Guideline</strong> untuk membuka PDF di Google Drive. Klik <strong>Salin Link</strong> untuk menyalin URL agar bisa dibagikan ke tim.
              Untuk menambah atau mengedit link, edit file <code className="bg-[var(--bg-surface-alt)] px-1 rounded text-[10px]">app/(owner)/source/page.tsx</code>.
            </p>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-[var(--text-secondary)] mr-1">Filter:</span>
          {CATEGORIES.map((cat) => (
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
          <span className="ml-auto text-xs text-[var(--text-secondary)]">{filtered.length} guideline</span>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((g) => (
            <div
              key={g.id}
              className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 flex flex-col gap-4 hover:shadow-md transition-shadow"
            >
              {/* Icon + Title */}
              <div className="flex items-start gap-3">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 border"
                  style={{ background: g.colorSoft, borderColor: `${g.color}30` }}
                >
                  {g.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[var(--text-primary)] leading-tight">{g.title}</p>
                  <span
                    className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ color: g.color, background: g.colorSoft }}
                  >
                    {g.category}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{g.description}</p>

              {/* Link preview */}
              <div className="flex items-center gap-1 px-3 py-2 bg-[var(--bg-surface-alt)] rounded-xl border border-[var(--border)] overflow-hidden">
                <span className="text-xs">🔗</span>
                <span className="text-[11px] text-[var(--text-secondary)] truncate flex-1 font-mono">
                  {g.driveUrl}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <a
                  href={g.driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold rounded-xl transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Buka Guideline
                </a>
                <button
                  onClick={() => handleCopy(g.id, g.driveUrl)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    copiedId === g.id
                      ? "bg-[var(--accent-teal-soft)] border-[var(--accent-teal)]/30 text-[var(--accent-teal)]"
                      : "bg-[var(--bg-surface-alt)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {copiedId === g.id ? "✓ Disalin!" : "Salin Link"}
                </button>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-sm font-semibold text-[var(--text-secondary)]">Tidak ada guideline untuk kategori ini.</p>
          </div>
        )}
      </main>
    </div>
  );
}
