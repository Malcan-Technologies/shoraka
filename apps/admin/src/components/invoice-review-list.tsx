"use client";

import * as React from "react";
import {
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { format } from "date-fns";
import { formatCurrency } from "@cashsouk/config";
import { ItemActionDropdown } from "@/components/application-review/item-action-dropdown";
import { ReviewStepStatusBadge } from "@/components/application-review/review-step-status-badge";

interface InvoiceReviewListProps {
  invoices: { id: string; details?: unknown }[];
  reviewItems: { item_type: string; item_id: string; status: string }[];
  isReviewable: boolean;
  onApproveItem: (itemId: string) => Promise<void>;
  onRejectItem: (itemId: string) => void;
  onRequestAmendmentItem: (itemId: string) => void;
  onResetItemToPending?: (itemId: string) => void;
  isItemActionPending: boolean;
}

function getItemStatus(
  reviewItems: { item_type: string; item_id: string; status: string }[],
  itemId: string
): string {
  return (
    reviewItems.find((r) => r.item_type === "invoice" && r.item_id === itemId)
      ?.status ?? "PENDING"
  );
}

export function InvoiceList({
  invoices,
  reviewItems,
  isReviewable,
  onApproveItem,
  onRejectItem,
  onRequestAmendmentItem,
  onResetItemToPending,
  isItemActionPending,
}: InvoiceReviewListProps) {
  return (
    <div className="divide-y">
      {invoices.map((inv, idx) => {
        const details = inv.details as { number?: string; value?: string; customer_name?: string; financing_ratio_percent?: string; due_date?: string } | undefined;
        const label = `Invoice #${details?.number ?? idx + 1}`;
        const status = getItemStatus(reviewItems, inv.id);
        return (
          <div
            key={inv.id}
            className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
          >
            <div className="flex items-center gap-3">
              <DocumentTextIcon className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <span className="text-sm font-medium block">{label}</span>
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(parseFloat(String(details?.value || 0)))} · {details?.customer_name || "N/A"} ·{" "}
                  {details?.due_date
                    ? format(new Date(details.due_date), "dd MMM yyyy")
                    : "N/A"}
                </span>
              </div>
              {status !== "PENDING" && (
                <ReviewStepStatusBadge status={status} />
              )}
            </div>
            <div className="flex items-center gap-2">
              {isReviewable && (
                <ItemActionDropdown
                  itemId={inv.id}
                  status={status}
                  isPending={isItemActionPending}
                  onApprove={onApproveItem}
                  onReject={onRejectItem}
                  onRequestAmendment={onRequestAmendmentItem}
                  onResetToPending={onResetItemToPending}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
