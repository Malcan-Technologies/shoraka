import { redirect } from "next/navigation";

/** Legacy route; legal PDFs open from footer/sidebar via the public API. */
export default function PrivacyRedirectPage() {
  redirect("/");
}
