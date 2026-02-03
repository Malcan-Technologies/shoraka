"use client";

import { useEffect } from "react";
import { NotificationList, useHeader } from "@cashsouk/ui";

export default function NotificationsPage() {
  const { setTitle } = useHeader();

  useEffect(() => {
    setTitle("Notifications");
  }, [setTitle]);

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-8">
        <div className="mx-auto w-full max-w-4xl">
          <NotificationList />
        </div>
      </div>
    </>
  );
}
