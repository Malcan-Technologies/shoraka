"use client";

import * as React from "react";
import {
  ArrowTopRightOnSquareIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { format } from "date-fns";
import { formatCurrency } from "@cashsouk/config";
import { ItemActionDropdown } from "@/components/application-review/item-action-dropdown";
import { ReviewStepStatusBadge } from "@/components/application-review/review-step-status-badge";
import { REVIEW_EMPTY_LABEL } from "@/components/application-review/review-section-styles";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PROFIT_RATE_OPTIONS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] as const;

interface InvoiceReviewListProps {
  invoices: { id: string; details?: unknown; status?: string }[];
  reviewItems: { item_type: string; item_id: string; status: string }[];
  isReviewable: boolean;
  onViewDocument: (s3Key: string) => void;
  isViewDocumentPending: boolean;
  invoiceRatioLimits: { min: number; max: number };
  isActionLocked?: boolean;
  actionLockTooltip?: string;
  onApproveItem: (itemId: string) => Promise<void>;
  onRejectItem: (itemId: string) => void;
  onRequestAmendmentItem: (itemId: string) => void;
  onResetItemToPending?: (itemId: string) => void;
  isItemActionPending: boolean;
}

interface InvoiceDetails {
  number?: string | number;
  value?: string | number;
  due_date?: string;
  maturity_date?: string;
  financing_ratio_percent?: string | number;
  document?: {
    file_name?: string;
    s3_key?: string;
  };
}

const PLACEHOLDER = { estDisbursementDate: "TBD", estPeriodDays: "TBD" } as const;

function buildInvoiceScopeKey(idx: number, invoiceNo: string | number): string {
  const sanitized = String(invoiceNo).replace(/:/g, "_");
  return `invoice_details:${idx}:${sanitized}`;
}

function getItemStatus(
  inv: { status?: string },
  reviewItems: { item_type: string; item_id: string; status: string }[],
  scopeKey: string
): string {
  if (inv.status === "APPROVED" || inv.status === "REJECTED") {
    return inv.status;
  }
  return reviewItems.find((r) => r.item_id === scopeKey)?.status ?? "PENDING";
}

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDateValue(value: string | undefined): string {
  if (!value) return REVIEW_EMPTY_LABEL;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : format(parsed, "dd MMM yyyy");
}

type OfferedState = { ratio: number; profitRate: number };

export function InvoiceList({
  invoices,
  reviewItems,
  isReviewable,
  onViewDocument,
  isViewDocumentPending,
  invoiceRatioLimits,
  isActionLocked,
  actionLockTooltip,
  onApproveItem,
  onRejectItem,
  onRequestAmendmentItem,
  onResetItemToPending,
  isItemActionPending,
}: InvoiceReviewListProps) {
  const [expandedById, setExpandedById] = React.useState<Record<string, boolean>>({});
  const [offeredByInvoice, setOfferedByInvoice] = React.useState<Record<string, OfferedState>>({});

  const toggleExpanded = React.useCallback((invoiceId: string) => {
    setExpandedById((prev) => ({ ...prev, [invoiceId]: !prev[invoiceId] }));
  }, []);

  const setOffered = React.useCallback((invoiceId: string, updates: Partial<OfferedState>) => {
    setOfferedByInvoice((prev) => {
      const current = prev[invoiceId] ?? { ratio: invoiceRatioLimits.min, profitRate: 12 };
      return { ...prev, [invoiceId]: { ...current, ...updates } };
    });
  }, [invoiceRatioLimits.min]);

  const getOffered = React.useCallback(
    (invoiceId: string, issuerRatio: number | null): OfferedState => {
      const stored = offeredByInvoice[invoiceId];
      if (stored) return stored;
      const ratio = issuerRatio != null
        ? Math.max(invoiceRatioLimits.min, Math.min(invoiceRatioLimits.max, issuerRatio))
        : invoiceRatioLimits.min;
      return { ratio, profitRate: 12 };
    },
    [offeredByInvoice, invoiceRatioLimits]
  );

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader className="bg-muted/20">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10" />
            <TableHead className="text-center text-sm font-semibold">Invoice No.</TableHead>
            <TableHead className="text-center text-sm font-semibold">Invoice value</TableHead>
            <TableHead className="text-center text-sm font-semibold">Financing ratio</TableHead>
            <TableHead className="text-center text-sm font-semibold">Financing amount</TableHead>
            <TableHead className="text-center text-sm font-semibold">Status</TableHead>
            <TableHead className="w-[120px] text-center text-sm font-semibold">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv, idx) => {
            const details = inv.details as InvoiceDetails | undefined;
            const invoiceNo = details?.number ?? idx + 1;
            const scopeKey = buildInvoiceScopeKey(idx, invoiceNo);
            const status = getItemStatus(inv, reviewItems, scopeKey);
            const isExpanded = Boolean(expandedById[inv.id]);
            const invoiceValue = toNumber(details?.value);
            const financingRatio = toNumber(details?.financing_ratio_percent);
            const issuerFinancingAmount =
              invoiceValue !== null && financingRatio !== null
                ? (invoiceValue * financingRatio) / 100
                : null;
            const maturityDate = details?.maturity_date ?? details?.due_date;
            const documentName = details?.document?.file_name ?? "No document uploaded";

            return (
              <React.Fragment key={inv.id}>
                <TableRow className="odd:bg-muted/30 hover:bg-muted/50">
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => toggleExpanded(inv.id)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted"
                      aria-label={isExpanded ? "Collapse invoice details" : "Expand invoice details"}
                    >
                      <ChevronDownIcon
                        className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </button>
                  </TableCell>
                  <TableCell className="text-center text-sm font-semibold text-foreground">{invoiceNo}</TableCell>
                  <TableCell className="text-center text-sm font-semibold text-foreground">
                    {invoiceValue !== null ? formatCurrency(invoiceValue) : REVIEW_EMPTY_LABEL}
                  </TableCell>
                  <TableCell className="text-center text-sm font-semibold text-foreground">
                    {financingRatio !== null ? `${financingRatio}%` : REVIEW_EMPTY_LABEL}
                  </TableCell>
                  <TableCell className="text-center text-sm font-semibold text-foreground">
                    {issuerFinancingAmount !== null ? formatCurrency(issuerFinancingAmount) : REVIEW_EMPTY_LABEL}
                  </TableCell>
                  <TableCell className="text-center">
                    <ReviewStepStatusBadge status={status} size="sm" />
                  </TableCell>
                  <TableCell className="text-center">
                    {isReviewable ? (
                      <ItemActionDropdown
                        itemId={scopeKey}
                        status={status}
                        isPending={isItemActionPending}
                        isActionLocked={isActionLocked}
                        actionLockTooltip={actionLockTooltip}
                        onApprove={onApproveItem}
                        onReject={onRejectItem}
                        onRequestAmendment={onRequestAmendmentItem}
                        onResetToPending={onResetItemToPending}
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>

                {isExpanded && (
                  <TableRow className="bg-muted/10 hover:bg-muted/10">
                    <TableCell colSpan={7}>
                      <div className="space-y-4 py-2">
                        <div className="rounded-lg bg-card p-4">
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="md:pr-3 md:border-r">
                            <p className="text-sm font-semibold text-foreground">
                              Invoice details
                            </p>
                            <div className="mt-2 space-y-2">
                              <div>
                                <p className="text-xs text-muted-foreground">Maturity date</p>
                                <p className="text-sm font-medium">{formatDateValue(maturityDate)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Document</p>
                                <div className="mt-1 flex items-center gap-2">
                                  <p className="text-sm font-medium truncate">{documentName}</p>
                                  {details?.document?.s3_key ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 rounded-lg gap-1 px-2"
                                      onClick={() => onViewDocument(details.document!.s3_key!)}
                                      disabled={isViewDocumentPending}
                                    >
                                      <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                                      View
                                    </Button>
                                  ) : null}
                                </div>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Estimated disbursement date</p>
                                <p className="text-sm font-medium">{PLACEHOLDER.estDisbursementDate}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Estimated period (Days)</p>
                                <p className="text-sm font-medium">{PLACEHOLDER.estPeriodDays}</p>
                              </div>
                            </div>
                            </div>

                            <div className="md:px-3 md:border-r">
                              <p className="text-sm font-semibold text-foreground">
                                Requested by Issuer
                              </p>
                              <div className="mt-2 space-y-2">
                                <div>
                                  <p className="text-xs text-muted-foreground">Financing ratio</p>
                                  <p className="text-sm font-medium">
                                    {financingRatio !== null ? `${financingRatio}%` : REVIEW_EMPTY_LABEL}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Financing amount</p>
                                  <p className="text-sm font-medium tabular-nums">
                                    {issuerFinancingAmount !== null ? formatCurrency(issuerFinancingAmount) : REVIEW_EMPTY_LABEL}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="md:pl-3 space-y-3">
                              <p className="text-sm font-semibold text-foreground">
                                Offered by CashSouk
                              </p>
                              {(() => {
                                const offered = getOffered(inv.id, financingRatio);
                                const offeredAmount =
                                  invoiceValue !== null
                                    ? (invoiceValue * offered.ratio) / 100
                                    : null;
                                const estimatedProfit =
                                  offeredAmount !== null
                                    ? (offeredAmount * (offered.profitRate / 100))
                                    : null;
                                return (
                                  <>
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">Financing ratio</p>
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium tabular-nums w-10">
                                          {offered.ratio}%
                                        </span>
                                        <Slider
                                          min={invoiceRatioLimits.min}
                                          max={invoiceRatioLimits.max}
                                          step={1}
                                          value={[offered.ratio]}
                                          onValueChange={(v) => setOffered(inv.id, { ratio: v[0] })}
                                          disabled={!isReviewable}
                                          className="flex-1 max-w-[140px]
                                            [&_[data-orientation=horizontal]]:h-1.5
                                            [&_[data-orientation=horizontal]>span]:bg-primary
                                            [&_[role=slider]]:h-4
                                            [&_[role=slider]]:w-4
                                            [&_[role=slider]]:border-2
                                            [&_[role=slider]]:border-primary"
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground">Financing amount</p>
                                      <p className="text-sm font-medium tabular-nums">
                                        {offeredAmount !== null ? formatCurrency(offeredAmount) : REVIEW_EMPTY_LABEL}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground mb-1">Profit rate</p>
                                      <Select
                                        value={String(offered.profitRate)}
                                        onValueChange={(v) => setOffered(inv.id, { profitRate: parseInt(v, 10) })}
                                        disabled={!isReviewable}
                                      >
                                        <SelectTrigger className="h-8 w-full max-w-[100px]">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[200px]">
                                          {PROFIT_RATE_OPTIONS.map((p) => (
                                            <SelectItem key={p} value={String(p)}>
                                              {p}%
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground">Estimated profit</p>
                                      <p className="text-sm font-medium tabular-nums">
                                        {estimatedProfit !== null ? formatCurrency(estimatedProfit) : REVIEW_EMPTY_LABEL}
                                      </p>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
