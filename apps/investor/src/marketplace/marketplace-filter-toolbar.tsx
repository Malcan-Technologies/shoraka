"use client";

import {
  MARKETPLACE_TENURE_FILTER_LABELS,
  SOUKSCORE_RISK_RATING_GRADES,
  marketplaceTenureFilterLabel,
} from "@cashsouk/types";
import { ListToolbarFilterTrigger, type FilterChip } from "@cashsouk/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ONBOARDING_INDUSTRY_OPTIONS } from "@/investments/industry-filter-options";
import type { MarketplaceNoteFilters } from "./marketplace-note-model";

const PROFIT_LABELS: Record<string, string> = {
  low: "Below 14%",
  mid: "14% – 15%",
  high: "Above 15%",
};

const TENOR_LABELS = MARKETPLACE_TENURE_FILTER_LABELS;

const LISTING_LABELS: Record<string, string> = {
  open: "Open for funding",
  funded: "Funded",
  failed: "Not funded",
  all: "All listings",
};

export function marketplaceFilterChipLabels(filters: MarketplaceNoteFilters) {
  return {
    listing: filters.listing === "open" ? null : `Listing: ${LISTING_LABELS[filters.listing] ?? filters.listing}`,
    industry: filters.industry === "all" ? null : `Industry: ${filters.industry}`,
    risk: filters.risk === "all" ? null : `Risk: ${filters.risk}`,
    profit: filters.profit === "all" ? null : `Profit: ${PROFIT_LABELS[filters.profit] ?? filters.profit}`,
    tenor:
      filters.tenor === "all"
        ? null
        : `Tenure: ${marketplaceTenureFilterLabel(filters.tenor) ?? filters.tenor}`,
  };
}

export function marketplaceFilterChips(
  filters: MarketplaceNoteFilters,
  onChange: (next: MarketplaceNoteFilters) => void
): FilterChip[] {
  const labels = marketplaceFilterChipLabels(filters);
  const chips: FilterChip[] = [];
  if (labels.listing) {
    chips.push({
      id: "listing",
      label: labels.listing,
      onRemove: () => onChange({ ...filters, listing: "open" }),
    });
  }
  if (labels.industry) {
    chips.push({
      id: "industry",
      label: labels.industry,
      onRemove: () => onChange({ ...filters, industry: "all" }),
    });
  }
  if (labels.risk) {
    chips.push({
      id: "risk",
      label: labels.risk,
      onRemove: () => onChange({ ...filters, risk: "all" }),
    });
  }
  if (labels.profit) {
    chips.push({
      id: "profit",
      label: labels.profit,
      onRemove: () => onChange({ ...filters, profit: "all" }),
    });
  }
  if (labels.tenor) {
    chips.push({
      id: "tenor",
      label: labels.tenor,
      onRemove: () => onChange({ ...filters, tenor: "all" }),
    });
  }
  return chips;
}

function moreFilterCount(filters: MarketplaceNoteFilters): number {
  return [filters.risk, filters.profit, filters.tenor].filter((value) => value !== "all").length;
}

export function MarketplaceFilterToolbar({
  filters,
  onChange,
}: {
  filters: MarketplaceNoteFilters;
  onChange: (next: MarketplaceNoteFilters) => void;
}) {
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ListToolbarFilterTrigger
            label="Listing"
            count={filters.listing !== "open" ? 1 : 0}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Listing</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={filters.listing}
            onValueChange={(listing) =>
              onChange({ ...filters, listing: listing as MarketplaceNoteFilters["listing"] })
            }
          >
            <DropdownMenuRadioItem value="open">Open for funding</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="funded">Funded</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="failed">Not funded</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="all">All listings</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ListToolbarFilterTrigger
            label="Industry"
            count={filters.industry !== "all" ? 1 : 0}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="max-h-[min(24rem,var(--radix-dropdown-menu-content-available-height))] w-80 overflow-y-auto"
        >
          <DropdownMenuLabel>Industry</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={filters.industry}
            onValueChange={(industry) => onChange({ ...filters, industry })}
          >
            <DropdownMenuRadioItem value="all">All industries</DropdownMenuRadioItem>
            {ONBOARDING_INDUSTRY_OPTIONS.map((industry) => (
              <DropdownMenuRadioItem key={industry} value={industry}>
                {industry}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ListToolbarFilterTrigger label="Filters" count={moreFilterCount(filters)} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 p-0">
          <div className="p-1">
            <DropdownMenuLabel>Risk score</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={filters.risk}
              onValueChange={(risk) => onChange({ ...filters, risk })}
            >
              <DropdownMenuRadioItem value="all">All risk scores</DropdownMenuRadioItem>
              {SOUKSCORE_RISK_RATING_GRADES.map((grade) => (
                <DropdownMenuRadioItem key={grade} value={grade}>
                  {grade}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </div>
          <DropdownMenuSeparator />
          <div className="p-1">
            <DropdownMenuLabel>Profit band</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={filters.profit}
              onValueChange={(profit) => onChange({ ...filters, profit })}
            >
              <DropdownMenuRadioItem value="all">All profit bands</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="low">Below 14%</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="mid">14% – 15%</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="high">Above 15%</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </div>
          <DropdownMenuSeparator />
          <div className="p-1">
            <DropdownMenuLabel>Tenure</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={filters.tenor}
              onValueChange={(tenor) => onChange({ ...filters, tenor })}
            >
              <DropdownMenuRadioItem value="all">Any tenure</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="short">{TENOR_LABELS.short}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="medium">{TENOR_LABELS.medium}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="long">{TENOR_LABELS.long}</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
