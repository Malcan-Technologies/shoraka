"use client";

import { SystemHealthIndicator } from "@/components/system-health-indicator";
import { NavUser } from "@/components/nav-user";

/** Main header actions: system health + slim avatar menu. */
export function AdminHeaderChrome() {
  return (
    <>
      <SystemHealthIndicator />
      <NavUser variant="header" />
    </>
  );
}
