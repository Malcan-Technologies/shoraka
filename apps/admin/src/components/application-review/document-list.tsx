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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
  ArrowTopRightOnSquareIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import {
  SUPPORTING_DOC_CATEGORY_KEYS,
  SUPPORTING_DOC_CATEGORY_LABELS,
} from "@/app/settings/products/workflow-builder/product-form-helpers";

type DocItem = { key: string; label: string; s3Key?: string };
type CategoryGroup = { categoryKey: string; categoryLabel: string; items: DocItem[] };

function buildCategoryGroups(documents: unknown): CategoryGroup[] {
  if (typeof documents !== "object") return [];
  const raw = (documents as Record<string, unknown>)?.supporting_documents ?? documents;
  if (Array.isArray(raw)) {
    const items: DocItem[] = raw.map((d: Record<string, unknown>, i: number) => {
      const file = d?.file as { s3_key?: string } | undefined;
      return {
        key: `doc:${i}:${String(d?.name ?? d?.title ?? "document")}`,
        label: String(d?.name ?? d?.title ?? `Document ${i + 1}`),
        s3Key: file?.s3_key ?? (d?.s3_key as string | undefined),
      };
    });
    return items.length > 0 ? [{ categoryKey: "others", categoryLabel: "Others", items }] : [];
  }
  if (typeof raw !== "object" || raw === null) return [];

  const cats = (raw as Record<string, unknown>).categories;
  if (Array.isArray(cats)) {
    const labelToKey: Record<string, string> = {};
    SUPPORTING_DOC_CATEGORY_KEYS.forEach((k) => {
      labelToKey[SUPPORTING_DOC_CATEGORY_LABELS[k]] = k;
    });
    const groups: CategoryGroup[] = [];
    cats.forEach((cat: Record<string, unknown>, catIndex: number) => {
      const categoryLabel = String(cat?.name ?? `Category ${catIndex + 1}`);
      const categoryKey = labelToKey[categoryLabel] ?? `cat_${catIndex}`;
      const docList = Array.isArray(cat?.documents) ? cat.documents : [];
      const items: DocItem[] = docList.map((d: Record<string, unknown>, docIndex: number) => {
        const file = d?.file as { file_name?: string; s3_key?: string } | undefined;
        const label =
          String(d?.title ?? file?.file_name ?? d?.name ?? "").trim() ||
          `Document ${docIndex + 1}`;
        const slug = label.replace(/[^a-z0-9]/gi, "_").slice(0, 32) || "doc";
        return {
          key: `doc:${categoryKey}:${docIndex}:${slug}`,
          label,
          s3Key: file?.s3_key ?? (d?.s3_key as string | undefined),
        };
      });
      if (items.length > 0) {
        groups.push({ categoryKey, categoryLabel, items });
      }
    });
    if (groups.length > 0) return groups;
  }

  const groups: CategoryGroup[] = [];
  for (const categoryKey of SUPPORTING_DOC_CATEGORY_KEYS) {
    const val = (raw as Record<string, unknown>)[categoryKey];
    if (val == null) continue;
    const arr = Array.isArray(val) ? val : [val];
    const items: DocItem[] = arr.map((d: Record<string, unknown>, i: number) => {
      const file = d?.file as { s3_key?: string } | undefined;
      return {
        key: `doc:${categoryKey}:${i}:${String(d?.name ?? d?.title ?? "doc")}`,
        label: String(d?.name ?? d?.title ?? `${categoryKey} ${i + 1}`),
        s3Key: file?.s3_key ?? (d?.s3_key as string | undefined),
      };
    });
    if (items.length > 0) {
      groups.push({
        categoryKey,
        categoryLabel: SUPPORTING_DOC_CATEGORY_LABELS[categoryKey] ?? categoryKey,
        items,
      });
    }
  }
  return groups;
}

export interface DocumentListProps {
  documents: unknown;
  reviewItems: { item_type: string; item_id: string; status: string }[];
  isReviewable: boolean;
  onViewDocument?: (s3Key: string) => void;
  onApproveItem: (itemId: string) => Promise<void>;
  onRejectItem: (itemId: string) => void;
  onRequestAmendmentItem: (itemId: string) => void;
  isItemActionPending: boolean;
  isViewDocumentPending?: boolean;
}

export function DocumentList({
  documents,
  reviewItems,
  isReviewable,
  onViewDocument,
  onApproveItem,
  onRejectItem,
  onRequestAmendmentItem,
  isItemActionPending,
  isViewDocumentPending,
}: DocumentListProps) {
  const categoryGroups = React.useMemo(() => buildCategoryGroups(documents), [documents]);

  const getItemStatus = (key: string) =>
    reviewItems.find((r) => r.item_type === "DOCUMENT" && r.item_id === key)?.status ?? "PENDING";

  const totalItems = categoryGroups.reduce((acc, g) => acc + g.items.length, 0);
  if (totalItems === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No document entries in supporting documents.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {categoryGroups.map(({ categoryKey, categoryLabel, items }) => (
        <Collapsible key={categoryKey} defaultOpen>
          <div className="rounded-xl border">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="group flex w-full items-center gap-2 px-4 py-3 text-left text-base font-semibold hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-0 focus-visible:bg-muted/50 transition-colors rounded-t-xl [&[data-state=open]]:rounded-b-none"
              >
                <ChevronDownIcon className="h-4 w-4 shrink-0 transition-transform group-data-[state=closed]:rotate-[-90deg]" />
                <DocumentArrowDownIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                {categoryLabel}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t pl-16 pr-4 py-3 space-y-3">
                {items.map(({ key, label, s3Key }) => {
                  const status = getItemStatus(key);
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-foreground">{label}</span>
                        {status !== "PENDING" && (
                          <Badge
                            variant={status === "APPROVED" ? "default" : "secondary"}
                            className={status === "APPROVED" ? "bg-primary text-primary-foreground" : ""}
                          >
                            {status}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {s3Key && onViewDocument && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-lg h-9 gap-1 border-0"
                            onClick={() => onViewDocument(s3Key)}
                            disabled={isViewDocumentPending}
                          >
                            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                            View
                          </Button>
                        )}
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
                                onClick={() => onApproveItem(key)}
                              >
                                <CheckCircleIcon className="h-4 w-4 mr-2" />
                                Approve
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="rounded-lg text-destructive focus:text-destructive"
                                onClick={() => onRejectItem(key)}
                              >
                                <XCircleIcon className="h-4 w-4 mr-2" />
                                Reject (leave remark)
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="rounded-lg"
                                onClick={() => onRequestAmendmentItem(key)}
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
            </CollapsibleContent>
          </div>
        </Collapsible>
      ))}
    </div>
  );
}
