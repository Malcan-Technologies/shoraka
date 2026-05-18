"use client";

import * as React from "react";
import Link from "next/link";
import { FunnelIcon, XMarkIcon, ArrowPathIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import type { NoteListItem } from "@cashsouk/types";
import {
  useHeader,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  NoteStatusBadge,
  SoukscoreRiskRatingBadge,
  isNoteFullySettled,
} from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIssuerNotes } from "@/notes/hooks/use-issuer-notes";
import { issuerSettlementPayoutSummaryFromResidualStatus } from "@/notes/lib/settlement-payout-summary-presenter";
import { issuerMainContentClassName, issuerPageGutterClassName } from "@/lib/issuer-layout";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@cashsouk/ui/info-tooltip";
import { Input } from "@/components/ui/input";

const RISK_TOOLTIP_TEXT = "SoukScore grade for this invoice note";

const ISSUER_NOTES_FILTER_ALL = "ALL" as const;
const ISSUER_NOTES_FILTER_EXCLUDE_SETTLED = "EXCLUDE_SETTLED" as const;

const ISSUER_NOTES_SEARCH_PLACEHOLDER = "Search notes, reference, paymaster, or application";

function issuerNoteSearchHaystack(note: NoteListItem): string {
  return [
    note.id,
    note.noteReference,
    note.title,
    note.paymasterName ?? "",
    note.productName ?? "",
    note.productCategory ?? "",
    note.sourceApplicationId,
    note.sourceInvoiceId ?? "",
    note.sourceContractId ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

export default function IssuerNotesPage() {
  const { setTitle } = useHeader();
  const { data, isLoading, error, refetch } = useIssuerNotes();
  const [listFilter, setListFilter] = React.useState<string>(ISSUER_NOTES_FILTER_ALL);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [reloadSpin, setReloadSpin] = React.useState(false);

  React.useEffect(() => {
    setTitle("Notes");
  }, [setTitle]);

  const allNotes = data?.notes ?? [];
  const normalizedSearch = searchQuery.trim().toLowerCase();

  const notesAfterSettlementFilter = React.useMemo(() => {
    if (listFilter !== ISSUER_NOTES_FILTER_EXCLUDE_SETTLED) return allNotes;
    return allNotes.filter((n) => !isNoteFullySettled(n));
  }, [allNotes, listFilter]);

  const displayNotes = React.useMemo(() => {
    if (!normalizedSearch) return notesAfterSettlementFilter;
    return notesAfterSettlementFilter.filter((note) =>
      issuerNoteSearchHaystack(note).includes(normalizedSearch)
    );
  }, [notesAfterSettlementFilter, normalizedSearch]);

  const activeFilterCount = listFilter === ISSUER_NOTES_FILTER_EXCLUDE_SETTLED ? 1 : 0;
  const hasFilters =
    searchQuery !== "" || listFilter !== ISSUER_NOTES_FILTER_ALL;

  const handleReload = () => {
    setReloadSpin(true);
    void refetch().finally(() => {
      setTimeout(() => setReloadSpin(false), 500);
    });
  };

  const handleClearFilters = () => {
    setListFilter(ISSUER_NOTES_FILTER_ALL);
    setSearchQuery("");
  };

  return (
    <div className={issuerMainContentClassName}>
      <div className={cn("min-w-0 max-w-full space-y-6", issuerPageGutterClassName)}>
        <div>
          <h1 className="text-2xl font-semibold">Notes</h1>
          <p className="mt-1 text-muted-foreground">
            Track note funding, disbursement, repayment status, and payment instructions.
          </p>
        </div>
        {error && (
          <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load notes"}
          </div>
        )}
        {isLoading ? (
          <div className="text-muted-foreground">Loading notes...</div>
        ) : allNotes.length ? (
          <>
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={ISSUER_NOTES_SEARCH_PLACEHOLDER}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-3 sm:justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-11 gap-2 rounded-xl">
                      <FunnelIcon className="h-4 w-4" />
                      Filters
                      {activeFilterCount > 0 ? (
                        <Badge
                          variant="secondary"
                          className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary p-0 text-xs text-primary-foreground"
                        >
                          {activeFilterCount}
                        </Badge>
                      ) : null}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Status</DropdownMenuLabel>
                    <DropdownMenuCheckboxItem
                      checked={listFilter === ISSUER_NOTES_FILTER_ALL}
                      onCheckedChange={(checked) => {
                        if (checked) setListFilter(ISSUER_NOTES_FILTER_ALL);
                      }}
                    >
                      All notes
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={listFilter === ISSUER_NOTES_FILTER_EXCLUDE_SETTLED}
                      onCheckedChange={(checked) => {
                        if (checked) setListFilter(ISSUER_NOTES_FILTER_EXCLUDE_SETTLED);
                      }}
                    >
                      Active (exclude settled)
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {hasFilters ? (
                  <Button variant="ghost" onClick={handleClearFilters} className="h-11 gap-2 rounded-xl">
                    <XMarkIcon className="h-4 w-4" />
                    Clear
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  onClick={handleReload}
                  disabled={isLoading || reloadSpin}
                  className="h-11 gap-2 rounded-xl"
                >
                  <ArrowPathIcon
                    className={`h-4 w-4 ${isLoading || reloadSpin ? "animate-spin" : ""}`}
                  />
                  Reload
                </Button>
                <Badge
                  variant="secondary"
                  className="h-11 rounded-xl border-transparent bg-muted px-4 text-sm font-medium text-muted-foreground"
                >
                  {displayNotes.length} {displayNotes.length === 1 ? "note" : "notes"}
                  {hasFilters ? ` of ${allNotes.length}` : null}
                </Badge>
              </div>
            </div>
            {displayNotes.length ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {displayNotes.map((note) => (
              <Card key={note.id} className="flex h-full flex-col rounded-2xl">
                <CardHeader className="shrink-0">
                  <div className="flex min-h-[4.5rem] items-start justify-between gap-3">
                    <CardTitle className="line-clamp-2 flex-1 pr-1 text-lg leading-snug">
                      {note.title}
                    </CardTitle>
                    <NoteStatusBadge
                      note={note}
                      className="max-w-[48%] shrink-0 self-start text-xs font-semibold"
                    />
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col">
                  <div className="flex min-h-0 flex-1 flex-col gap-4 text-sm">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Target
                      </div>
                      <div className="mt-2 text-left text-xl font-semibold leading-tight tracking-tight tabular-nums text-foreground">
                        {formatCurrency(note.targetAmount)}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Funded
                      </div>
                      <div className="mt-2 text-left text-xl font-semibold leading-none tabular-nums text-foreground">
                        {note.fundingPercent.toFixed(1)}%
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <span>Risk rating</span>
                        <InfoTooltip content={RISK_TOOLTIP_TEXT} iconClassName="h-3.5 w-3.5 shrink-0" />
                      </div>
                      <div className="mt-2 rounded-2xl border bg-muted/20 p-3">
                        <SoukscoreRiskRatingBadge
                          riskRating={note.riskRating}
                          className={cn(
                            "flex w-full items-center justify-center rounded-xl px-2 py-2",
                            "text-4xl font-semibold leading-none tracking-tight"
                          )}
                        />
                      </div>
                    </div>
                  </div>
                  {note.settlementSummary ? (
                    (() => {
                      const preset = note.issuerResidualPayout
                        ? issuerSettlementPayoutSummaryFromResidualStatus(note.issuerResidualPayout)
                        : {
                            tone: "emerald" as const,
                            blurb: "Posted settlement allocation across the platform buckets.",
                          };
                      const isAmber = preset.tone === "amber";
                      const labelMuted = isAmber
                        ? "text-amber-800 dark:text-amber-200/90"
                        : "text-emerald-800 dark:text-emerald-200/90";
                      return (
                        <div
                          className={cn(
                            "rounded-xl border p-3",
                            isAmber
                              ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/35 dark:text-amber-100"
                              : "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800/60 dark:bg-emerald-950/35 dark:text-emerald-100"
                          )}
                        >
                          <p className="text-xs leading-relaxed opacity-90">{preset.blurb}</p>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <div className={labelMuted}>Repayment Pool</div>
                              <div className="font-semibold">
                                {formatCurrency(note.settlementSummary.grossReceiptAmount)}
                              </div>
                            </div>
                            <div>
                              <div className={labelMuted}>Investor Pool</div>
                              <div className="font-semibold">
                                {formatCurrency(note.settlementSummary.investorPoolAmount)}
                              </div>
                            </div>
                            <div>
                              <div className={labelMuted}>Operating</div>
                              <div className="font-semibold">
                                {formatCurrency(note.settlementSummary.operatingAccountAmount)}
                              </div>
                            </div>
                            <div>
                              <div className={labelMuted}>{"Ta'widh"}</div>
                              <div className="font-semibold">
                                {formatCurrency(note.settlementSummary.tawidhAccountAmount)}
                              </div>
                            </div>
                            <div>
                              <div className={labelMuted}>Gharamah</div>
                              <div className="font-semibold">
                                {formatCurrency(note.settlementSummary.gharamahAccountAmount)}
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 text-xs font-medium">
                            Issuer residual: {formatCurrency(note.settlementSummary.issuerResidualAmount)}
                          </div>
                        </div>
                      );
                    })()
                  ) : null}
                  </div>
                </CardContent>
                <CardFooter className="mt-auto flex w-full flex-col items-stretch">
                  <Button asChild className="w-full">
                    <Link href={`/notes/${note.id}`}>View Note</Link>
                  </Button>
                </CardFooter>
              </Card>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
                <p>No notes match your filters.</p>
                <Button variant="link" className="mt-2" onClick={handleClearFilters}>
                  Clear filters
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
            No notes are available yet.
          </div>
        )}
      </div>
    </div>
  );
}

