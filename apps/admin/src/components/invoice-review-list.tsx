"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  DocumentTextIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { format } from "date-fns";
import { formatCurrency } from "@cashsouk/config";

interface InvoiceReviewListProps {
  invoices: { id: string; details?: unknown }[];
  reviewItems: { item_type: string; item_id: string; status: string }[];
  isReviewable: boolean;
  onApproveItem: (itemId: string) => Promise<void>;
  onRejectItem: (itemId: string) => void;
  onRequestAmendmentItem: (itemId: string) => void;
  isItemActionPending: boolean;
}

function getItemStatus(
  reviewItems: { item_type: string; item_id: string; status: string }[],
  itemId: string
): string {
  return (
    reviewItems.find((r) => r.item_type === "INVOICE" && r.item_id === itemId)
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
                <Badge
                  variant={status === "APPROVED" ? "default" : "secondary"}
                  className={
                    status === "APPROVED" ? "bg-primary text-primary-foreground" : ""
                  }
                >
                  {status}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isReviewable && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg h-9 gap-1"
                      disabled={isItemActionPending}
                    >
                      Action
                      <ChevronDownIcon className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl">
                    <DropdownMenuItem
                      className="rounded-lg"
                      onClick={() => onApproveItem(inv.id)}
                    >
                      <CheckCircleIcon className="h-4 w-4 mr-2" />
                      Approve
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="rounded-lg text-destructive focus:text-destructive"
                      onClick={() => onRejectItem(inv.id)}
                    >
                      <XCircleIcon className="h-4 w-4 mr-2" />
                      Reject (leave remark)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="rounded-lg"
                      onClick={() => onRequestAmendmentItem(inv.id)}
                    >
                      <DocumentTextIcon className="h-4 w-4 mr-2" />
                      Request Amendment
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
