"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useOrganization } from "@cashsouk/config";
import {
  EmptyState,
  ListToolbar,
  LoadingState,
  Pagination,
  getNoteDerivedStatusLabel,
  type FilterChip,
} from "@cashsouk/ui";
import { resolveNetExpectedReturnRatePercent, type NoteListItem } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { useInvestorInvestments } from "../hooks/use-marketplace-notes";
import { sortInvestorInvestments } from "../sort-investments";
import { calendarDaysFromToday, partitionInvestorInvestments } from "../investment-position-model";
import {
  DEFAULT_INVESTMENT_LIST_FILTERS,
  InvestmentFilterToolbar,
  investmentFilterChipLabels,
  type InvestmentListFilters,
} from "./investment-filter-toolbar";
import { InvestmentListSection } from "./investment-list-section";
import { InvestmentSlimCard } from "./investment-slim-card";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export function DashboardInvestmentsSection() {
  return <InvestorInvestmentsList limit={3} showViewAllButton />;
}

type InvestorInvestmentsListProps = {
  limit?: number;
  showViewAllButton?: boolean;
  showStatusFilter?: boolean;
};

function matchesInvestmentsSearch(note: NoteListItem, query: string): boolean {
  if (query.length === 0) return true;
  const haystacks = [
    note.noteReference,
    note.title,
    note.productName ?? "",
    note.issuerName ?? "",
    note.issuerIndustry ?? "",
    note.productCategory ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystacks.includes(query);
}

function noteMatchesFilters(
  note: NoteListItem,
  filters: InvestmentListFilters,
  search: string
): boolean {
  const matchesStatus =
    filters.status === "all" ||
    getNoteDerivedStatusLabel(note, { viewer: "investor" }) === filters.status;
  const matchesIndustry =
    filters.industry === "all" || (note.issuerIndustry?.trim() ?? "") === filters.industry;
  const matchesRisk = filters.risk === "all" || (note.riskRating ?? "") === filters.risk;
  const annualReturn = resolveNetExpectedReturnRatePercent(note);
  const matchesProfit =
    filters.profit === "all" ||
    (annualReturn !== null &&
      ((filters.profit === "low" && annualReturn < 14) ||
        (filters.profit === "mid" && annualReturn >= 14 && annualReturn <= 15) ||
        (filters.profit === "high" && annualReturn > 15)));
  const tenorDays = calendarDaysFromToday(note.maturityDate);
  const matchesTenor =
    filters.tenor === "all" ||
    (tenorDays !== null &&
      tenorDays >= 0 &&
      ((filters.tenor === "short" && tenorDays <= 30) ||
        (filters.tenor === "medium" && tenorDays > 30 && tenorDays <= 45) ||
        (filters.tenor === "long" && tenorDays > 45)));

  return (
    matchesStatus &&
    matchesInvestmentsSearch(note, search) &&
    matchesIndustry &&
    matchesRisk &&
    matchesProfit &&
    matchesTenor
  );
}

function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function InvestorInvestmentsList({
  limit,
  showViewAllButton = false,
  showStatusFilter = false,
}: InvestorInvestmentsListProps) {
  const { activeOrganization } = useOrganization();
  const { data, isLoading, error, refetch } = useInvestorInvestments(activeOrganization?.id);
  const notes = useMemo(() => data?.notes ?? [], [data?.notes]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<InvestmentListFilters>(DEFAULT_INVESTMENT_LIST_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const sortedNotes = useMemo(() => sortInvestorInvestments(notes, "most_relevant"), [notes]);
  const availableStatusLabels = useMemo(() => {
    const labels = new Set<string>();
    for (const item of sortedNotes) {
      labels.add(getNoteDerivedStatusLabel(item, { viewer: "investor" }));
    }
    return [...labels].sort((left, right) => left.localeCompare(right));
  }, [sortedNotes]);

  const statusFilter =
    filters.status === "all" || availableStatusLabels.includes(filters.status)
      ? filters.status
      : "all";
  const effectiveFilters = useMemo(
    () => ({ ...filters, status: statusFilter }),
    [filters, statusFilter]
  );

  const normalizedSearch = debouncedSearch.trim().toLowerCase();
  const { active, completed } = useMemo(
    () => partitionInvestorInvestments(sortedNotes),
    [sortedNotes]
  );
  const activeIds = useMemo(() => new Set(active.map((item) => item.id)), [active]);
  const completedIds = useMemo(() => new Set(completed.map((item) => item.id)), [completed]);

  const filteredNotes = useMemo(
    () => sortedNotes.filter((item) => noteMatchesFilters(item, effectiveFilters, normalizedSearch)),
    [effectiveFilters, normalizedSearch, sortedNotes]
  );
  const filteredActive = useMemo(
    () => filteredNotes.filter((item) => activeIds.has(item.id)),
    [activeIds, filteredNotes]
  );
  const filteredCompleted = useMemo(
    () => filteredNotes.filter((item) => completedIds.has(item.id)),
    [completedIds, filteredNotes]
  );

  const isDashboardPreview = typeof limit === "number";
  const previewNotes = isDashboardPreview ? sortedNotes.slice(0, limit) : [];
  const completedTotal = filteredCompleted.length;
  const maxCompletedPage = Math.max(1, Math.ceil(completedTotal / pageSize) || 1);
  const pagedCompleted = paginate(filteredCompleted, Math.min(page, maxCompletedPage), pageSize);

  const hasFilters =
    search.trim().length > 0 ||
    effectiveFilters.status !== "all" ||
    effectiveFilters.industry !== "all" ||
    effectiveFilters.risk !== "all" ||
    effectiveFilters.profit !== "all" ||
    effectiveFilters.tenor !== "all";

  const chipLabels = investmentFilterChipLabels(effectiveFilters);
  const appliedFilters = useMemo((): FilterChip[] => {
    const chips: FilterChip[] = [];
    if (chipLabels.status) {
      chips.push({
        id: "status",
        label: chipLabels.status,
        onRemove: () => setFilters((current) => ({ ...current, status: "all" })),
      });
    }
    if (chipLabels.industry) {
      chips.push({
        id: "industry",
        label: chipLabels.industry,
        onRemove: () => setFilters((current) => ({ ...current, industry: "all" })),
      });
    }
    if (chipLabels.risk) {
      chips.push({
        id: "risk",
        label: chipLabels.risk,
        onRemove: () => setFilters((current) => ({ ...current, risk: "all" })),
      });
    }
    if (chipLabels.profit) {
      chips.push({
        id: "profit",
        label: chipLabels.profit,
        onRemove: () => setFilters((current) => ({ ...current, profit: "all" })),
      });
    }
    if (chipLabels.tenor) {
      chips.push({
        id: "tenor",
        label: chipLabels.tenor,
        onRemove: () => setFilters((current) => ({ ...current, tenor: "all" })),
      });
    }
    return chips;
  }, [chipLabels]);

  function handleClearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setFilters(DEFAULT_INVESTMENT_LIST_FILTERS);
    setPage(1);
  }

  if (isDashboardPreview) {
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">Investments</h2>
          {showViewAllButton ? (
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link href="/investments">View all</Link>
            </Button>
          ) : null}
        </div>
        {isLoading ? <LoadingState variant="list" rows={3} /> : null}
        {error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load investments."}
          </div>
        ) : null}
        {!isLoading && !error && notes.length === 0 ? (
          <EmptyState
            title="No investments yet"
            message="Explore marketplace notes to start building your portfolio."
          />
        ) : null}
        {!isLoading && !error && previewNotes.length > 0 ? (
          <div className="space-y-3">
            {previewNotes.map((item) => (
              <InvestmentSlimCard key={item.id} note={item} />
            ))}
          </div>
        ) : null}
      </section>
    );
  }

  if (!showStatusFilter) {
    return null;
  }

  const filteredCount = filteredNotes.length;
  const countLabel = hasFilters
    ? `${filteredCount} of ${sortedNotes.length} investments`
    : `${filteredCount} ${filteredCount === 1 ? "investment" : "investments"}`;

  return (
    <div className="space-y-6">
      {isLoading ? <LoadingState variant="list" rows={4} /> : null}
      {error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load investments."}
        </div>
      ) : null}

      {!isLoading && !error && notes.length === 0 ? (
        <EmptyState
          title="No investments yet"
          message="You have not invested in any notes yet. Browse the marketplace to start building your portfolio."
          action={
            <Button asChild className="rounded-xl">
              <Link href="/marketplace">Browse marketplace</Link>
            </Button>
          }
        />
      ) : null}

      {!isLoading && !error && notes.length > 0 ? (
        <>
          <ListToolbar
            searchValue={search}
            onSearchChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            searchPlaceholder="Search by note, issuer, or industry"
            appliedFilters={appliedFilters}
            onClearFilters={handleClearFilters}
            onReload={() => {
              void refetch();
            }}
            isLoading={isLoading}
            countLabel={countLabel}
            filterGroups={
              <InvestmentFilterToolbar
                filters={effectiveFilters}
                statusLabels={availableStatusLabels}
                onChange={(next) => {
                  setFilters(next);
                  setPage(1);
                }}
              />
            }
          />

          {filteredCount === 0 && hasFilters ? (
            <EmptyState
              variant="no-results"
              title="No matching investments"
              message="Try a different search or clear your filters."
              action={
                <Button variant="outline" className="rounded-xl" onClick={handleClearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              <InvestmentListSection
                title={filteredCompleted.length > 0 ? "Active" : "Investments"}
                count={filteredActive.length}
                items={filteredActive.map((item) => ({
                  key: item.id,
                  node: <InvestmentSlimCard note={item} />,
                }))}
              />
              <InvestmentListSection
                title={filteredActive.length > 0 ? "Completed" : "Investments"}
                count={completedTotal}
                items={pagedCompleted.map((item) => ({
                  key: item.id,
                  node: <InvestmentSlimCard note={item} />,
                }))}
              />
              {completedTotal > 0 ? (
                <Pagination
                  page={Math.min(page, maxCompletedPage)}
                  pageSize={pageSize}
                  total={completedTotal}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                  pageSizeOptions={PAGE_SIZE_OPTIONS}
                  itemLabel="completed"
                />
              ) : null}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
