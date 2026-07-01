"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useState } from "react";
import { ArrowPathIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SystemHealthIndicator } from "@/components/system-health-indicator";
import { RequirePermission } from "@/components/require-permission";
import { useGatewayPayments } from "@/hooks/use-gateway-payments";

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
  INVESTOR_DEPOSIT: "Investor deposit",
  ISSUER_ONBOARDING_FEE: "Issuer onboarding fee",
  APPLICATION_PROCESSING_FEE: "Processing fee",
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

function statusVariant(status: string) {
  if (status === "COMPLETED") return "default" as const;
  if (status === "HELD") return "destructive" as const;
  if (status === "NAME_CHECK_PENDING") return "secondary" as const;
  if (status === "REFUNDED" || status === "REFUND_INITIATED") return "secondary" as const;
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
  const [filter, setFilter] = useState<GatewayFilter>(initialFilter);
  const { data, isLoading, error, refetch, isFetching } = useGatewayPayments({
    page: 1,
    pageSize: 50,
    filter: filter === "all" ? undefined : filter,
  });

  const items = data?.items ?? [];

  return (
    <RequirePermission permission="gateway_payments.view">
      <>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="text-lg font-semibold">{title}</h1>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-8 w-8 p-0"
              title="Refresh"
            >
              <ArrowPathIcon className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            <SystemHealthIndicator />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="w-full space-y-6 px-4 py-10 md:px-6 md:py-12 lg:px-8">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle>{title}</CardTitle>
                <p className="text-sm text-muted-foreground">{description}</p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {FILTER_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      size="sm"
                      variant={filter === option.value ? "default" : "outline"}
                      onClick={() => setFilter(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-64 w-full rounded-xl" />
                ) : error ? (
                  <p className="text-destructive">Failed to load gateway payments.</p>
                ) : items.length === 0 ? (
                  <p className="text-muted-foreground">No gateway payments found.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Created</TableHead>
                        <TableHead>Purpose</TableHead>
                        <TableHead>Investor</TableHead>
                        <TableHead>Payer name</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{formatDate(item.createdAt)}</TableCell>
                          <TableCell>{PURPOSE_LABEL[item.purpose] ?? item.purpose}</TableCell>
                          <TableCell>{item.investorOrganizationName ?? "—"}</TableCell>
                          <TableCell>{item.payerName ?? "—"}</TableCell>
                          <TableCell>{formatCurrency(item.amount)}</TableCell>
                          <TableCell>
                            <Badge variant={statusVariant(item.status)}>
                              {STATUS_LABEL[item.status] ?? item.status}
                            </Badge>
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
              </CardContent>
            </Card>
          </div>
        </div>
      </>
    </RequirePermission>
  );
}

export { STATUS_LABEL, PURPOSE_LABEL, statusVariant, formatDate };
