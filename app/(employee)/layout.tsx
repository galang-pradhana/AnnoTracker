"use client";

import React from "react";
import { SidebarShell } from "@/components/shared/SidebarShell";
import { EmployeeSidebar } from "@/components/shared/EmployeeSidebar";

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarShell role="employee" sidebar={<EmployeeSidebar />}>
      {children}
    </SidebarShell>
  );
}
