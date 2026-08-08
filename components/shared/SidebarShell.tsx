"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { SyncBadge } from "./SyncBadge";

interface SidebarShellProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  role: "employee" | "owner";
  userName?: string;
  userEmail?: string;
}

export function SidebarShell({
  sidebar,
  children,
  role,
}: SidebarShellProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Restore collapsed preference on desktop
  useEffect(() => {
    try {
      const stored = localStorage.getItem("anno-sidebar-collapsed");
      if (stored === "true") {
        setIsCollapsed(true);
      }
    } catch {}
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("anno-sidebar-collapsed", String(next));
      } catch {}
      return next;
    });
  };

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Page title mapping based on pathname
  const getPageTitle = (path: string) => {
    if (path.startsWith("/work-session")) return { title: "Catat Pekerjaan", desc: "Live timer & form input jam kerja harian" };
    if (path.startsWith("/history")) return { title: "Riwayat Kerja", desc: "Rekap jam kerja & estimasi pendapatan bulanan" };
    if (path.startsWith("/employee-assessment")) return { title: "Assessment Kualifikasi", desc: "Soal evaluasi & kualifikasi anotator" };
    if (path.startsWith("/employee-source")) return { title: "Source & Guideline", desc: "Panduan dan dokumen referensi task" };
    if (path.startsWith("/profile")) return { title: "Profil Akun", desc: "Data diri dan informasi rekening bank" };
    if (path.startsWith("/my-earnings")) return { title: "Pendapatan Saya", desc: "Rincian gaji & bonus per minggu" };

    if (path.startsWith("/dashboard")) return { title: "Dashboard Overview", desc: "Ringkasan performa tim, payroll & aktivitas harian" };
    if (path.startsWith("/payroll")) return { title: "Payroll & Jam Kerja", desc: "Laporan jam kerja, pencairan gaji & bukti transfer" };
    if (path.startsWith("/users")) return { title: "Kelola Karyawan", desc: "Manajemen akun, role, & rekening karyawan" };
    if (path.startsWith("/master-data")) return { title: "Master Data", desc: "Kelola akun klien, jenis task, & tier rate" };
    if (path.startsWith("/assessment")) return { title: "Kelola Assessment", desc: "Buat/edit soal kualifikasi & kelola submission" };
    if (path.startsWith("/source")) return { title: "Kelola Source Guideline", desc: "Upload dan kelola dokumen guideline task" };
    if (path.startsWith("/calendar")) return { title: "Kalender Tim", desc: "Jadwal dan aktivitas kerja harian tim" };
    if (path.startsWith("/settings")) return { title: "Pengaturan Sistem", desc: "Konfigurasi bonus rule & parameter sistem" };

    return { title: "AnnoTracker", desc: "Aplikasi Pencatatan Jam Kerja & Payroll" };
  };

  const pageInfo = getPageTitle(pathname);

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] transition-colors duration-200 flex flex-col lg:flex-row">
      {/* Backdrop overlay for mobile drawer */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`
          fixed top-0 bottom-0 left-0 z-50 bg-[var(--bg-surface)] border-r border-[var(--border)]
          transition-all duration-300 ease-in-out flex flex-col shadow-xs
          ${isMobileOpen ? "translate-x-0 w-[260px]" : "-translate-x-full lg:translate-x-0"}
          ${isCollapsed ? "lg:w-[var(--sidebar-collapsed-width)]" : "lg:w-[var(--sidebar-width)]"}
        `}
      >
        {React.cloneElement(
          sidebar as React.ReactElement<{
            isCollapsed?: boolean;
            onToggleCollapse?: () => void;
            onCloseMobile?: () => void;
          }>,
          {
            isCollapsed,
            onToggleCollapse: toggleCollapse,
            onCloseMobile: () => setIsMobileOpen(false),
          }
        )}
      </aside>

      {/* Main Content Area */}
      <div
        className={`
          flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out
          ${isCollapsed ? "lg:ml-[var(--sidebar-collapsed-width)]" : "lg:ml-[var(--sidebar-width)]"}
        `}
      >
        {/* Top Bar Header */}
        <header className="sticky top-0 z-30 bg-[var(--bg-surface)]/90 backdrop-blur-md border-b border-[var(--border)] px-4 sm:px-6 h-[var(--topbar-height)] flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger Mobile Toggle */}
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] cursor-pointer"
              aria-label="Buka Menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            {/* Page Title & Breadcrumb */}
            <div className="truncate">
              <h1 className="text-sm sm:text-base font-extrabold text-[var(--text-primary)] leading-tight truncate">
                {pageInfo.title}
              </h1>
              <p className="text-[11px] text-[var(--text-secondary)] truncate hidden sm:block">
                {pageInfo.desc}
              </p>
            </div>
          </div>

          {/* Top Bar Right Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {role === "employee" && <SyncBadge />}
            <ThemeToggle />
          </div>
        </header>

        {/* Inner Page Viewport */}
        <main className="flex-1 pb-12">{children}</main>
      </div>
    </div>
  );
}
