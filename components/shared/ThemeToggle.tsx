"use client";

import React, { useEffect, useState } from "react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setMounted(true);
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);

    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("anno-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("anno-theme", "light");
    }
  };

  if (!mounted) {
    return (
      <div className="w-16 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 animate-pulse" />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-xs font-semibold flex items-center gap-1.5"
      title="Ganti Mode Warna"
    >
      {theme === "light" ? (
        <>
          <span>🌙</span>
          <span className="hidden sm:inline">Dark</span>
        </>
      ) : (
        <>
          <span>☀️</span>
          <span className="hidden sm:inline">Light</span>
        </>
      )}
    </button>
  );
}
