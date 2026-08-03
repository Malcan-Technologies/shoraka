import { redirect } from "next/navigation";

export default function AccessLogsRedirectPage() {
  redirect("/audit?tab=access");
}
