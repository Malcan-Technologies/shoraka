"use client";

import { NotificationBell } from "@cashsouk/ui";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { NavUser } from "@/components/nav-user";

/** Main header actions: organisation switcher, notifications, slim avatar menu. */
export function IssuerHeaderChrome() {
  return (
    <>
      <OrganizationSwitcher variant="header" />
      <NotificationBell />
      <NavUser variant="header" />
    </>
  );
}
