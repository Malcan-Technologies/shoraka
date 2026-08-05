"use client";

import { useEffect } from "react";
import { NotificationList, useHeader } from "@cashsouk/ui";
import {
  issuerContentMaxWidthClassName,
  issuerMainContentClassName,
  issuerPageGutterClassName,
} from "@/lib/issuer-layout";
import { cn } from "@/lib/utils";

export default function NotificationsPage() {
  const { setTitle } = useHeader();

  useEffect(() => {
    setTitle("Notifications");
  }, [setTitle]);

  return (
    <>
      <div className={cn(issuerMainContentClassName, issuerPageGutterClassName)}>
        <div className={issuerContentMaxWidthClassName}>
          <NotificationList />
        </div>
      </div>
    </>
  );
}
