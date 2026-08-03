"use client";

import { NotificationBell } from "@cashsouk/ui";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { NavUser } from "@/components/nav-user";

/** Main header actions: org switcher, notifications, slim avatar menu. Balance lives in the sidebar footer. */
export function InvestorHeaderChrome() {
  return (
    <>
      <OrganizationSwitcher variant="header" />
      <NotificationBell />
      <NavUser variant="header" />
    </>
  );
}
