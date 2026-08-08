"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { AppLogo } from "@/components/shared/AppLogo";
import { ROUTES } from "@/constants";

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
  drive_url: string;
  links: GuidelineLink[];
  display_order: number;
}

// Helper: ambil semua link (merge links JSONB + fallback drive_url)
function getAllLinks(g: SourceGuideline): GuidelineLink[] {
  const multi = Array.isArray(g.links) ? g.links : [];
  if (multi.length > 0) return multi;
  if (g.drive_url) return [{ label: 'Buka Guideline', url: g.drive_url }];
  return [];
}

export default function EmployeeSourcePage() {
  const [guidelines, setGuidelines] = useState<SourceGuideline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchGuidelines = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("source_guidelines")
        .select("id, title, description, category, icon, drive_url, display_order")
        .eq("is_active", true)
        .order("display_order")
        .order("created_at");
      setGuidelines((data as SourceGuideline[]) ?? []);
    } catch {
      // Fail silently
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGuidelines();
  }, [fetchGuidelines]);

  const categories = ["Semua", ...Array.from(new Set(guidelines.map((g) => g.category)))];
  const filtered = activeCategory === "Semua" ? guidelines : guidelines.filter((g) => g.category === activeCategory);

  const handleCopy = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 space-y-4">

        {/* Greeting Banner */}
        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-[var(--primary)] to-[var(--primary-hover)] rounded-2xl text-white shadow-sm">
          <div className="text-2xl">📚</div>
          <div>
            <p className="text-sm font-bold">Cek guideline sebelum mulai kerja!</p>
            <p className="text-[11px] text-white/70 mt-0.5">Buka PDF panduan untuk memastikan kualitas anotasi sesuai standar.</p>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 flex-wrap">
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
        </div>

        {/* Cards */}
        {isLoading ? (
          <div className="py-16 text-center">
            <div className="text-2xl mb-2 animate-pulse">📂</div>
            <p className="text-sm text-[var(--text-secondary)]">Memuat guideline...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-sm text-[var(--text-secondary)]">Belum ada guideline untuk kategori ini.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((g) => (
              <div
                key={g.id}
                className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-4 flex flex-col gap-3 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 bg-[var(--primary-soft)] border border-[var(--primary)]/20">
                    {g.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[var(--text-primary)] leading-tight">{g.title}</p>
                    {g.description && (
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">{g.description}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--primary-soft)] text-[var(--primary)]">
                    {g.category}
                  </span>
                </div>

                <div className="flex gap-2">
                  {getAllLinks(g).map((lnk, idx) => {
                    const copyKey = `${g.id}-${idx}`;
                    return (
                      <React.Fragment key={idx}>
                        <a
                          href={lnk.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold rounded-xl transition-colors overflow-hidden"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          <span className="truncate">{lnk.label || `Link ${idx + 1}`}</span>
                        </a>
                        <button
                          onClick={() => handleCopy(copyKey, lnk.url)}
                          className={`px-2.5 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shrink-0 ${
                            copiedId === copyKey
                              ? 'bg-[var(--accent-teal-soft)] border-[var(--accent-teal)]/30 text-[var(--accent-teal)]'
                              : 'bg-[var(--bg-surface-alt)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {copiedId === copyKey ? '✓' : '📋'}
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
