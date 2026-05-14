import type { Metadata } from "next";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { createApiClient } from "@cashsouk/config/src/api-client";
import type { NoteListItem } from "@cashsouk/types";
import { PublicMarketplaceBrowser } from "../../../components/public-marketplace-browser";

export const metadata: Metadata = {
  title: "Invest in qualified notes | CashSouk",
  description:
    "Browse qualified invoice financing notes with transparent profit rates, SoukScore risk grades, and live funding progress on CashSouk.",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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

async function getMarketplaceNotes(): Promise<NoteListItem[]> {
  try {
    const apiClient = createApiClient(API_URL);
    const response = await apiClient.getPublicMarketplaceNotes({
      page: 1,
      pageSize: 100,
    });

    if (!response.success) return [];
    return response.data.notes;
  } catch {
    return [];
  }
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const notes = await getMarketplaceNotes();
  const filters = await searchParams;

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
          <div className="relative z-[1] mb-10 space-y-6 md:mb-12">
            <div className="inline-flex max-w-full flex-wrap items-center overflow-hidden rounded-full border border-border bg-card text-[15px] shadow-sm">
              <span className="inline-flex items-center gap-2 bg-muted px-4 py-2 font-medium text-secondary-foreground">
                <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                Marketplace
              </span>
              <span className="inline-flex items-center gap-1 px-4 py-2 font-medium text-foreground">
                Live listings
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
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
