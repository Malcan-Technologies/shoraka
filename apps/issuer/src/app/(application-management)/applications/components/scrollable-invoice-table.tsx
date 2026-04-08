"use client";

/**
 * Invoice table for application cards: horizontal scroll lives only inside the wrapper
 * (card/page do not grow horizontally). Status + Action columns are sticky on the right.
 *
 * Fluid width: table is `width: 100%` so it fills the card when space allows; first seven columns share
 * extra space (table-layout: fixed + col minWidths). Status + action columns stay fixed (px) for sticky `right`.
 * The action column is wide only when at least one row shows Review Offer / Make Amendments; otherwise it
 * stays compact (kebab only) so the scrollable columns absorb the width.
 * `minWidth` prevents overlap when the viewport is narrow (horizontal scroll).
 *
 * Does not use the shared Table shell (which wraps <table> in overflow-auto + w-full).
 */

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { EllipsisVerticalIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import {
  formatCurrency,
  getStatusPresentationByBadgeKey,
  resolveIssuerInvoiceStatusBadgeKey,
} from "@cashsouk/config";
import type { WithdrawReason } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { FileDisplayBadge } from "@/app/(application-flow)/applications/components/file-display-badge";
import {
  issuerInvoiceCanViewReasonRemarks,
  type NormalizedApplication,
  type NormalizedInvoice,
} from "../status";

const BADGE_BASE =
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border whitespace-nowrap";
const BADGE_FALLBACK = "border-slate-500/30 bg-slate-500/10 text-slate-600";

/** Min widths (px) for scrollable columns; extra space is shared across them. */
const COL_MIN = {
  invoiceNumber: 132,
  maturity: 124,
  invoiceValue: 132,
  appliedFinancing: 132,
  documents: 200,
  financingOffered: 136,
  profitRate: 96,
} as const;

/** Fixed widths (px). Status `right` sticky offset must equal the action column width. */
const COL_STICKY_STATUS_PX = 168;
/** Room for primary action buttons (Review Offer / Make Amendments) + kebab. */
const COL_STICKY_ACTION_WIDE_PX = 220;
/** Kebab-only: `px-4` cell + `h-8 w-8` trigger. */
const COL_STICKY_ACTION_COMPACT_PX = 64;

const SCROLL_COLS_MIN_SUM_PX =
  COL_MIN.invoiceNumber +
  COL_MIN.maturity +
  COL_MIN.invoiceValue +
  COL_MIN.appliedFinancing +
  COL_MIN.documents +
  COL_MIN.financingOffered +
  COL_MIN.profitRate;

/** Conservative min-width when the action column is wide (external layout budgets). */
export const INV_TABLE_MIN_WIDTH_PX =
  SCROLL_COLS_MIN_SUM_PX + COL_STICKY_STATUS_PX + COL_STICKY_ACTION_WIDE_PX;

function invoiceShowsPrimaryActionButtons(
  inv: NormalizedInvoice,
  application: NormalizedApplication
): boolean {
  const invStatus = String(inv.status ?? "").toUpperCase();
  const showReviewOffer = invStatus === "OFFER_SENT" && inv.offerStatus === "Offer received";
  const showMakeAmendments =
    application.cardStatus.showMakeAmendments && invStatus === "AMENDMENT_REQUESTED";
  return showReviewOffer || showMakeAmendments;
}

/** Solid fills only (no opacity); sticky columns use same fill as body cells. */
const INV_TABLE_CHROME_BG = "bg-muted";
const INV_TABLE_HEADER_BG = "bg-muted";
const INV_TABLE_ROW_BG = "bg-card";
const INV_TABLE_ROW_HOVER = "group-hover:bg-muted";

const CELL = "px-4 py-3 text-[15px]";

function invoiceStatusStickyStyle(actionColPx: number): React.CSSProperties {
  return {
    right: actionColPx,
    width: COL_STICKY_STATUS_PX,
    minWidth: COL_STICKY_STATUS_PX,
    maxWidth: COL_STICKY_STATUS_PX,
  };
}

function invoiceActionStickyStyle(actionColPx: number): React.CSSProperties {
  return {
    width: actionColPx,
    minWidth: actionColPx,
    maxWidth: actionColPx,
  };
}

function InvoiceStatusBadge({
  badgeKey,
  withdrawReason,
}: {
  badgeKey: string;
  withdrawReason?: WithdrawReason;
}) {
  const { color, label } = getStatusPresentationByBadgeKey(badgeKey, withdrawReason, {
    issuerWithdrawPresentation: true,
  });
  return <span className={cn(BADGE_BASE, color || BADGE_FALLBACK)}>{label}</span>;
}

function IssuerInvoiceCurrencyCell({ amount }: { amount: number | null | undefined }) {
  if (amount == null || !Number.isFinite(amount)) {
    return <span className="tabular-nums">—</span>;
  }
  return (
    <div className="flex w-full min-w-0 items-baseline justify-between gap-2 text-[15px]">
      <span className="shrink-0 text-left">RM</span>
      <span className="min-w-0 flex-1 text-right tabular-nums">
        {formatCurrency(amount, { includeSymbol: false })}
      </span>
    </div>
  );
}

function IssuerInvoiceCurrencyCellFromFormatted({ formatted }: { formatted: string }) {
  if (formatted === "—" || !formatted.trim()) {
    return <span className="tabular-nums">—</span>;
  }
  const match = /^RM\s+(.+)$/.exec(formatted.trim());
  if (!match) {
    return <span>{formatted}</span>;
  }
  return (
    <div className="flex w-full min-w-0 items-baseline justify-between gap-2 text-[15px]">
      <span className="shrink-0 text-left">RM</span>
      <span className="min-w-0 flex-1 text-right tabular-nums">{match[1]}</span>
    </div>
  );
}

function InvoiceDocumentCell({
  documentName,
  documentS3Key,
  onDownload,
}: {
  documentName: string;
  documentS3Key: string | null;
  onDownload: (s3Key: string) => Promise<void>;
}) {
  const [loading, setLoading] = React.useState(false);
  const hasDocument = documentName && documentName !== "—";
  if (!hasDocument) {
    return <span className="text-[15px] text-muted-foreground">—</span>;
  }
  return (
    <FileDisplayBadge
      fileName={documentName}
      size="sm"
      truncate
      className="min-w-0 max-w-full bg-transparent"
      trailing={
        documentS3Key ? (
          <button
            type="button"
            onClick={async (e) => {
              e.preventDefault();
              setLoading(true);
              try {
                await onDownload(documentS3Key);
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50"
            aria-label={`Download ${documentName}`}
          >
            <ArrowDownTrayIcon className="h-3 w-3" />
          </button>
        ) : undefined
      }
    />
  );
}

function formatDate(date: string | Date | null | undefined): string {
  if (date == null) return "—";
  return format(new Date(date), "d MMM yyyy");
}

export type ScrollableInvoiceTableProps = {
  application: NormalizedApplication;
  onDocumentDownload: (s3Key: string) => Promise<void>;
  onViewSignedInvoiceOffer?: (signedOfferLetterS3Key: string) => Promise<void>;
  onReviewInvoiceOffer?: (applicationId: string, invoice: NormalizedInvoice) => void;
  onWithdrawInvoice?: (invoiceId: string, applicationId: string, organizationId?: string) => void;
  isWithdrawInvoicePending?: boolean;
};

/**
 * Outer shell: constrains width (`min-w-0`) so flex parents don’t overflow the viewport;
 * inner div is the only horizontal scroll container.
 */
export function ScrollableInvoiceTableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full min-w-0 max-w-full">
      <div className={cn("max-w-full overflow-hidden rounded-xl", INV_TABLE_CHROME_BG)}>
        <div className="isolate max-w-full min-w-0 w-full overflow-x-auto overscroll-x-contain [scrollbar-gutter:stable] touch-pan-x">
          {children}
        </div>
      </div>
    </div>
  );
}

export function ScrollableInvoiceTable({
  application,
  onDocumentDownload,
  onViewSignedInvoiceOffer,
  onReviewInvoiceOffer,
  onWithdrawInvoice,
  isWithdrawInvoicePending,
}: ScrollableInvoiceTableProps) {
  const [reasonRemarksOpen, setReasonRemarksOpen] = React.useState(false);
  const [reasonRemarksBody, setReasonRemarksBody] = React.useState("");

  const actionColPx = React.useMemo(() => {
    const wide = application.invoices.some((inv) =>
      invoiceShowsPrimaryActionButtons(inv, application)
    );
    return wide ? COL_STICKY_ACTION_WIDE_PX : COL_STICKY_ACTION_COMPACT_PX;
  }, [application]);

  const stickyTotalPx = COL_STICKY_STATUS_PX + actionColPx;
  const flexColWidth = `calc((100% - ${stickyTotalPx}px) / 7)`;
  const tableMinWidthPx = SCROLL_COLS_MIN_SUM_PX + stickyTotalPx;

  return (
    <>
      <ScrollableInvoiceTableWrapper>
        <table
          className="w-full min-w-0 table-fixed border-collapse text-[15px]"
          style={{
            width: "100%",
            minWidth: tableMinWidthPx,
          }}
        >
          <colgroup>
            <col style={{ width: flexColWidth, minWidth: COL_MIN.invoiceNumber }} />
            <col style={{ width: flexColWidth, minWidth: COL_MIN.maturity }} />
            <col style={{ width: flexColWidth, minWidth: COL_MIN.invoiceValue }} />
            <col style={{ width: flexColWidth, minWidth: COL_MIN.appliedFinancing }} />
            <col style={{ width: flexColWidth, minWidth: COL_MIN.documents }} />
            <col style={{ width: flexColWidth, minWidth: COL_MIN.financingOffered }} />
            <col style={{ width: flexColWidth, minWidth: COL_MIN.profitRate }} />
            <col style={{ width: COL_STICKY_STATUS_PX, minWidth: COL_STICKY_STATUS_PX }} />
            <col style={{ width: actionColPx, minWidth: actionColPx }} />
          </colgroup>
          <TableHeader className="[&_tr]:border-b-0">
            <TableRow className="border-b-0 hover:bg-transparent">
              <TableHead
                className={cn(
                  CELL,
                  INV_TABLE_HEADER_BG,
                  "whitespace-nowrap text-sm font-semibold text-foreground"
                )}
              >
                Invoice Number
              </TableHead>
              <TableHead
                className={cn(
                  CELL,
                  INV_TABLE_HEADER_BG,
                  "whitespace-nowrap text-sm font-semibold text-foreground"
                )}
              >
                Maturity Date
              </TableHead>
              <TableHead
                className={cn(
                  CELL,
                  INV_TABLE_HEADER_BG,
                  "whitespace-nowrap text-sm font-semibold text-foreground tabular-nums"
                )}
              >
                Invoice Value
              </TableHead>
              <TableHead
                className={cn(
                  CELL,
                  INV_TABLE_HEADER_BG,
                  "whitespace-nowrap text-sm font-semibold text-foreground tabular-nums"
                )}
              >
                Applied Financing
              </TableHead>
              <TableHead
                className={cn(
                  CELL,
                  INV_TABLE_HEADER_BG,
                  "whitespace-nowrap text-sm font-semibold text-foreground"
                )}
              >
                Documents
              </TableHead>
              <TableHead
                className={cn(
                  CELL,
                  INV_TABLE_HEADER_BG,
                  "whitespace-nowrap text-sm font-semibold text-foreground tabular-nums"
                )}
              >
                Financing Offered
              </TableHead>
              <TableHead
                className={cn(
                  CELL,
                  INV_TABLE_HEADER_BG,
                  "whitespace-nowrap text-sm font-semibold text-foreground tabular-nums"
                )}
              >
                Profit Rate
              </TableHead>
              <TableHead
                className={cn(
                  CELL,
                  INV_TABLE_HEADER_BG,
                  "sticky z-30 text-sm font-semibold text-foreground whitespace-nowrap"
                )}
                style={invoiceStatusStickyStyle(actionColPx)}
              >
                Status
              </TableHead>
              <TableHead
                className={cn(
                  CELL,
                  INV_TABLE_HEADER_BG,
                  "sticky right-0 z-40 text-sm font-semibold text-foreground whitespace-nowrap"
                )}
                style={invoiceActionStickyStyle(actionColPx)}
                aria-label="Row actions"
              />
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr]:border-b-0">
            {application.invoices.length === 0 ? (
              <TableRow className="border-b-0 hover:bg-transparent">
                <TableCell
                  colSpan={9}
                  className={cn(CELL, INV_TABLE_ROW_BG, "text-center text-muted-foreground")}
                >
                  No invoices available
                </TableCell>
              </TableRow>
            ) : (
              application.invoices.map((inv: NormalizedInvoice) => {
                const invStatus = String(inv.status ?? "").toUpperCase();
                const showReviewOffer =
                  invStatus === "OFFER_SENT" && inv.offerStatus === "Offer received";
                const canReview = inv.canReviewOffer;
                const showMakeAmendments =
                  application.cardStatus.showMakeAmendments && invStatus === "AMENDMENT_REQUESTED";
                const showPrimaryActionSlot = showReviewOffer || showMakeAmendments;
                const canWithdrawInvoice = !["APPROVED", "REJECTED", "WITHDRAWN"].includes(
                  invStatus
                );
                return (
                  <TableRow
                    key={inv.id}
                    className={cn(
                      "group border-b-0 transition-colors hover:bg-muted",
                      INV_TABLE_ROW_BG
                    )}
                  >
                    <TableCell
                      className={cn(
                        CELL,
                        INV_TABLE_ROW_BG,
                        INV_TABLE_ROW_HOVER,
                        "align-middle text-left whitespace-nowrap text-foreground"
                      )}
                    >
                      {inv.number}
                    </TableCell>
                    <TableCell
                      className={cn(
                        CELL,
                        INV_TABLE_ROW_BG,
                        INV_TABLE_ROW_HOVER,
                        "align-middle text-left whitespace-nowrap text-foreground"
                      )}
                    >
                      {formatDate(inv.maturityDate)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        CELL,
                        INV_TABLE_ROW_BG,
                        INV_TABLE_ROW_HOVER,
                        "align-middle text-foreground"
                      )}
                    >
                      <IssuerInvoiceCurrencyCell amount={inv.value} />
                    </TableCell>
                    <TableCell
                      className={cn(
                        CELL,
                        INV_TABLE_ROW_BG,
                        INV_TABLE_ROW_HOVER,
                        "align-middle text-foreground"
                      )}
                    >
                      <IssuerInvoiceCurrencyCell amount={inv.appliedFinancing} />
                    </TableCell>
                    <TableCell
                      className={cn(
                        CELL,
                        INV_TABLE_ROW_BG,
                        INV_TABLE_ROW_HOVER,
                        "overflow-hidden align-middle text-left text-foreground"
                      )}
                    >
                      <InvoiceDocumentCell
                        documentName={inv.document}
                        documentS3Key={inv.documentS3Key}
                        onDownload={onDocumentDownload}
                      />
                    </TableCell>
                    <TableCell
                      className={cn(
                        CELL,
                        INV_TABLE_ROW_BG,
                        INV_TABLE_ROW_HOVER,
                        "align-middle text-foreground"
                      )}
                    >
                      <IssuerInvoiceCurrencyCellFromFormatted formatted={inv.financingOffered} />
                    </TableCell>
                    <TableCell
                      className={cn(
                        CELL,
                        INV_TABLE_ROW_BG,
                        INV_TABLE_ROW_HOVER,
                        "align-middle text-left tabular-nums whitespace-nowrap text-foreground"
                      )}
                    >
                      {inv.profitRate}
                    </TableCell>
                    <TableCell
                      className={cn(
                        CELL,
                        INV_TABLE_ROW_BG,
                        INV_TABLE_ROW_HOVER,
                        "sticky z-20",
                        "group-hover:z-[21]",
                        "align-middle text-left whitespace-nowrap"
                      )}
                      style={invoiceStatusStickyStyle(actionColPx)}
                    >
                      <span className="inline-block">
                        <InvoiceStatusBadge
                          badgeKey={resolveIssuerInvoiceStatusBadgeKey(
                            inv.status,
                            inv.withdrawReason
                          )}
                          withdrawReason={inv.withdrawReason}
                        />
                      </span>
                    </TableCell>
                    <TableCell
                      className={cn(
                        CELL,
                        INV_TABLE_ROW_BG,
                        INV_TABLE_ROW_HOVER,
                        "sticky right-0 z-20",
                        "group-hover:z-[21]",
                        "align-top text-right"
                      )}
                      style={invoiceActionStickyStyle(actionColPx)}
                    >
                      <div
                        className={cn(
                          "flex w-full min-w-0 items-start gap-2",
                          showPrimaryActionSlot ? "justify-between" : "justify-end"
                        )}
                      >
                        {showPrimaryActionSlot && (
                          <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
                            {showReviewOffer &&
                              (canReview && onReviewInvoiceOffer ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="reviewOffer"
                                  className="h-8 w-full min-w-0 max-w-full text-xs font-medium rounded-xl"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onReviewInvoiceOffer(application.id, inv);
                                  }}
                                >
                                  Review Offer
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="reviewOffer"
                                  className="h-8 w-full min-w-0 max-w-full text-xs font-medium rounded-xl"
                                  disabled
                                >
                                  Review Offer
                                </Button>
                              ))}
                            {showReviewOffer && inv.offer_details?.expires_at != null ? (
                              <span className="text-xs text-muted-foreground">
                                Offer valid until:{" "}
                                {format(
                                  new Date(String(inv.offer_details.expires_at)),
                                  "d MMM yyyy"
                                )}
                              </span>
                            ) : null}
                            {showMakeAmendments && (
                              <Button
                                size="sm"
                                variant="makeAmendments"
                                className="h-8 w-full min-w-0 max-w-full text-xs font-medium rounded-xl"
                                asChild
                              >
                                <Link href={`/applications/edit/${application.id}`}>
                                  Make Amendments
                                </Link>
                              </Button>
                            )}
                          </div>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 mt-0">
                              <EllipsisVerticalIcon className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            {(() => {
                              const showViewSignedInvoice =
                                !!inv.signedOfferLetterS3Key && onViewSignedInvoiceOffer;
                              const showViewReasonRemarks = issuerInvoiceCanViewReasonRemarks(inv);
                              const withdrawInvoiceDisabled =
                                !canWithdrawInvoice ||
                                !!isWithdrawInvoicePending ||
                                !!showViewSignedInvoice;
                              return (
                                <>
                                  {showViewSignedInvoice && (
                                    <>
                                      <DropdownMenuItem
                                        className="cursor-pointer"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void onViewSignedInvoiceOffer!(
                                            inv.signedOfferLetterS3Key!
                                          );
                                        }}
                                      >
                                        View Signed Offer
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                    </>
                                  )}
                                  {showViewReasonRemarks && (
                                    <>
                                      <DropdownMenuItem
                                        className="cursor-pointer"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setReasonRemarksBody(
                                            inv.reasonOrRemarks?.trim() ||
                                              "No reason were recorded for this invoice."
                                          );
                                          setReasonRemarksOpen(true);
                                        }}
                                      >
                                        View reason
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                    </>
                                  )}
                                  <DropdownMenuItem
                                    className="cursor-pointer"
                                    disabled={withdrawInvoiceDisabled}
                                    onClick={() => {
                                      if (
                                        canWithdrawInvoice &&
                                        !isWithdrawInvoicePending &&
                                        !showViewSignedInvoice &&
                                        onWithdrawInvoice
                                      ) {
                                        onWithdrawInvoice(
                                          inv.id,
                                          application.id,
                                          application.issuerOrganizationId
                                        );
                                      }
                                    }}
                                    title={
                                      showViewSignedInvoice
                                        ? "Withdraw is not available while a signed offer letter is on file"
                                        : !canWithdrawInvoice
                                          ? "Cannot withdraw: invoice is already approved, rejected, or withdrawn"
                                          : isWithdrawInvoicePending
                                            ? "Withdrawal in progress"
                                            : undefined
                                    }
                                  >
                                    {isWithdrawInvoicePending
                                      ? "Withdrawing..."
                                      : "Withdraw Invoice"}
                                  </DropdownMenuItem>
                                </>
                              );
                            })()}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </table>
      </ScrollableInvoiceTableWrapper>
      <Dialog open={reasonRemarksOpen} onOpenChange={setReasonRemarksOpen}>
        <DialogContent className="rounded-xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reason</DialogTitle>
          </DialogHeader>
          <p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-foreground">
            {reasonRemarksBody}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
