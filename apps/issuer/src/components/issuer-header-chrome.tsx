"use client";

import { NotificationBell } from "@cashsouk/ui";
import { NavUser } from "@/components/nav-user";

/** Main header actions: notifications and slim avatar menu. Organisation switcher lives in the sidebar. */
export function IssuerHeaderChrome() {
  return (
    <>
      <NotificationBell />
      <NavUser variant="header" />
    </>
  );
}
