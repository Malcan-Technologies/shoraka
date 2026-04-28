import type { Metadata } from "next";
import { getHelpArticles } from "@cashsouk/help-content";
import { HelpIndexView } from "@cashsouk/ui";

export const metadata: Metadata = {
  title: "Help Center | CashSouk Admin",
  description: "Admin knowledge base and workflow guides.",
};

export default function HelpPage() {
  const articles = getHelpArticles("admin");

  return <HelpIndexView articles={articles} portalLabel="Admin" />;
}
