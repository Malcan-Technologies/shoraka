import type { Metadata } from "next";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { PublicMarketplaceBrowser } from "../../../components/public-marketplace-browser";
import { getPublicMarketplaceNotes } from "../../../lib/public-marketplace-notes";

export const metadata: Metadata = {
  title: "Invest in qualified notes | CashSouk",
  description:
    "Browse qualified invoice financing notes with transparent profit rates, SoukScore risk grades, and live funding progress on CashSouk.",
};

function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseMarketplacePageParam(value: string | undefined): number {
  const trimmed = value?.trim();
  if (!trimmed) return 1;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [notes, filters] = await Promise.all([getPublicMarketplaceNotes(), searchParams]);

  return (
    <main className="flex-1 pt-16">
      <section className="relative overflow-hidden border-b border-border/60 bg-muted/35">
        <div
          className="pointer-events-none absolute -left-24 -top-24 size-[min(55vw,28rem)] rounded-full bg-primary/[0.12] blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute right-0 top-0 size-[min(40vw,20rem)] rounded-full bg-primary/10 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14 lg:py-16">
          <div className="relative z-[1] mb-8 space-y-5 md:mb-12 md:space-y-6">
            <div className="inline-flex max-w-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-xs shadow-sm sm:flex-row sm:rounded-full sm:text-[15px]">
              <span className="inline-flex items-center gap-2 bg-muted px-3 py-1.5 font-medium text-secondary-foreground sm:px-4 sm:py-2">
                <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                Marketplace
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1.5 font-medium text-foreground sm:px-4 sm:py-2">
                Live listings
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </span>
            </div>

            <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
              Invest in verified secured loans
            </h1>

            <p className="max-w-[40rem] text-[17px] leading-7 text-muted-foreground">
              Explore opportunities reviewed for clarity and structure—see profit rates, risk
              grades, and funding progress before you commit.
            </p>
          </div>

          <PublicMarketplaceBrowser
            notes={notes}
            initialFilters={{
              q: getSingleSearchParam(filters.q),
              industry: getSingleSearchParam(filters.industry),
              risk: getSingleSearchParam(filters.risk),
              profit: getSingleSearchParam(filters.profit),
              tenor: getSingleSearchParam(filters.tenor),
              page: parseMarketplacePageParam(getSingleSearchParam(filters.page)),
            }}
          />
        </div>
      </section>
    </main>
  );
}
