import { redirect } from "next/navigation";

export default function NotificationLogsRedirectPage() {
  redirect("/audit?tab=notifications");
}
