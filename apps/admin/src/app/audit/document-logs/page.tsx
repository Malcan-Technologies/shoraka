import { redirect } from "next/navigation";

export default function DocumentLogsRedirectPage() {
  redirect("/audit?tab=documents");
}
