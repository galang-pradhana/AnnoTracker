"use client";

import React from "react";
import { SidebarShell } from "@/components/shared/SidebarShell";
import { OwnerSidebar } from "@/components/shared/OwnerSidebar";

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarShell role="owner" sidebar={<OwnerSidebar />}>
      {children}
    </SidebarShell>
  );
}
