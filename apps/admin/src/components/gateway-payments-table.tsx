"use client";

import { useHeader } from "@cashsouk/ui";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RequirePermission } from "@/components/require-permission";
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
  statusVariant,
} from "@/lib/gateway-payment-display";
import { cn } from "@/lib/utils";

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "review", label: "Review" },
  { value: "refunding", label: "Refund pending" },
  { value: "refunded", label: "Refunded" },
  { value: "needs_attention", label: "Needs attention" },
] as const;

const PURPOSE_FILTER_OPTIONS = [
  { value: "all", label: "All purposes" },
  { value: "INVESTOR_DEPOSIT", label: "Investor Deposit" },
  { value: "ISSUER_ONBOARDING_FEE", label: "Issuer Registration Fee" },
  { value: "APPLICATION_PROCESSING_FEE", label: "Application Processing Fee" },
] as const;

type GatewayFilter = (typeof FILTER_OPTIONS)[number]["value"];
type GatewayAccountFilter = CurlecGatewayAccount | "ALL";
type PurposeFilter = GatewayPaymentPurpose | "all";

function isGatewayFilter(value: string | null): value is GatewayFilter {
  return FILTER_OPTIONS.some((option) => option.value === value);
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

function truncateRef(value: string, max = 18) {
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

function ReferenceCell({
  value,
  label,
  className,
}: {
  value: string | null | undefined;
  label: string;
  className?: string;
}) {
  if (!value) {
    return <span className={cn("text-muted-foreground", className)}>—</span>;
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-1", className)}>
      <span className="truncate font-mono text-xs" title={value}>
        {truncateRef(value)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
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

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      className={active ? "h-9 rounded-lg" : "h-9 rounded-lg bg-card"}
      onClick={onClick}
    >
      {children}
    </Button>
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
  const { setTitle } = useHeader();
  useEffect(() => {
    setTitle(title);
    return () => setTitle("");
  }, [setTitle, title]);

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
    router.replace(next, { scroll: false });
  }, [debouncedSearch, filter, gatewayAccount, pathname, purpose, router]);

  const { data, isLoading, error, refetch, isFetching } = useGatewayPayments({
    page: 1,
    pageSize: 50,
    gatewayAccount: gatewayAccount === "ALL" ? undefined : gatewayAccount,
    filter: filter === "all" ? undefined : filter,
    purpose: purpose === "all" ? undefined : purpose,
    search: debouncedSearch || undefined,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const hasActiveFilters =
    filter !== "all" ||
    gatewayAccount !== "ALL" ||
    purpose !== "all" ||
    Boolean(debouncedSearch) ||
    Boolean(searchInput.trim());

  const clearFilters = useCallback(() => {
    setFilter("all");
    setGatewayAccount("ALL");
    setPurpose("all");
    setSearchInput("");
    setDebouncedSearch("");
  }, []);

  const emptyMessage = useMemo(() => {
    if (debouncedSearch || filter !== "all" || gatewayAccount !== "ALL" || purpose !== "all") {
      return "No gateway payments match your search or filters.";
    }
    return "No gateway payments yet.";
  }, [debouncedSearch, filter, gatewayAccount, purpose]);

  return (
    <RequirePermission permission="gateway_payments.view">
      <div className="flex-1 overflow-y-auto">
        <div className="w-full space-y-6 px-4 py-10 md:px-6 md:py-12 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 max-w-3xl">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
              <p className="mt-1 text-[15px] leading-7 text-muted-foreground">{description}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-11 shrink-0 gap-2 rounded-xl bg-card"
              title="Refresh"
            >
              <ArrowPathIcon className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          <div className="space-y-4 rounded-xl border bg-card p-4 md:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search order, payment, refund, org, purpose, account, amount…"
                  className="h-11 rounded-xl bg-background pl-9 pr-9"
                  aria-label="Search gateway payments"
                />
                {searchInput ? (
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setSearchInput("");
                      setDebouncedSearch("");
                    }}
                    aria-label="Clear search"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-11 shrink-0 gap-1.5 rounded-xl"
                  onClick={clearFilters}
                >
                  <XMarkIcon className="h-4 w-4" />
                  Clear filters
                </Button>
              ) : null}
            </div>

            <div className="space-y-3">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Status
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {FILTER_OPTIONS.map((option) => (
                    <FilterChip
                      key={option.value}
                      active={filter === option.value}
                      onClick={() => setFilter(option.value)}
                    >
                      {option.label}
                    </FilterChip>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Gateway account
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <FilterChip
                    active={gatewayAccount === "ALL"}
                    onClick={() => setGatewayAccount("ALL")}
                  >
                    All accounts
                  </FilterChip>
                  {GATEWAY_ACCOUNT_OPTIONS.map((option) => (
                    <FilterChip
                      key={option.value}
                      active={gatewayAccount === option.value}
                      onClick={() => setGatewayAccount(option.value)}
                    >
                      {option.label}
                    </FilterChip>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Purpose
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {PURPOSE_FILTER_OPTIONS.map((option) => (
                    <FilterChip
                      key={option.value}
                      active={purpose === option.value}
                      onClick={() => setPurpose(option.value)}
                    >
                      {option.label}
                    </FilterChip>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              {isLoading ? "Loading…" : `${total} payment${total === 1 ? "" : "s"}`}
              {debouncedSearch ? (
                <span>
                  {" "}
                  matching <span className="font-medium text-foreground">“{debouncedSearch}”</span>
                </span>
              ) : null}
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border bg-card">
            {isLoading ? (
              <div className="space-y-3 p-6">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-3/4 rounded-lg" />
              </div>
            ) : error ? (
              <div className="space-y-3 p-8 text-center">
                <p className="text-destructive">Failed to load gateway payments.</p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Try again
                </Button>
              </div>
            ) : items.length === 0 ? (
              <div className="space-y-2 p-10 text-center">
                <p className="text-[15px] font-medium text-foreground">{emptyMessage}</p>
                <p className="text-sm text-muted-foreground">
                  Try another search term, or clear filters to see all payments.
                </p>
                {hasActiveFilters ? (
                  <div className="pt-2">
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="whitespace-nowrap">Created</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead className="hidden min-w-[10rem] lg:table-cell">
                        Order reference
                      </TableHead>
                      <TableHead className="hidden min-w-[10rem] xl:table-cell">
                        Payment reference
                      </TableHead>
                      <TableHead className="hidden min-w-[8rem] 2xl:table-cell">
                        Settlement ID
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id} className="align-middle">
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatGatewayPaymentDate(item.createdAt)}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">
                            {PURPOSE_LABEL[item.purpose] ?? item.purpose}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[14rem]">
                          <span className="line-clamp-2 text-sm" title={organizationName(item)}>
                            {organizationName(item)}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-sm font-medium tabular-nums">
                          {formatCurrency(item.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(item.status)}>
                            {STATUS_LABEL[item.status] ?? item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={getGatewayAccountBadgeClassName(item.gatewayAccount)}
                          >
                            {getGatewayAccountLabel(item.gatewayAccount)}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <ReferenceCell value={item.curlecOrderId} label="Order reference" />
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          <ReferenceCell
                            value={item.curlecPaymentId}
                            label="Payment reference"
                          />
                        </TableCell>
                        <TableCell className="hidden 2xl:table-cell">
                          <ReferenceCell value={item.settlementId} label="Settlement ID" />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button asChild size="sm" variant="outline" className="rounded-lg">
                            <Link href={`/finance/gateway-payments/${item.id}`}>
                              <ArrowTopRightOnSquareIcon className="mr-1 h-4 w-4" />
                              View
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </div>
    </RequirePermission>
  );
}

function GatewayPaymentsTableFallback() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="w-full space-y-6 px-4 py-10 md:px-6 md:py-12 lg:px-8">
        <Skeleton className="h-10 w-72 rounded-lg" />
        <Skeleton className="h-5 w-full max-w-xl rounded-lg" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
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

export { STATUS_LABEL, PURPOSE_LABEL, statusVariant, formatDate };
