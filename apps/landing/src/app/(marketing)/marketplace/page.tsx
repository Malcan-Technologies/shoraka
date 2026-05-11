import type { Metadata } from "next";
import { createApiClient } from "@cashsouk/config/src/api-client";
import type { NoteListItem } from "@cashsouk/types";
import { PublicMarketplaceBrowser } from "../../../components/public-marketplace-browser";

export const metadata: Metadata = {
  title: "Marketplace | CashSouk",
  description:
    "Browse verified invoice financing and secured lending opportunities on CashSouk.",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function getMarketplaceNotes(): Promise<NoteListItem[]> {
  const apiClient = createApiClient(API_URL);
  const response = await apiClient.getPublicMarketplaceNotes({
    page: 1,
    pageSize: 100,
  });

  if (!response.success) return [];
  return response.data.notes;
}

export default async function MarketplacePage() {
  const notes = await getMarketplaceNotes();

  return (
    <main className="flex-1 pt-16">
      <section className="relative overflow-hidden border-b border-border/60 bg-muted/35">
        <div
          className="pointer-events-none absolute -left-24 -top-24 size-[min(55vw,28rem)] rounded-full bg-primary/[0.12] blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute right-0 top-0 size-[min(40vw,20rem)] rounded-full bg-violet-300/25 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-7xl px-6 py-10 md:py-14 lg:py-16">
          <PublicMarketplaceBrowser notes={notes} />
        </div>
      </section>
    </main>
  );
}
