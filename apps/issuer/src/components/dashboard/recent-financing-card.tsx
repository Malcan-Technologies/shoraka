"use client";

import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { Card, formatMoneyDisplay } from "@cashsouk/ui";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useIssuerDashboard } from "@/hooks/use-issuer-dashboard";
import type {
  IssuerDashboardContract,
  IssuerDashboardInvoice,
} from "@/types/issuer-dashboard";
import {
  getIssuerFinancingStatusPresentation,
  resolveIssuerContractDashboardBadge,
  resolveIssuerInvoiceDashboardBadge,
  type IssuerFinancingStatusKind,
} from "@/lib/issuer-dashboard-labels";
import { RecentSectionHeader } from "@/components/dashboard/recent-section-header";

const MAX_ROWS = 4;
const EM = "\u2014";

type Row =
  | { kind: "contract"; data: IssuerDashboardContract; rank: number }
  | { kind: "invoice"; data: IssuerDashboardInvoice; rank: number };

const STATUS_RANK: Record<IssuerFinancingStatusKind, number> = {
  pending_approval: 0,
  in_progress: 1,
  funded: 2,
  active: 3,
  draft: 4,
  completed: 5,
  unsuccessful: 6,
};

function rankContract(c: IssuerDashboardContract): number {
  const base = c.actionRequiredApplicationIds?.length ? -10 : 0;
  return base + (STATUS_RANK[resolveIssuerContractDashboardBadge(c.contractStatus)] ?? 99);
}

function rankInvoice(i: IssuerDashboardInvoice): number {
  const base = i.actionRequiredApplicationIds?.length ? -10 : 0;
  return base + (STATUS_RANK[resolveIssuerInvoiceDashboardBadge(i.note, i.invoiceStatus)] ?? 99);
}

function formatMoney(v: unknown) {
  return formatMoneyDisplay(v, EM);
}

export function RecentFinancingCard({ organizationId }: { organizationId?: string }) {
  const { data, isLoading } = useIssuerDashboard(organizationId);
  const contracts = data?.contracts ?? [];
  const invoices = data?.invoices ?? [];

  const combined: Row[] = [
    ...contracts.map<Row>((c) => ({ kind: "contract", data: c, rank: rankContract(c) })),
    ...invoices.map<Row>((i) => ({ kind: "invoice", data: i, rank: rankInvoice(i) })),
  ];

  combined.sort((a, b) => a.rank - b.rank);
  const visible = combined.slice(0, MAX_ROWS);

  const actionRequiredCount =
    contracts.filter((c) => (c.actionRequiredApplicationIds ?? []).length > 0).length +
    invoices.filter((i) => (i.actionRequiredApplicationIds ?? []).length > 0).length;

  return (
    <Card className="bg-muted/50 shadow-none">
      <RecentSectionHeader
        title="Recent financing"
        countBadge={
          actionRequiredCount > 0 ? (
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
              {actionRequiredCount} action{actionRequiredCount === 1 ? "" : "s"} required
            </Badge>
          ) : null
        }
        viewAllHref="/financing"
      />
      <div className="px-5 pb-5 pt-4 md:px-6 md:pb-6 md:pt-5">
        {isLoading ? (
          <p className="py-4 text-[17px] leading-7 text-muted-foreground">Loading...</p>
        ) : visible.length === 0 ? (
          <p className="py-4 text-[17px] leading-7 text-muted-foreground">
            No financing activity yet.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-background">
            {visible.map((row) =>
              row.kind === "contract" ? (
                <ContractRow key={`c-${row.data.id}`} row={row.data} />
              ) : (
                <InvoiceRow key={`i-${row.data.id}`} row={row.data} />
              )
            )}
          </ul>
        )}
      </div>
    </Card>
  );
}

function StatusPill({ kind }: { kind: IssuerFinancingStatusKind }) {
  const p = getIssuerFinancingStatusPresentation(kind);
  return (
    <Badge variant={p.variant} className={cn("shrink-0", p.className)}>
      {p.label}
    </Badge>
  );
}

function ContractRow({ row }: { row: IssuerDashboardContract }) {
  const kind = resolveIssuerContractDashboardBadge(row.contractStatus);
  return (
    <li>
      <Link
        href={`/financing/contracts/${row.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-sm text-muted-foreground">Contract:</span>
            <span className="truncate text-sm font-semibold text-foreground">
              {row.title?.trim() || EM}
            </span>
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {row.customerName?.trim() || EM} · Approved {formatMoney(row.approvedFacilityAmount)}
          </p>
        </div>
        <StatusPill kind={kind} />
        <ArrowRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

function InvoiceRow({ row }: { row: IssuerDashboardInvoice }) {
  const kind = resolveIssuerInvoiceDashboardBadge(row.note, row.invoiceStatus);
  const href = row.note?.id ? `/notes/${row.note.id}` : "/financing?tab=invoices";
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-sm text-muted-foreground">Invoice:</span>
            <span className="truncate text-sm font-semibold text-foreground">
              {row.invoiceNumber?.trim() || EM}
            </span>
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {row.customerName?.trim() || EM} · {formatMoney(row.financingAmount)}
          </p>
        </div>
        <StatusPill kind={kind} />
        <ArrowRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
