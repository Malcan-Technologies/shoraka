"use client";

import { StatusBadge } from "@cashsouk/ui";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import type { CurlecGatewayAccount, GatewayPaymentPurpose } from "@cashsouk/types";
import { formatCurrency } from "@cashsouk/config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RequirePermission } from "@/components/require-permission";
import { AdminPageHeader } from "@/components/admin-page-header";
import { useGatewayPayments } from "@/hooks/use-gateway-payments";
import {
  GATEWAY_ACCOUNT_OPTIONS,
  getGatewayAccountBadgeClassName,
  getGatewayAccountLabel,
} from "@/lib/gateway-account";
import {
  PURPOSE_LABEL,
  STATUS_LABEL,
  formatDate,
  formatGatewayPaymentDate,
  statusToken,
  statusVariant,
} from "@/lib/gateway-payment-display";
import { TablePagination } from "@/shared/admin-list/components/table-pagination";
import { adminActionRowClass } from "@/lib/admin-status-token";

const PAGE_SIZE = 20;

/** API `filter` values — labels match detail page wording. */
const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "completed", label: "Completed" },
  { value: "review", label: "Name check pending" },
  { value: "refunding", label: "Refund pending" },
  { value: "refunded", label: "Refunded" },
  { value: "needs_attention", label: "Needs attention" },
] as const;

const PURPOSE_FILTER_OPTIONS = [
  { value: "all", label: "All purposes" },
  { value: "INVESTOR_DEPOSIT", label: PURPOSE_LABEL.INVESTOR_DEPOSIT },
  { value: "ISSUER_ONBOARDING_FEE", label: PURPOSE_LABEL.ISSUER_ONBOARDING_FEE },
  {
    value: "APPLICATION_PROCESSING_FEE",
    label: PURPOSE_LABEL.APPLICATION_PROCESSING_FEE,
  },
] as const;

type GatewayFilter = (typeof STATUS_FILTER_OPTIONS)[number]["value"];
type GatewayAccountFilter = CurlecGatewayAccount | "ALL";
type PurposeFilter = GatewayPaymentPurpose | "all";

function isGatewayFilter(value: string | null): value is GatewayFilter {
  return STATUS_FILTER_OPTIONS.some((option) => option.value === value);
}

function isGatewayAccountFilter(value: string | null): value is GatewayAccountFilter {
  if (value === "ALL") return true;
  return GATEWAY_ACCOUNT_OPTIONS.some((option) => option.value === value);
}

function isPurposeFilter(value: string | null): value is PurposeFilter {
  return PURPOSE_FILTER_OPTIONS.some((option) => option.value === value);
}

function organizationName(item: {
  investorOrganizationName: string | null;
  issuerOrganizationName: string | null;
}) {
  return item.investorOrganizationName ?? item.issuerOrganizationName ?? "—";
}

function truncateRef(value: string, max = 16) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

async function copyReference(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}`);
  }
}

function ReferenceLine({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span className="w-14 shrink-0">{label}</span>
        <span>—</span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1 text-xs">
      <span className="w-14 shrink-0 text-muted-foreground">{label}</span>
      <span className="truncate font-mono" title={value}>
        {truncateRef(value)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
        title={`Copy ${label}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void copyReference(label, value);
        }}
      >
        <ClipboardDocumentIcon className="h-3.5 w-3.5" />
        <span className="sr-only">Copy {label}</span>
      </Button>
    </div>
  );
}

type GatewayPaymentsTableProps = {
  title: string;
  description: string;
  initialFilter?: GatewayFilter;
};

function GatewayPaymentsTableContent({
  title,
  description,
  initialFilter = "all",
}: GatewayPaymentsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filterFromUrl = searchParams.get("filter");
  const accountFromUrl = searchParams.get("account");
  const purposeFromUrl = searchParams.get("purpose");
  const qFromUrl = searchParams.get("q") ?? "";

  const [filter, setFilter] = useState<GatewayFilter>(
    isGatewayFilter(filterFromUrl) ? filterFromUrl : initialFilter
  );
  const [gatewayAccount, setGatewayAccount] = useState<GatewayAccountFilter>(
    isGatewayAccountFilter(accountFromUrl) ? accountFromUrl : "ALL"
  );
  const [purpose, setPurpose] = useState<PurposeFilter>(
    isPurposeFilter(purposeFromUrl) ? purposeFromUrl : "all"
  );
  const [searchInput, setSearchInput] = useState(qFromUrl);
  const [debouncedSearch, setDebouncedSearch] = useState(qFromUrl.trim());
  const [currentPage, setCurrentPage] = useState(1);
  const [isSpinning, setIsSpinning] = useState(false);

  // Restore list state when URL changes (shared links / browser back-forward).
  useEffect(() => {
    const nextFilter = isGatewayFilter(filterFromUrl) ? filterFromUrl : "all";
    const nextAccount = isGatewayAccountFilter(accountFromUrl) ? accountFromUrl : "ALL";
    const nextPurpose = isPurposeFilter(purposeFromUrl) ? purposeFromUrl : "all";
    const nextQ = qFromUrl;

    setFilter((prev) => (prev === nextFilter ? prev : nextFilter));
    setGatewayAccount((prev) => (prev === nextAccount ? prev : nextAccount));
    setPurpose((prev) => (prev === nextPurpose ? prev : nextPurpose));
    setSearchInput((prev) => (prev === nextQ ? prev : nextQ));
    setDebouncedSearch((prev) => {
      const trimmed = nextQ.trim();
      return prev === trimmed ? prev : trimmed;
    });
  }, [accountFromUrl, filterFromUrl, purposeFromUrl, qFromUrl]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("filter", filter);
    if (gatewayAccount !== "ALL") params.set("account", gatewayAccount);
    if (purpose !== "all") params.set("purpose", purpose);
    if (debouncedSearch) params.set("q", debouncedSearch);
    const qs = params.toString();
    const next = qs ? `${pathname}?${qs}` : pathname;
    const current = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    if (next !== current) {
      router.replace(next, { scroll: false });
    }
  }, [
    debouncedSearch,
    filter,
    gatewayAccount,
    pathname,
    purpose,
    router,
    searchParams,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filter, gatewayAccount, purpose]);

  const { data, isLoading, error, refetch, isFetching } = useGatewayPayments({
    page: currentPage,
    pageSize: PAGE_SIZE,
    gatewayAccount: gatewayAccount === "ALL" ? undefined : gatewayAccount,
    filter: filter === "all" ? undefined : filter,
    purpose: purpose === "all" ? undefined : purpose,
    search: debouncedSearch || undefined,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startIndex = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(currentPage * PAGE_SIZE, total);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const activeFilterCount = [
    filter !== "all",
    gatewayAccount !== "ALL",
    purpose !== "all",
  ].filter(Boolean).length;

  const hasActiveFilters =
    activeFilterCount > 0 || Boolean(debouncedSearch) || Boolean(searchInput.trim());

  const clearFilters = useCallback(() => {
    setFilter("all");
    setGatewayAccount("ALL");
    setPurpose("all");
    setSearchInput("");
    setDebouncedSearch("");
    setCurrentPage(1);
  }, []);

  const handleRefresh = () => {
    setIsSpinning(true);
    void refetch().finally(() => {
      window.setTimeout(() => setIsSpinning(false), 400);
    });
  };

  const emptyCopy = useMemo(() => {
    if (hasActiveFilters) {
      return {
        title: "No payments found",
        detail: "Try changing your search or filters.",
      };
    }
    return {
      title: "No gateway payments yet",
      detail: "Payments will appear here once Curlec money-in activity starts.",
    };
  }, [hasActiveFilters]);

  return (
    <RequirePermission permission="gateway_payments.view">
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="w-full space-y-6 px-2 py-8 md:px-4">
          <section className="space-y-4">
            <AdminPageHeader title={title} description={description} />

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[12rem] flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search by reference, organisation, purpose, or amount…"
                  className="h-11 rounded-xl bg-card pl-9"
                  aria-label="Search gateway payments"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-11 gap-2 rounded-xl bg-card">
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
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel>Status</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={filter}
                    onValueChange={(value) => {
                      if (isGatewayFilter(value)) setFilter(value);
                    }}
                  >
                    {STATUS_FILTER_OPTIONS.map((option) => (
                      <DropdownMenuRadioItem key={option.value} value={option.value}>
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>

                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Gateway account</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={gatewayAccount}
                    onValueChange={(value) => {
                      if (isGatewayAccountFilter(value)) setGatewayAccount(value);
                    }}
                  >
                    <DropdownMenuRadioItem value="ALL">All accounts</DropdownMenuRadioItem>
                    {GATEWAY_ACCOUNT_OPTIONS.map((option) => (
                      <DropdownMenuRadioItem key={option.value} value={option.value}>
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>

                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Purpose</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={purpose}
                    onValueChange={(value) => {
                      if (isPurposeFilter(value)) setPurpose(value);
                    }}
                  >
                    {PURPOSE_FILTER_OPTIONS.map((option) => (
                      <DropdownMenuRadioItem key={option.value} value={option.value}>
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              {hasActiveFilters ? (
                <Button
                  variant="ghost"
                  onClick={clearFilters}
                  className="h-11 gap-2 rounded-xl"
                >
                  <XMarkIcon className="h-4 w-4" />
                  Clear
                </Button>
              ) : null}

              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={isFetching || isSpinning}
                className="h-11 gap-2 rounded-xl bg-card"
              >
                <ArrowPathIcon
                  className={`h-4 w-4 ${isFetching || isSpinning ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>

              <Badge variant="secondary" className="h-11 rounded-xl px-4 text-sm">
                {isLoading
                  ? "Loading…"
                  : `${total} ${total === 1 ? "payment" : "payments"}`}
              </Badge>
            </div>

            {error ? (
              <div className="py-8 text-center text-destructive">
                Failed to load gateway payments.{" "}
                <button
                  type="button"
                  className="underline underline-offset-2"
                  onClick={() => void refetch()}
                >
                  Try again
                </button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="whitespace-nowrap">Created</TableHead>
                        <TableHead>Organization</TableHead>
                        <TableHead>Purpose</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead className="min-w-[14rem]">References</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        Array.from({ length: 5 }).map((_, index) => (
                          <TableRow key={`skeleton-${index}`}>
                            <TableCell>
                              <Skeleton className="h-5 w-28" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-5 w-36" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-5 w-32" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="ml-auto h-5 w-20" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-5 w-24" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-5 w-20" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-10 w-40" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="ml-auto h-8 w-16" />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : items.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="py-10 text-center text-muted-foreground"
                          >
                            <p className="font-medium text-foreground">{emptyCopy.title}</p>
                            <p className="mt-1 text-sm">{emptyCopy.detail}</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        items.map((item) => (
                          <TableRow
                            key={item.id}
                            className={adminActionRowClass(statusToken(item.status))}
                          >
                            <TableCell className="whitespace-nowrap text-sm">
                              {formatGatewayPaymentDate(item.createdAt)}
                            </TableCell>
                            <TableCell className="max-w-[12rem]">
                              <span
                                className="line-clamp-2 text-sm"
                                title={organizationName(item)}
                              >
                                {organizationName(item)}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm">
                              {PURPOSE_LABEL[item.purpose] ?? item.purpose}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right text-sm font-medium tabular-nums">
                              {formatCurrency(item.amount)}
                            </TableCell>
                            <TableCell>
                              <StatusBadge
                                label={STATUS_LABEL[item.status] ?? item.status}
                                status={statusToken(item.status)}
                              />
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={getGatewayAccountBadgeClassName(
                                  item.gatewayAccount
                                )}
                              >
                                {getGatewayAccountLabel(item.gatewayAccount)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5">
                                <ReferenceLine label="Order" value={item.curlecOrderId} />
                                <ReferenceLine
                                  label="Payment"
                                  value={item.curlecPaymentId}
                                />
                                {item.settlementId ? (
                                  <ReferenceLine
                                    label="Settle"
                                    value={item.settlementId}
                                  />
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button asChild size="sm" variant="outline">
                                <Link href={`/finance/gateway-payments/${item.id}`}>
                                  <ArrowTopRightOnSquareIcon className="mr-1 h-4 w-4" />
                                  View
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                {!isLoading && items.length > 0 ? (
                  <TablePagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    startIndex={startIndex}
                    endIndex={endIndex}
                    totalItems={total}
                    onPageChange={setCurrentPage}
                  />
                ) : null}
              </div>
            )}
          </section>
        </div>
      </div>
    </RequirePermission>
  );
}

function GatewayPaymentsTableFallback() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="w-full space-y-8 px-2 py-8 md:px-4">
        <Skeleton className="h-10 w-72 rounded-lg" />
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export function GatewayPaymentsTable(props: GatewayPaymentsTableProps) {
  return (
    <Suspense fallback={<GatewayPaymentsTableFallback />}>
      <GatewayPaymentsTableContent {...props} />
    </Suspense>
  );
}

export { STATUS_LABEL, PURPOSE_LABEL, statusToken, statusVariant, formatDate };
