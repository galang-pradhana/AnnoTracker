"use client";

import React from "react";
import Image from "next/image";

interface AppLogoProps {
  variant?: "icon" | "full" | "header";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showText?: boolean;
}

export function AppLogo({
  variant = "header",
  size = "md",
  className = "",
  showText = true,
}: AppLogoProps) {
  if (variant === "full") {
    const dim = size === "xl" ? 220 : size === "lg" ? 180 : size === "md" ? 140 : 100;
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        <Image
          src="/logo-full.png"
          alt="AnnoTracker"
          width={dim}
          height={dim}
          className="object-contain drop-shadow-sm"
          priority
        />
      </div>
    );
  }

  if (variant === "icon") {
    const dim = size === "xl" ? 64 : size === "lg" ? 48 : size === "md" ? 36 : 28;
    return (
      <Image
        src="/logo-icon.png"
        alt="AnnoTracker Logo"
        width={dim}
        height={dim}
        className={`object-contain ${className}`}
        priority
      />
    );
  }

  // variant === "header" (icon + crisp text)
  const iconDim = size === "sm" ? 28 : size === "md" ? 34 : size === "lg" ? 42 : 52;

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Image
        src="/logo-icon.png"
        alt="AnnoTracker"
        width={iconDim}
        height={iconDim}
        className="object-contain shrink-0"
        priority
      />
      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center text-base sm:text-lg font-extrabold tracking-tight leading-tight">
            <span className="text-slate-800 dark:text-white">Anno</span>
            <span className="text-[#FF531D] dark:text-[#FF6633]">Tracker</span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-none hidden sm:block">
            Catat · Pantau · Kelola
          </span>
        </div>
      )}
    </div>
  );
}
