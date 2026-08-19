"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AppLogo } from "./AppLogo";
import { ROUTES } from "@/constants";

interface SidebarChildProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onCloseMobile?: () => void;
}

const MENU_ITEMS = [
  {
    label: "Catat Kerja",
    href: ROUTES.EMPLOYEE_WORK_SESSION,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    label: "Riwayat Kerja",
    href: ROUTES.EMPLOYEE_HISTORY,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
  },
  {
    label: "Leaderboard",
    href: ROUTES.EMPLOYEE_LEADERBOARD,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
      </svg>
    ),
  },
  {
    label: "Assessment",
    href: ROUTES.EMPLOYEE_ASSESSMENT,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    label: "Source / Guideline",
    href: ROUTES.EMPLOYEE_SOURCE,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
  {
    label: "Profil Akun",
    href: ROUTES.EMPLOYEE_PROFILE,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0zM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
];

export function EmployeeSidebar({
  isCollapsed = false,
  onToggleCollapse,
  onCloseMobile,
}: SidebarChildProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState<string>("Employee");
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUserEmail(data.user.email || "");
        supabase
          .from("users")
          .select("full_name")
          .eq("id", data.user.id)
          .single()
          .then(({ data: u }) => {
            if (u?.full_name) setUserName(u.full_name);
          });
      }
    });
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(ROUTES.LOGIN);
  };

  return (
    <div className="h-full flex flex-col justify-between p-3 select-none">
      {/* Top Brand Header */}
      <div>
        <div className="flex items-center justify-between px-2 py-3 mb-2 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <AppLogo variant="icon" size="md" />
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-black text-sm tracking-tight text-[var(--text-primary)] leading-tight truncate">
                  Anno<span className="text-[var(--primary)]">Tracker</span>
                </span>
                <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-bold text-[var(--primary)] bg-[var(--primary-soft)] px-2 py-0.5 rounded-full w-max border border-[var(--primary)]/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
                  Employee
                </span>
              </div>
            )}
          </div>

          {/* Desktop Collapse Toggle */}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] cursor-pointer transition-colors shrink-0"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={isCollapsed ? "M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5" : "M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5"}
              />
            </svg>
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1 mt-3">
          {MENU_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-xs transition-all relative group
                  ${
                    isActive
                      ? "bg-[var(--primary-soft)] text-[var(--primary)] font-bold shadow-2xs"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)]"
                  }
                `}
                title={isCollapsed ? item.label : undefined}
              >
                {/* Active Left Accent Bar */}
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 bg-[var(--primary)] rounded-r-full" />
                )}
                <span className={`shrink-0 ${isActive ? "text-[var(--primary)]" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"}`}>
                  {item.icon}
                </span>
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Profile & Logout Area */}
      <div className="pt-3 border-t border-[var(--border)] mt-auto space-y-2">
        {!isCollapsed ? (
          <div className="px-2 py-2 rounded-xl bg-[var(--bg-surface-alt)]/60 border border-[var(--border)] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] font-bold text-xs flex items-center justify-center shrink-0 border border-[var(--primary)]/30">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[var(--text-primary)] truncate leading-tight">{userName}</p>
                <p className="text-[10px] text-[var(--text-secondary)] truncate">{userEmail || "Employee"}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-1">
            <div
              className="w-9 h-9 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] font-bold text-sm flex items-center justify-center border border-[var(--primary)]/30"
              title={userName}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleLogout}
          className={`
            w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[var(--danger)] hover:bg-[var(--primary-soft)] transition-colors cursor-pointer
            ${isCollapsed ? "px-0" : ""}
          `}
          title="Keluar / Sign Out"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
          </svg>
          {!isCollapsed && <span>Keluar</span>}
        </button>
      </div>
    </div>
  );
}
