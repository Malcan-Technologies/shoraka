import { redirect } from "next/navigation";

export default function NotificationLogsAuditRedirectPage() {
  redirect("/audit?tab=notifications");
}
