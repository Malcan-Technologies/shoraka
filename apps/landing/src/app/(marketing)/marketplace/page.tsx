import type { Metadata } from "next";
import { InvestmentListingCard } from "../../../components/investment-listing-card";
import {
  MarketplaceFilterBar,
  MarketplaceShowMore,
} from "../../../components/marketplace-filter-bar";

export const metadata: Metadata = {
  title: "Marketplace | CashSouk",
  description:
    "Browse verified invoice financing and secured lending opportunities on CashSouk.",
};

export default function MarketplacePage() {
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
          <header className="max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Featured investment opportunities
            </h1>
            <p className="mt-3 text-[17px] leading-7 text-muted-foreground">
              Top picks curated for you.
            </p>
          </header>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <InvestmentListingCard key={`featured-${i}`} showDownloadLink />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8 md:py-10">
        <MarketplaceFilterBar />
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <InvestmentListingCard key={`grid-${i}`} showDownloadLink />
          ))}
        </div>
        <MarketplaceShowMore />
      </section>
    </main>
  );
}
