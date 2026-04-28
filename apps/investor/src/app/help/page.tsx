import type { Metadata } from "next";
import { getHelpArticles } from "@cashsouk/help-content";
import { HelpIndexView } from "@cashsouk/ui";

export const metadata: Metadata = {
  title: "Help Center | CashSouk Investor",
  description: "Investor knowledge base and portal guides.",
};

export default function HelpPage() {
  const articles = getHelpArticles("investor");

  return <HelpIndexView articles={articles} portalLabel="Investor" />;
}
