"use client";

import { Header } from "../../../components/header";
import { NotificationPreferences } from "@cashsouk/ui";

export default function NotificationSettingsPage() {
  return (
    <>
      <Header title="Notification Settings" />
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-8">
        <div className="mx-auto w-full max-w-4xl">
          <div className="mb-8">
            <h2 className="text-2xl font-bold">Notification Preferences</h2>
            <p className="text-muted-foreground">
              Choose how you want to be notified about important updates.
            </p>
          </div>
          <NotificationPreferences />
        </div>
      </div>
    </>
  );
}
