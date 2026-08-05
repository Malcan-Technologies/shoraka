import { redirect } from "next/navigation";

export default function SecurityLogsRedirectPage() {
  redirect("/audit?tab=security");
}
