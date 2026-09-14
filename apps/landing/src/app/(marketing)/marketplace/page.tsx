import type { Metadata } from "next";
import {
  marketplaceBookSummary,
  parseMarketplaceSort,
  parseMarketplaceViewMode,
  toMarketplaceNote,
} from "@cashsouk/types";
import { StatStrip } from "@cashsouk/ui";
import { PublicMarketplaceBrowser } from "../../../components/marketplace/public-marketplace-browser";
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
  const summary = marketplaceBookSummary(notes.map(toMarketplaceNote));

  return (
    <main className="min-w-0 flex-1 overflow-x-clip pt-16">
      <section className="bg-background">
        <div className="mx-auto max-w-7xl px-4 pt-12 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-end">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-ui font-medium text-secondary-foreground">
                <span className="size-1.5 rounded-full bg-status-success-text" aria-hidden="true" />
                Marketplace · live listings
              </div>
              <h1 className="mt-5 text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                Invest in verified secured loans
              </h1>
              <p className="mt-4 max-w-xl text-body leading-7 text-muted-foreground">
                Explore opportunities reviewed for clarity and structure—see profit rates, risk
                grades, and funding progress before you commit.
              </p>
            </div>
            <StatStrip
              cells={[
                { label: "Open notes", value: summary.openCount },
                { label: "Rate range", value: summary.rateRange, accent: true },
                { label: "Tenure", value: summary.tenureRange },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="bg-background">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-11 sm:px-6">
          <PublicMarketplaceBrowser
            notes={notes}
            initialFilters={{
              q: getSingleSearchParam(filters.q),
              industry: getSingleSearchParam(filters.industry),
              risk: getSingleSearchParam(filters.risk),
              profit: getSingleSearchParam(filters.profit),
              tenor: getSingleSearchParam(filters.tenor),
              page: parseMarketplacePageParam(getSingleSearchParam(filters.page)),
              sort: parseMarketplaceSort(getSingleSearchParam(filters.sort)),
              view: parseMarketplaceViewMode(getSingleSearchParam(filters.view)),
            }}
          />
        </div>
      </section>
    </main>
  );
}
