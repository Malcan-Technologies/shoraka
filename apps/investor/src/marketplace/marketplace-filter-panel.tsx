"use client";

import { useState } from "react";
import { ArrowPathIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import {
  MARKETPLACE_TENURE_FILTER_LABELS,
  MARC_SME_GRADES,
} from "@cashsouk/types";
import { ChoiceChips, Input, ListToolbarFilterTrigger, SegmentedControl } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import {
  MARKETPLACE_SORT_OPTIONS,
  type MarketplaceNoteFilters,
  type MarketplaceSortId,
  type MarketplaceViewMode,
} from "./marketplace-note-model";

const LISTING_CHIP_OPTIONS = [
  { value: "open", label: "Open for funding" },
  { value: "funded", label: "Funded" },
  { value: "failed", label: "Not funded" },
  { value: "all", label: "All listings" },
] as const;

const GRADE_CHIP_OPTIONS = [
  { value: "all", label: "Any" },
  ...MARC_SME_GRADES.map((grade) => ({ value: grade, label: grade })),
];

const TENURE_CHIP_OPTIONS = [
  { value: "all", label: "Any" },
  { value: "short", label: MARKETPLACE_TENURE_FILTER_LABELS.short },
  { value: "medium", label: MARKETPLACE_TENURE_FILTER_LABELS.medium },
  { value: "long", label: MARKETPLACE_TENURE_FILTER_LABELS.long },
] as const;

const PROFIT_CHIP_OPTIONS = [
  { value: "all", label: "Any" },
  { value: "low", label: "Below 14%" },
  { value: "mid", label: "14% – 15%" },
  { value: "high", label: "Above 15%" },
] as const;

const VIEW_OPTIONS = [
  { value: "table", label: "List" },
  { value: "cards", label: "Cards" },
] as const;

const SORT_OPTIONS = MARKETPLACE_SORT_OPTIONS.map((option) => ({
  value: option.id,
  label: option.label,
}));

export function MarketplaceFilterPanel({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  view,
  onViewChange,
  sectorOptions,
  countLabel,
  hasActiveFilters,
  onClearFilters,
  onReload,
  isLoading,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  filters: MarketplaceNoteFilters;
  onFiltersChange: (next: MarketplaceNoteFilters) => void;
  sort: MarketplaceSortId;
  onSortChange: (value: MarketplaceSortId) => void;
  view: MarketplaceViewMode;
  onViewChange: (value: MarketplaceViewMode) => void;
  sectorOptions: readonly string[];
  countLabel: string;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onReload: () => void;
  isLoading: boolean;
}) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const chipFilterCount =
    (filters.industry !== "all" ? 1 : 0) +
    (filters.risk !== "all" ? 1 : 0) +
    (filters.profit !== "all" ? 1 : 0) +
    (filters.tenor !== "all" ? 1 : 0) +
    (filters.listing !== "open" ? 1 : 0);
  const sectorChips = [
    { value: "all", label: "All sectors" },
    ...sectorOptions.map((sector) => ({ value: sector, label: sector })),
  ];

  function handleReload() {
    setIsSpinning(true);
    onReload();
    window.setTimeout(() => setIsSpinning(false), 500);
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className="flex flex-col gap-3">
        <div className="relative min-w-0">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by purpose, note, industry, or product"
            aria-label="Search marketplace notes"
            className="h-11 w-full min-w-0 rounded-xl bg-card pl-9"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <SegmentedControl
            ariaLabel="Sort marketplace notes"
            value={sort}
            options={SORT_OPTIONS}
            onChange={onSortChange}
          />
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              ariaLabel="Marketplace view"
              value={view}
              options={VIEW_OPTIONS}
              onChange={onViewChange}
            />
            <ListToolbarFilterTrigger
              label="Filters"
              count={chipFilterCount}
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((open) => !open)}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-11 w-11 rounded-xl"
              onClick={handleReload}
              disabled={isLoading || isSpinning}
              aria-label="Refresh"
            >
              <ArrowPathIcon className={`h-4 w-4 ${isLoading || isSpinning ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      {filtersOpen ? (
        <div className="space-y-3 border-t border-border pt-4">
          <ChoiceChips
            label="Listing"
            value={filters.listing}
            options={LISTING_CHIP_OPTIONS}
            onChange={(listing) => onFiltersChange({ ...filters, listing })}
          />
          <ChoiceChips
            label="Grade"
            value={filters.risk}
            options={GRADE_CHIP_OPTIONS}
            onChange={(risk) => onFiltersChange({ ...filters, risk })}
          />
          <ChoiceChips
            label="Tenure"
            value={filters.tenor}
            options={TENURE_CHIP_OPTIONS}
            onChange={(tenor) => onFiltersChange({ ...filters, tenor })}
          />
          <ChoiceChips
            label="Profit"
            value={filters.profit}
            options={PROFIT_CHIP_OPTIONS}
            onChange={(profit) => onFiltersChange({ ...filters, profit })}
          />
          <ChoiceChips
            label="Sector"
            value={filters.industry}
            options={sectorChips}
            onChange={(industry) => onFiltersChange({ ...filters, industry })}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-ui text-muted-foreground">{countLabel}</p>
        {hasActiveFilters ? (
          <Button type="button" variant="ghost" className="h-10 text-ui" onClick={onClearFilters}>
            Clear
          </Button>
        ) : null}
      </div>
    </section>
  );
}
