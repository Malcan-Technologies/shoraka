"use client";

import { useHeader } from "@cashsouk/ui";

import { format } from "date-fns";
import Link from "next/link";
import { useState, useEffect } from "react";
import { ArrowPathIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import type { CurlecGatewayAccount } from "@cashsouk/types";
import { formatCurrency } from "@cashsouk/config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const STATUS_LABEL: Record<string, string> = {
  CREATED: "Created",
  PAID: "Paid",
  NAME_CHECK_PENDING: "Name check pending",
  COMPLETED: "Completed",
  HELD: "Needs attention",
  REFUND_INITIATED: "Refunding",
  REFUNDED: "Refunded",
  FAILED: "Failed",
  EXPIRED: "Expired",
};

const PURPOSE_LABEL: Record<string, string> = {
  INVESTOR_DEPOSIT: "Investor Deposit",
  ISSUER_ONBOARDING_FEE: "Issuer Registration Fee",
  APPLICATION_PROCESSING_FEE: "Application Processing Fee",
};

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "review", label: "Review" },
  { value: "refunding", label: "Refunding" },
  { value: "refunded", label: "Refunded" },
  { value: "needs_attention", label: "Needs attention" },
] as const;

type GatewayFilter = (typeof FILTER_OPTIONS)[number]["value"];
type GatewayAccountFilter = CurlecGatewayAccount | "ALL";

function statusVariant(status: string) {
  if (status === "COMPLETED") return "success" as const;
  if (status === "HELD" || status === "FAILED") return "destructive" as const;
  if (status === "NAME_CHECK_PENDING") return "warning" as const;
  if (status === "REFUND_INITIATED" || status === "REFUNDED") return "secondary" as const;
  if (status === "PAID") return "info" as const;
  return "outline" as const;
}

function formatDate(value: string) {
  return format(new Date(value), "dd MMM yyyy, h:mm a");
}

type GatewayPaymentsTableProps = {
  title: string;
  description: string;
  initialFilter?: GatewayFilter;
};

export function GatewayPaymentsTable({
  title,
  description,
  initialFilter = "all",
}: GatewayPaymentsTableProps) {
  const { setTitle } = useHeader();
  useEffect(() => {
    setTitle(title);
    return () => setTitle("");
  }, [setTitle, title]);

  const [filter, setFilter] = useState<GatewayFilter>(initialFilter);
  const [gatewayAccount, setGatewayAccount] = useState<GatewayAccountFilter>("ALL");
  const { data, isLoading, error, refetch, isFetching } = useGatewayPayments({
    page: 1,
    pageSize: 50,
    gatewayAccount: gatewayAccount === "ALL" ? undefined : gatewayAccount,
    filter: filter === "all" ? undefined : filter,
  });

  const items = data?.items ?? [];

  return (
    <RequirePermission permission="gateway_payments.view">
      <>
        <div className="flex-1 overflow-y-auto">
          <div className="w-full space-y-6 px-4 py-10 md:px-6 md:py-12 lg:px-8">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
                <p className="mt-1 text-[15px] leading-7 text-muted-foreground">{description}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="h-8 w-8 shrink-0 p-0"
                title="Refresh"
              >
                <ArrowPathIcon className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {FILTER_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={filter === option.value ? "default" : "outline"}
                  className="h-11 rounded-xl"
                  onClick={() => setFilter(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                variant={gatewayAccount === "ALL" ? "default" : "outline"}
                className="h-11 rounded-xl"
                onClick={() => setGatewayAccount("ALL")}
              >
                All Accounts
              </Button>
              {GATEWAY_ACCOUNT_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={gatewayAccount === option.value ? "default" : "outline"}
                  className="h-11 rounded-xl"
                  onClick={() => setGatewayAccount(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>

            <div className="overflow-hidden rounded-xl border bg-card">
              {isLoading ? (
                <div className="p-6">
                  <Skeleton className="h-64 w-full rounded-xl" />
                </div>
              ) : error ? (
                <p className="p-6 text-destructive">Failed to load gateway payments.</p>
              ) : items.length === 0 ? (
                <p className="p-6 text-muted-foreground">No gateway payments found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Created</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Gateway account</TableHead>
                      <TableHead className="hidden lg:table-cell">Curlec order ID</TableHead>
                      <TableHead className="hidden xl:table-cell">Curlec payment ID</TableHead>
                      <TableHead className="hidden 2xl:table-cell">Settlement ID</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{formatDate(item.createdAt)}</TableCell>
                        <TableCell>{PURPOSE_LABEL[item.purpose] ?? item.purpose}</TableCell>
                        <TableCell>{item.investorOrganizationName ?? "—"}</TableCell>
                        <TableCell>{formatCurrency(item.amount)}</TableCell>
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
                        <TableCell className="hidden font-mono text-xs lg:table-cell">
                          {item.curlecOrderId}
                        </TableCell>
                        <TableCell className="hidden font-mono text-xs xl:table-cell">
                          {item.curlecPaymentId ?? "—"}
                        </TableCell>
                        <TableCell className="hidden font-mono text-xs 2xl:table-cell">
                          {item.settlementId ?? "—"}
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
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>
      </>
    </RequirePermission>
  );
}

export { STATUS_LABEL, PURPOSE_LABEL, statusVariant, formatDate };
