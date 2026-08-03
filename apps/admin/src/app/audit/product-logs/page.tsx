import { redirect } from "next/navigation";

export default function ProductLogsRedirectPage() {
  redirect("/audit?tab=products");
}
