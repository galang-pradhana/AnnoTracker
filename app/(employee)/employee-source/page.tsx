"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { AppLogo } from "@/components/shared/AppLogo";
import { ROUTES } from "@/constants";

// ─────────────────────────────────────────────────────────────
// 📌 DAFTAR GUIDELINE – sama seperti halaman owner
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

export default function EmployeeSourcePage() {
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
      <header className="bg-[var(--bg-surface)] border-b border-[var(--border)] px-4 py-3 sticky top-0 z-10 shadow-2xs transition-colors">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AppLogo variant="icon" size="sm" />
            <div>
              <h1 className="text-sm font-bold text-[var(--text-primary)]">📂 Source Guideline</h1>
              <p className="text-[11px] text-[var(--text-secondary)]">Panduan pengerjaan task annotasi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={ROUTES.EMPLOYEE_WORK_SESSION}
              className="px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface-alt)] border border-[var(--border)] rounded-lg transition-colors"
            >
              ← Kerja
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-5">

        {/* Greeting Banner */}
        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-hover)] rounded-2xl text-white shadow-sm">
          <div className="text-2xl">📚</div>
          <div>
            <p className="text-sm font-bold">Halo! Cek guideline sebelum mulai kerja ya.</p>
            <p className="text-[11px] text-white/70 mt-0.5">Klik tombol Buka Guideline untuk melihat PDF panduan task-mu.</p>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 flex-wrap">
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
        </div>

        {/* Cards */}
        <div className="space-y-3">
          {filtered.map((g) => (
            <div
              key={g.id}
              className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-4 flex flex-col gap-3 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 border"
                  style={{ background: g.colorSoft, borderColor: `${g.color}30` }}
                >
                  {g.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[var(--text-primary)] leading-tight">{g.title}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">{g.description}</p>
                </div>
                <span
                  className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ color: g.color, background: g.colorSoft }}
                >
                  {g.category}
                </span>
              </div>

              <div className="flex gap-2">
                <a
                  href={g.driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold rounded-xl transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Buka Guideline
                </a>
                <button
                  onClick={() => handleCopy(g.id, g.driveUrl)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    copiedId === g.id
                      ? "bg-[var(--accent-teal-soft)] border-[var(--accent-teal)]/30 text-[var(--accent-teal)]"
                      : "bg-[var(--bg-surface-alt)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {copiedId === g.id ? "✓ Disalin!" : "Salin"}
                </button>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-sm text-[var(--text-secondary)]">Tidak ada guideline untuk kategori ini.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
