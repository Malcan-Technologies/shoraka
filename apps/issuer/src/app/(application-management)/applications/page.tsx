"use client";

/** Slim applications list — detail lives at /applications/[id]. */

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ConfirmDialog,
  EmptyState,
  ListToolbar,
  ListToolbarFilterTrigger,
  LoadingState,
  PageShell,
  Pagination,
  type FilterChip,
} from "@cashsouk/ui";
import {
  createApiClient,
  useOrganization,
  useAuthToken,
} from "@cashsouk/config";
import { filterVisiblePeopleRows } from "@cashsouk/types";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ApplyForFinancingButton } from "@/components/apply-for-financing-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { issuerMainContentClassName, issuerPageGutterClassName } from "@/lib/issuer-layout";
import {
  STATUS,
  FILTER_STATUSES,
  FINANCING_TYPES,
  isIssuerApplicationActionable,
} from "./status";
import {
  applicationMatchesListSearch,
  ISSUER_APPLICATIONS_SEARCH_PLACEHOLDER,
} from "./application-list-search";
import { useApplicationsData } from "./use-applications-data";
import { ApplicationSlimCard } from "./components/application-slim-card";
import { ApplicationAttentionCarousel } from "./components/application-attention-carousel";
import { useCancelApplication, useDeleteDraftApplication } from "@/hooks/use-applications";
import { generateMockApplications } from "@/dev/mockApplications";
import { areDirectorShareholdersReadyForApplicationSubmit } from "@/lib/director-shareholder-onboarding-ui";
import { DirectorShareholderAlertCard } from "@/components/director-shareholder-alert-card";
import type { NormalizedApplication } from "./status";

const MOCK_APPLICATION_COUNT = 10;
const PER_PAGE_OPTIONS = [10, 25, 50];

export default function ApplicationsPage() {
  const [debugShowSkeleton, setDebugShowSkeleton] = React.useState(false);
  const [debugMockApplications, setDebugMockApplications] = React.useState<
    NormalizedApplication[] | null
  >(null);

  const { applications, isLoading } = useApplicationsData({
    debugShowSkeleton,
    debugMockApplications,
  });

  const cancelApplication = useCancelApplication();
  const deleteDraftApplication = useDeleteDraftApplication();

  const [deleteDraftDialogOpen, setDeleteDraftDialogOpen] = React.useState(false);
  const [deleteDraftApplicationId, setDeleteDraftApplicationId] = React.useState<string | null>(
    null
  );
  const [withdrawApplicationDialogOpen, setWithdrawApplicationDialogOpen] = React.useState(false);
  const [withdrawApplicationId, setWithdrawApplicationId] = React.useState<string | null>(null);
  const withdrawDialogScheduledRef = React.useRef(false);

  const [search, setSearch] = React.useState("");
  const [statusFilters, setStatusFilters] = React.useState<string[]>([]);
  const [financingFilter, setFinancingFilter] = React.useState("all");
  const [submittedFilter, setSubmittedFilter] = React.useState("all");
  const [offerExpiryFilter, setOfferExpiryFilter] = React.useState("all");
  const [applicationIdsFilter, setApplicationIdsFilter] = React.useState<string[]>([]);
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(10);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("applicationIds");
    if (!raw) return;
    const ids = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setApplicationIdsFilter(ids);
  }, []);

  const handleWithdrawApplicationClick = React.useCallback((applicationId: string) => {
    if (withdrawDialogScheduledRef.current) return;
    withdrawDialogScheduledRef.current = true;
    setTimeout(() => {
      setWithdrawApplicationId(applicationId);
      setWithdrawApplicationDialogOpen(true);
      withdrawDialogScheduledRef.current = false;
    }, 150);
  }, []);

  const handleWithdrawApplicationConfirm = React.useCallback(async () => {
    const id = withdrawApplicationId;
    if (!id || cancelApplication.isPending) return;
    setWithdrawApplicationId(null);
    try {
      await cancelApplication.mutateAsync(id);
      toast.success("Application withdrawn");
      setWithdrawApplicationDialogOpen(false);
    } catch {
      setWithdrawApplicationId(id);
    }
  }, [withdrawApplicationId, cancelApplication]);

  const handleDeleteDraftClick = React.useCallback((applicationId: string) => {
    queueMicrotask(() => {
      setDeleteDraftApplicationId(applicationId);
      setDeleteDraftDialogOpen(true);
    });
  }, []);

  const handleDeleteDraftConfirm = React.useCallback(async () => {
    if (!deleteDraftApplicationId) return;
    try {
      await deleteDraftApplication.mutateAsync(deleteDraftApplicationId);
      toast.success("Draft application deleted");
      setDeleteDraftDialogOpen(false);
      setDeleteDraftApplicationId(null);
    } catch {
      // toast handled by mutation onError
    }
  }, [deleteDraftApplicationId, deleteDraftApplication]);

  const needsAttention = React.useMemo(
    () => applications.filter((a) => isIssuerApplicationActionable(a)),
    [applications]
  );
  const needsAttentionIds = React.useMemo(
    () => new Set(needsAttention.map((a) => a.id)),
    [needsAttention]
  );

  const filteredApplications = React.useMemo(() => {
    let list = [...applications];
    if (search.trim()) {
      list = list.filter((a) => applicationMatchesListSearch(a, search));
    }
    if (applicationIdsFilter.length > 0) {
      const idSet = new Set(applicationIdsFilter);
      list = list.filter((a) => idSet.has(a.id));
    }
    if (statusFilters.length > 0) {
      list = list.filter((a) => statusFilters.includes(a.status));
    }
    if (financingFilter !== "all") {
      const match =
        financingFilter === "contract" ? "Facility financing" : "Invoice financing";
      list = list.filter((a) => a.type === match);
    }
    if (submittedFilter !== "all") {
      const now = new Date();
      const cutoff = new Date(now);
      if (submittedFilter === "7d") cutoff.setDate(now.getDate() - 7);
      else if (submittedFilter === "30d") cutoff.setDate(now.getDate() - 30);
      else if (submittedFilter === "90d") cutoff.setDate(now.getDate() - 90);
      const cutoffTime = cutoff.getTime();
      list = list.filter((a) => {
        if (!a.submittedAt) return false;
        return new Date(a.submittedAt).getTime() >= cutoffTime;
      });
    }
    if (offerExpiryFilter !== "all") {
      const now = new Date();
      const days = offerExpiryFilter === "3d" ? 3 : offerExpiryFilter === "7d" ? 7 : 14;
      const cutoff = new Date(now);
      cutoff.setDate(now.getDate() + days);
      const nowTime = now.getTime();
      const cutoffTime = cutoff.getTime();
      list = list.filter((a) => {
        const iso = a.offerPhaseDeadline?.iso ?? a.expiresAt;
        if (!iso || a.offerPhaseDeadline?.isPast) return false;
        const exp = new Date(iso).getTime();
        return exp > nowTime && exp <= cutoffTime;
      });
    }
    return list;
  }, [
    applications,
    search,
    statusFilters,
    financingFilter,
    submittedFilter,
    offerExpiryFilter,
    applicationIdsFilter,
  ]);

  const remainingApplications = React.useMemo(
    () => filteredApplications.filter((a) => !needsAttentionIds.has(a.id)),
    [filteredApplications, needsAttentionIds]
  );
  const unfilteredRemainingCount = applications.length - needsAttention.length;

  const restTotal = remainingApplications.length;
  const maxRestPage = Math.max(1, Math.ceil(restTotal / perPage) || 1);

  React.useEffect(() => {
    if (page > maxRestPage) setPage(maxRestPage);
  }, [page, maxRestPage]);

  const paginatedRest = remainingApplications.slice((page - 1) * perPage, page * perPage);

  const totalCount = applications.length;
  const searchQuery = search.trim();
  const hasNonSearchFilters =
    applicationIdsFilter.length > 0 ||
    statusFilters.length > 0 ||
    financingFilter !== "all" ||
    submittedFilter !== "all" ||
    offerExpiryFilter !== "all";
  const hasFilters = searchQuery !== "" || hasNonSearchFilters;

  const clearApplicationIdsFilter = React.useCallback(() => {
    setApplicationIdsFilter([]);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.delete("applicationIds");
      const qs = params.toString();
      window.history.replaceState(
        {},
        "",
        qs ? `${window.location.pathname}?${qs}` : window.location.pathname
      );
    }
    setPage(1);
  }, []);

  const clearAllFilters = React.useCallback(() => {
    setSearch("");
    setStatusFilters([]);
    setFinancingFilter("all");
    setSubmittedFilter("all");
    setOfferExpiryFilter("all");
    clearApplicationIdsFilter();
    setPage(1);
  }, [clearApplicationIdsFilter]);

  const appliedFilters = React.useMemo(() => {
    const chips: FilterChip[] = [];
    if (searchQuery) {
      chips.push({
        id: "search",
        label: `Search: ${searchQuery}`,
        onRemove: () => {
          setSearch("");
          setPage(1);
        },
      });
    }
    for (const key of statusFilters) {
      chips.push({
        id: `status-${key}`,
        label: `Status: ${STATUS[key]?.label ?? key}`,
        onRemove: () => {
          setStatusFilters((prev) => prev.filter((s) => s !== key));
          setPage(1);
        },
      });
    }
    if (financingFilter !== "all") {
      const label =
        FINANCING_TYPES.find((f) => f.value === financingFilter)?.label ?? financingFilter;
      chips.push({
        id: "financing",
        label: `Financing: ${label}`,
        onRemove: () => {
          setFinancingFilter("all");
          setPage(1);
        },
      });
    }
    if (submittedFilter !== "all") {
      const labels: Record<string, string> = {
        "7d": "Last 7 days",
        "30d": "Last 30 days",
        "90d": "Last 90 days",
      };
      chips.push({
        id: "submitted",
        label: `Submitted: ${labels[submittedFilter] ?? submittedFilter}`,
        onRemove: () => {
          setSubmittedFilter("all");
          setPage(1);
        },
      });
    }
    if (offerExpiryFilter !== "all") {
      chips.push({
        id: "expiry",
        label: `Offer expiring: ${offerExpiryFilter}`,
        onRemove: () => {
          setOfferExpiryFilter("all");
          setPage(1);
        },
      });
    }
    if (applicationIdsFilter.length > 0) {
      chips.push({
        id: "applicationIds",
        label:
          applicationIdsFilter.length === 1
            ? "1 application from link"
            : `${applicationIdsFilter.length} applications from link`,
        onRemove: clearApplicationIdsFilter,
      });
    }
    return chips;
  }, [
    searchQuery,
    statusFilters,
    financingFilter,
    submittedFilter,
    offerExpiryFilter,
    applicationIdsFilter,
    clearApplicationIdsFilter,
  ]);

  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = React.useMemo(
    () => createApiClient(undefined, getAccessToken),
    [getAccessToken]
  );

  const handleDocumentDownload = React.useCallback(
    async (s3Key: string) => {
      try {
        const resp = await apiClient.getS3DownloadUrl(s3Key);
        if (!resp.success || !resp.data?.downloadUrl) {
          toast.error("Could not get download link");
          return;
        }
        window.open(resp.data.downloadUrl, "_blank");
      } catch {
        toast.error("Could not get download link");
      }
    },
    [apiClient]
  );

  const isDev = process.env.NODE_ENV === "development";
  const { activeOrganization } = useOrganization();

  const visiblePeopleForDsGating = React.useMemo(
    () => filterVisiblePeopleRows(activeOrganization?.people ?? []),
    [activeOrganization?.people]
  );
  const dsOnboardingPending =
    activeOrganization?.type === "COMPANY" &&
    visiblePeopleForDsGating.length > 0 &&
    !areDirectorShareholdersReadyForApplicationSubmit({ people: visiblePeopleForDsGating });

  const countLabel = hasFilters
    ? `${restTotal} of ${unfilteredRemainingCount} applications`
    : `${restTotal} ${restTotal === 1 ? "application" : "applications"}`;

  return (
    <div className={issuerMainContentClassName}>
      <div className={cn("min-w-0 max-w-full", issuerPageGutterClassName)}>
        {activeOrganization?.type === "COMPANY" && dsOnboardingPending ? (
          <DirectorShareholderAlertCard
            visiblePeople={visiblePeopleForDsGating}
            enabled={activeOrganization.onboardingStatus === "COMPLETED"}
            stickyTop
            className="mb-4"
          />
        ) : null}

        {isDev ? (
          <Card
            className="fixed bottom-5 right-5 z-[9999] w-[200px] rounded-2xl border-2 border-status-action-text/40 shadow-lg"
            data-testid="applications-debug-panel"
          >
            <CardHeader className="px-3 py-2">
              <h3 className="text-sm font-semibold">Debug Panel</h3>
            </CardHeader>
            <Separator />
            <CardContent className="space-y-1 px-3 py-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  setDebugShowSkeleton((prev) => !prev);
                  if (!debugShowSkeleton) setDebugMockApplications(null);
                }}
              >
                {debugShowSkeleton ? "Hide Skeleton" : "Debug Skeleton"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  setDebugMockApplications(generateMockApplications(MOCK_APPLICATION_COUNT));
                  setDebugShowSkeleton(false);
                }}
              >
                Debug Mock Cards
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  setDebugShowSkeleton(false);
                  setDebugMockApplications(null);
                }}
              >
                Reset Debug
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <PageShell
          title="Applications"
          description="Track financing applications, respond to offers, and finish drafts."
          action={
            <ApplyForFinancingButton className="h-11 shrink-0 gap-2 rounded-xl bg-primary font-semibold text-primary-foreground shadow-brand hover:opacity-95" />
          }
        >
          <div className="space-y-6">
            {isLoading ? (
              <LoadingState variant="cards" />
            ) : totalCount === 0 ? (
              <EmptyState
                variant="no-data"
                title="No applications yet"
                message="Start a financing application when you are ready."
                action={<ApplyForFinancingButton showIcon={false} className="rounded-xl" />}
              />
            ) : (
              <>
                {needsAttention.length > 0 ? (
                  <section className="space-y-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="text-base font-semibold text-foreground">
                        Needs your attention
                      </h2>
                      <span className="text-ui text-muted-foreground">
                        {needsAttention.length} to review
                      </span>
                    </div>
                    <ApplicationAttentionCarousel
                      applications={needsAttention}
                      onViewSignedContractOffer={handleDocumentDownload}
                      onCancelApplication={handleWithdrawApplicationClick}
                      onDeleteDraft={handleDeleteDraftClick}
                      isCancelApplicationPending={cancelApplication.isPending}
                    />
                  </section>
                ) : null}

            <ListToolbar
              searchValue={search}
              onSearchChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              searchPlaceholder={ISSUER_APPLICATIONS_SEARCH_PLACEHOLDER}
              appliedFilters={appliedFilters}
              onClearFilters={clearAllFilters}
              onReload={() => {
                void queryClient.invalidateQueries({ queryKey: ["applications"] });
              }}
              isLoading={isLoading}
              countLabel={countLabel}
              filterGroups={
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <ListToolbarFilterTrigger
                        label="Status"
                        count={statusFilters.length}
                      />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 p-1">
                      <DropdownMenuLabel>Status</DropdownMenuLabel>
                      <DropdownMenuItem
                        className="relative cursor-pointer pl-8"
                        onClick={() => {
                          setStatusFilters([]);
                          setPage(1);
                        }}
                      >
                        {statusFilters.length === 0 ? (
                          <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                            <span className="h-2 w-2 rounded-full bg-foreground" />
                          </span>
                        ) : null}
                        All statuses
                      </DropdownMenuItem>
                      {FILTER_STATUSES.map((key) => (
                        <DropdownMenuItem
                          key={`status-${key}`}
                          className="relative cursor-pointer pl-8"
                          onClick={() => {
                            setStatusFilters((prev) =>
                              prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
                            );
                            setPage(1);
                          }}
                        >
                          {statusFilters.includes(key) ? (
                            <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                              <span className="h-2 w-2 rounded-full bg-foreground" />
                            </span>
                          ) : null}
                          {STATUS[key]?.label ?? key}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <ListToolbarFilterTrigger
                        label="Filters"
                        count={
                          [
                            submittedFilter !== "all",
                            financingFilter !== "all",
                            offerExpiryFilter !== "all",
                          ].filter(Boolean).length
                        }
                      />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 p-0">
                      <div className="p-1">
                        <DropdownMenuLabel>Financing structure</DropdownMenuLabel>
                        {[
                          { value: "all", label: "All" },
                          ...FINANCING_TYPES.map(({ value, label }) => ({ value, label })),
                        ].map((opt) => (
                          <DropdownMenuItem
                            key={`fin-${opt.value}`}
                            className="relative pl-8"
                            onClick={() => {
                              setFinancingFilter(opt.value);
                              setPage(1);
                            }}
                          >
                            {financingFilter === opt.value ? (
                              <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                                <span className="h-2 w-2 rounded-full bg-foreground" />
                              </span>
                            ) : null}
                            {opt.label}
                          </DropdownMenuItem>
                        ))}
                      </div>
                      <DropdownMenuSeparator />
                      <div className="p-1">
                        <DropdownMenuLabel>Submitted in</DropdownMenuLabel>
                        {[
                          { value: "all", label: "All time" },
                          { value: "7d", label: "Last 7 days" },
                          { value: "30d", label: "Last 30 days" },
                          { value: "90d", label: "Last 90 days" },
                        ].map((opt) => (
                          <DropdownMenuItem
                            key={`sub-${opt.value}`}
                            className="relative pl-8"
                            onClick={() => {
                              setSubmittedFilter(opt.value);
                              setPage(1);
                            }}
                          >
                            {submittedFilter === opt.value ? (
                              <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                                <span className="h-2 w-2 rounded-full bg-foreground" />
                              </span>
                            ) : null}
                            {opt.label}
                          </DropdownMenuItem>
                        ))}
                      </div>
                      <DropdownMenuSeparator />
                      <div className="p-1">
                        <DropdownMenuLabel>Offer expiring</DropdownMenuLabel>
                        {[
                          { value: "all", label: "All" },
                          { value: "3d", label: "3 days" },
                          { value: "7d", label: "7 days" },
                          { value: "14d", label: "14 days" },
                        ].map((opt) => (
                          <DropdownMenuItem
                            key={`expiry-${opt.value}`}
                            className="relative pl-8"
                            onClick={() => {
                              setOfferExpiryFilter(opt.value);
                              setPage(1);
                            }}
                          >
                            {offerExpiryFilter === opt.value ? (
                              <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                                <span className="h-2 w-2 rounded-full bg-foreground" />
                              </span>
                            ) : null}
                            {opt.label}
                          </DropdownMenuItem>
                        ))}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              }
            />

            {restTotal === 0 && hasFilters ? (
              <EmptyState
                variant="no-results"
                title="No matching applications"
                message={
                  searchQuery
                    ? `No applications match “${searchQuery}”. Try a reference, customer name, or invoice number.`
                    : "Try a different search or clear your filters."
                }
                action={
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      if (searchQuery && !hasNonSearchFilters) {
                        setSearch("");
                        setPage(1);
                        return;
                      }
                      clearAllFilters();
                    }}
                  >
                    {searchQuery && !hasNonSearchFilters ? "Clear search" : "Clear filters"}
                  </Button>
                }
              />
            ) : (
              <div className="space-y-8">
                {paginatedRest.length > 0 ? (
                  <section className="space-y-3">
                    <h2 className="text-base font-semibold text-foreground">
                      {needsAttention.length > 0 ? "All applications" : "Applications"}
                    </h2>
                    <div className="space-y-3">
                      {paginatedRest.map((app) => (
                        <ApplicationSlimCard
                          key={app.id}
                          application={app}
                          onViewSignedContractOffer={handleDocumentDownload}
                          onCancelApplication={handleWithdrawApplicationClick}
                          onDeleteDraft={handleDeleteDraftClick}
                          isCancelApplicationPending={cancelApplication.isPending}
                        />
                      ))}
                    </div>
                  </section>
                ) : null}

                {restTotal > 0 ? (
                  <Pagination
                    page={page}
                    pageSize={perPage}
                    total={restTotal}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => {
                      setPerPage(size);
                      setPage(1);
                    }}
                    pageSizeOptions={PER_PAGE_OPTIONS}
                    itemLabel="applications"
                  />
                ) : null}
              </div>
            )}
              </>
            )}
          </div>

          <ConfirmDialog
            open={deleteDraftDialogOpen}
            onOpenChange={(open) => {
              setDeleteDraftDialogOpen(open);
              if (!open) setDeleteDraftApplicationId(null);
            }}
            title="Delete draft?"
            description="Are you sure you want to delete this draft? This cannot be undone."
            confirmText="Delete"
            variant="destructive"
            onConfirm={handleDeleteDraftConfirm}
            isLoading={deleteDraftApplication.isPending}
          />

          <ConfirmDialog
            open={withdrawApplicationDialogOpen}
            onOpenChange={(open) => {
              setWithdrawApplicationDialogOpen(open);
              if (!open) {
                setWithdrawApplicationId(null);
                withdrawDialogScheduledRef.current = false;
              }
            }}
            title="Withdraw application?"
            description="Are you sure you want to withdraw this application? This action cannot be undone."
            confirmText="Withdraw"
            variant="destructive"
            onConfirm={handleWithdrawApplicationConfirm}
            isLoading={cancelApplication.isPending}
          />
        </PageShell>
      </div>
    </div>
  );
}
