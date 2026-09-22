"use client";

import { AdminHeaderClock } from "@/components/admin-header-clock";
import { SystemHealthIndicator } from "@/components/system-health-indicator";
import { NavUser } from "@/components/nav-user";

/** Main header actions: Malaysia clock, system health, slim avatar menu. */
export function AdminHeaderChrome() {
  return (
    <>
      <AdminHeaderClock />
      <SystemHealthIndicator />
      <NavUser variant="header" />
    </>
  );
}
