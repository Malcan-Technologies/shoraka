"use client";

import { Header } from "../../components/header";
import { NotificationList } from "@cashsouk/ui";

export default function NotificationsPage() {
  return (
    <>
      <Header title="Notifications" />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-8">
        <div className="mx-auto w-full max-w-4xl">
          <NotificationList />
        </div>
      </div>
    </>
  );
}
