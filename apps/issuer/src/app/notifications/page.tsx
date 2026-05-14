"use client";

import { useEffect } from "react";
import { NotificationList, useHeader } from "@cashsouk/ui";
import { issuerMainContentClassName, issuerPageGutterClassName } from "@/lib/issuer-layout";
import { cn } from "@/lib/utils";

export default function NotificationsPage() {
  const { setTitle } = useHeader();

  useEffect(() => {
    setTitle("Notifications");
  }, [setTitle]);

  return (
    <>
      <div className={cn(issuerMainContentClassName, issuerPageGutterClassName)}>
        <div className="mx-auto w-full max-w-4xl">
          <NotificationList />
        </div>
      </div>
    </>
  );
}
