"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  ChevronDownIcon,
  DocumentArrowDownIcon,
} from "@heroicons/react/24/outline";
import {
  SUPPORTING_DOC_CATEGORY_KEYS,
  SUPPORTING_DOC_CATEGORY_LABELS,
} from "@/app/settings/products/workflow-builder/product-form-helpers";
import { ItemActionDropdown } from "./item-action-dropdown";
import { ReviewStepStatusBadge } from "./review-step-status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type DocFile = { label: string; s3Key: string };
type DocItem = { key: string; label: string; s3Key?: string; files: DocFile[] };
type CategoryGroup = { categoryKey: string; categoryLabel: string; items: DocItem[] };

function buildCategoryGroups(documents: unknown): CategoryGroup[] {
  if (typeof documents !== "object") return [];
  const raw = (documents as Record<string, unknown>)?.supporting_documents ?? documents;
  if (Array.isArray(raw)) {
    const items: DocItem[] = raw.map((d: Record<string, unknown>, i: number) => {
      const file = d?.file as { s3_key?: string } | undefined;
      const name = String(d?.name ?? d?.title ?? "document");
      const slug = name.replace(/[^a-z0-9]/gi, "_").slice(0, 32) || "doc";
      return {
        key: `supporting_documents:others:${i}:${slug}`,
        label: name || `Document ${i + 1}`,
        s3Key: file?.s3_key ?? (d?.s3_key as string | undefined),
        files:
          typeof (file?.s3_key ?? (d?.s3_key as string | undefined)) === "string" &&
          String(file?.s3_key ?? (d?.s3_key as string | undefined)).trim() !== ""
            ? [
                {
                  label: name || `Document ${i + 1}`,
                  s3Key: String(file?.s3_key ?? (d?.s3_key as string | undefined)),
                },
              ]
            : [],
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
        const files = Array.isArray(d?.files) ? (d.files as Array<{ file_name?: string; s3_key?: string }>) : [];
        const file = (d?.file as { file_name?: string; s3_key?: string } | undefined) ?? files[0];
        const viewFiles = files
          .filter((f) => typeof f?.s3_key === "string" && f.s3_key.trim() !== "")
          .map((f, fileIndex) => ({
            label: String(f.file_name ?? `File ${fileIndex + 1}`),
            s3Key: String(f.s3_key),
          }));
        if (viewFiles.length === 0 && typeof file?.s3_key === "string" && file.s3_key.trim() !== "") {
          viewFiles.push({
            label: String(file.file_name ?? `File 1`),
            s3Key: String(file.s3_key),
          });
        }
        const fileCount = files.length > 0 ? files.length : file ? 1 : 0;
        const label =
          String(d?.title ?? file?.file_name ?? d?.name ?? "").trim() ||
          `Document ${docIndex + 1}`;
        const labelWithCount =
          fileCount > 1 ? `${label} (${fileCount} files)` : label;
        const slug = label.replace(/[^a-z0-9]/gi, "_").slice(0, 32) || "doc";
        return {
          key: `supporting_documents:${categoryKey}:${docIndex}:${slug}`,
          label: labelWithCount,
          s3Key: file?.s3_key ?? (d?.s3_key as string | undefined),
          files: viewFiles,
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
      const name = String(d?.name ?? d?.title ?? "doc");
      const slug = name.replace(/[^a-z0-9]/gi, "_").slice(0, 32) || "doc";
      return {
        key: `supporting_documents:${categoryKey}:${i}:${slug}`,
        label: name || `${categoryKey} ${i + 1}`,
        s3Key: file?.s3_key ?? (d?.s3_key as string | undefined),
        files:
          typeof (file?.s3_key ?? (d?.s3_key as string | undefined)) === "string" &&
          String(file?.s3_key ?? (d?.s3_key as string | undefined)).trim() !== ""
            ? [
                {
                  label: name || `${categoryKey} ${i + 1}`,
                  s3Key: String(file?.s3_key ?? (d?.s3_key as string | undefined)),
                },
              ]
            : [],
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
  onDownloadDocument?: (s3Key: string, fileName?: string) => void;
  onApproveItem: (itemId: string) => Promise<void>;
  onRejectItem: (itemId: string) => void;
  onRequestAmendmentItem: (itemId: string) => void;
  onResetItemToPending?: (itemId: string) => void;
  isItemActionPending: boolean;
  isViewDocumentPending?: boolean;
  isActionLocked?: boolean;
  actionLockTooltip?: string;
  /** When any document was rejected, hide approve/reject/amendment on all rows (reset still allowed where applicable). */
  lockItemPrimaryReviewActions?: boolean;
}

export function DocumentList({
  documents,
  reviewItems,
  isReviewable,
  onViewDocument,
  onDownloadDocument,
  onApproveItem,
  onRejectItem,
  onRequestAmendmentItem,
  onResetItemToPending,
  isItemActionPending,
  isViewDocumentPending,
  isActionLocked,
  actionLockTooltip,
  lockItemPrimaryReviewActions = false,
}: DocumentListProps) {
  const categoryGroups = React.useMemo(() => buildCategoryGroups(documents), [documents]);

  const getItemStatus = (key: string) => {
    return reviewItems.find((r) => r.item_id === key)?.status ?? "PENDING";
  };

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
              <div className="border-t pl-12 pr-4 py-3 space-y-3">
                {items.map(({ key, label, s3Key, files }) => {
                  const status = getItemStatus(key);
                  const canViewSingle = Boolean(s3Key && onViewDocument);
                  const canViewMultiple = Boolean(onViewDocument && files.length > 1);
                  const canDownloadSingle = Boolean(s3Key && onDownloadDocument);
                  const canDownloadMultiple = Boolean(onDownloadDocument && files.length > 1);
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-3 min-w-0"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-sm text-foreground">{label}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {status !== "PENDING" && (
                          <ReviewStepStatusBadge status={status} size="sm" />
                        )}
                        {canViewSingle && !canViewMultiple && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-lg h-9 gap-1 border-0"
                            onClick={() => onViewDocument?.(s3Key!)}
                            disabled={isViewDocumentPending}
                          >
                            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                            View
                          </Button>
                        )}
                        {canViewMultiple && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-lg h-9 gap-1 border-0"
                                disabled={isViewDocumentPending}
                              >
                                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                                View
                                <ChevronDownIcon className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[220px]">
                              {files.map((f, fileIndex) => (
                                <DropdownMenuItem
                                  key={`${f.s3Key}-${fileIndex}`}
                                  onClick={() => onViewDocument?.(f.s3Key)}
                                  className="flex items-center justify-between gap-3"
                                >
                                  <span className="truncate min-w-0">{f.label}</span>
                                  <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0" />
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        {canDownloadSingle && !canDownloadMultiple && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-lg h-9 gap-1 border-0"
                            onClick={() => onDownloadDocument?.(s3Key!, label)}
                            disabled={isViewDocumentPending}
                          >
                            <ArrowDownTrayIcon className="h-4 w-4" />
                            Download
                          </Button>
                        )}
                        {canDownloadMultiple && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-lg h-9 gap-1 border-0"
                                disabled={isViewDocumentPending}
                              >
                                <ArrowDownTrayIcon className="h-4 w-4" />
                                Download
                                <ChevronDownIcon className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[220px]">
                              {files.map((f, fileIndex) => (
                                <DropdownMenuItem
                                  key={`${f.s3Key}-${fileIndex}-download`}
                                  onClick={() => onDownloadDocument?.(f.s3Key, f.label)}
                                  className="flex items-center justify-between gap-3"
                                >
                                  <span className="truncate min-w-0">{f.label}</span>
                                  <ArrowDownTrayIcon className="h-4 w-4 shrink-0" />
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        {isReviewable && (
                          <ItemActionDropdown
                            itemId={key}
                            status={status}
                            isPending={isItemActionPending}
                            isActionLocked={isActionLocked}
                            actionLockTooltip={actionLockTooltip}
                            showApprove={!lockItemPrimaryReviewActions}
                            showReject={!lockItemPrimaryReviewActions}
                            showRequestAmendment={!lockItemPrimaryReviewActions}
                            noActionsTooltip={
                              lockItemPrimaryReviewActions && status === "PENDING"
                                ? "Another document was rejected. Clear that rejection or use Set to Pending on it, or reset the whole section."
                                : undefined
                            }
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
            </CollapsibleContent>
          </div>
        </Collapsible>
      ))}
    </div>
  );
}
