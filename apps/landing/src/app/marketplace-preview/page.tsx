import Link from "next/link";
import { Navbar } from "../../components/navbar";
import { Footer } from "../../components/footer";
import { Button } from "@cashsouk/ui";
import { createApiClient } from "@cashsouk/config/src/api-client";
import type { NoteListItem } from "@cashsouk/types";
import { LandingMarketplacePreview } from "../../components/landing-marketplace-preview";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const INVESTOR_URL = process.env.NEXT_PUBLIC_INVESTOR_URL || "http://localhost:3001";

export const revalidate = 120;

async function getLandingMarketplaceNotes(): Promise<NoteListItem[]> {
  const apiClient = createApiClient(API_URL);
  const response = await apiClient.getPublicMarketplaceNotes({ page: 1, pageSize: 3 });
  if (!response.success) return [];
  return response.data.notes;
}

export default async function MarketplacePreviewPage() {
  const notes = await getLandingMarketplaceNotes();
  return (
    <>
      <Navbar />
      <main className="bg-background pt-16">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-secondary/10 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        <section className="relative mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <div className="overflow-hidden rounded-3xl border border-border bg-card/80 shadow-xl backdrop-blur-sm">
            <div className="h-1.5 bg-gradient-to-r from-primary via-accent to-secondary" />
            <div className="space-y-8 p-8 md:p-12 lg:p-16">
              <div className="inline-flex items-center rounded-full bg-primary/10 px-4 py-1 text-sm font-semibold text-primary">
                P2P Lending Marketplace
              </div>
              <div className="space-y-5">
                <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                  Invest in verified secured loans
                </h1>
                <p className="max-w-[60ch] text-[17px] leading-7 text-muted-foreground">
                  Discover curated invoice financing notes with transparent profit rates, funding
                  progress, and maturity windows. Browse opportunities and start investing in
                  minutes.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild className="h-12 px-8 text-[15px] font-medium">
                  <Link href="/get-started">Get started</Link>
                </Button>
                <Button asChild variant="outline" className="h-12 px-8 text-[15px]">
                  <Link href={INVESTOR_URL}>Explore investor portal</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <LandingMarketplacePreview notes={notes} investorListingsHref={`${INVESTOR_URL}/investments`} />
        <div className="border-t border-border">
          <Footer />
        </div>
      </main>
    </>
  );
}
