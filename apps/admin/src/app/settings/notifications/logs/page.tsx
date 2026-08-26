import { redirect } from "next/navigation";

export default function NotificationLogsSettingsRedirectPage() {
  redirect("/audit?tab=notifications");
}
