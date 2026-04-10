"use client";

/**
 * SECTION: Supporting documents card — live review list or resubmit comparison
 * WHY: Comparison reuses the same category grouping as DocumentList without field-value rows.
 * INPUT: supporting_documents payload; optional before/after snapshots for modal
 * OUTPUT: Card with DocumentList or comparison panels
 * WHERE USED: Application review Supporting Documents tab
 */

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowDownTrayIcon,
  ChevronDownIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { SUPPORTING_DOC_CATEGORY_KEYS } from "@/app/settings/products/workflow-builder/product-form-helpers";
import { cn } from "@/lib/utils";
import { reviewCardTitleClass, reviewEmptyStateClass } from "../review-section-styles";
import { buildCategoryGroups, DocumentList, type DocFile } from "../document-list";
import { SectionComments, type SectionCommentItem } from "../section-comments";
import { Button } from "@/components/ui/button";

type SupportingDocFile = {
  s3Key: string;
  fileName: string;
  category: string;
  field: string;
};

export function collectSupportingDocumentFiles(input: unknown): SupportingDocFile[] {
  if (!input || typeof input !== "object") return [];
  const raw = (input as Record<string, unknown>)?.supporting_documents ?? input;
  const files: SupportingDocFile[] = [];
  const seen = new Set<string>();

  const pushFile = (
    s3Key: unknown,
    fileName: unknown,
    fallbackName: string,
    category: string,
    field: string
  ) => {
    if (typeof s3Key !== "string" || !s3Key.trim()) return;
    if (seen.has(s3Key)) return;
    seen.add(s3Key);
    files.push({
      s3Key,
      fileName:
        typeof fileName === "string" && fileName.trim()
          ? fileName
          : fallbackName,
      category,
      field,
    });
  };

  const parseDocuments = (documents: unknown[], category: string) => {
    documents.forEach((doc, docIndex) => {
      const row = (doc as Record<string, unknown>) ?? {};
      const docTitle =
        String(row.title ?? row.name ?? `document-${docIndex + 1}`).trim() ||
        `document-${docIndex + 1}`;
      const fallbackSingleName = `${docTitle}.pdf`;
      const field = docTitle;

      const single = row.file as Record<string, unknown> | undefined;
      pushFile(single?.s3_key, single?.file_name, fallbackSingleName, category, field);

      const multiple = Array.isArray(row.files) ? (row.files as Array<Record<string, unknown>>) : [];
      multiple.forEach((f, fileIndex) => {
        const fileNameFallback = `${docTitle}-${fileIndex + 1}.pdf`;
        pushFile(f?.s3_key, f?.file_name, fileNameFallback, category, field);
      });
    });
  };

  if (Array.isArray(raw)) {
    parseDocuments(raw, "Others");
    return files;
  }

  if (typeof raw !== "object" || raw === null) return files;
  const obj = raw as Record<string, unknown>;

  if (Array.isArray(obj.categories)) {
    (obj.categories as Array<Record<string, unknown>>).forEach((cat, catIndex) => {
      const categoryName =
        String(cat?.name ?? `Category ${catIndex + 1}`).trim() ||
        `Category ${catIndex + 1}`;
      const documents = Array.isArray(cat?.documents) ? (cat.documents as unknown[]) : [];
      parseDocuments(documents, categoryName);
    });
    return files;
  }

  const knownCategories = ["financial_docs", "legal_docs", "compliance_docs", "others"];
  for (const category of knownCategories) {
    const rows = obj[category];
    if (rows == null) continue;
    const docs = Array.isArray(rows) ? rows : [rows];
    const label = category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    parseDocuments(docs as unknown[], label);
  }

  return files;
}

function fileListSignature(files: DocFile[]): string {
  return [...files]
    .map((f) => `${f.s3Key}\t${f.label}`)
    .sort()
    .join("\n");
}

function SupportingDocumentsComparisonLayout({
  beforeDocs,
  afterDocs,
}: {
  beforeDocs: unknown;
  afterDocs: unknown;
}) {
  const beforeGroups = React.useMemo(() => buildCategoryGroups(beforeDocs), [beforeDocs]);
  const afterGroups = React.useMemo(() => buildCategoryGroups(afterDocs), [afterDocs]);
  const beforeByKey = React.useMemo(
    () => new Map(beforeGroups.map((g) => [g.categoryKey, g])),
    [beforeGroups]
  );
  const afterByKey = React.useMemo(
    () => new Map(afterGroups.map((g) => [g.categoryKey, g])),
    [afterGroups]
  );
  const categoryKeys = Array.from(new Set([...beforeByKey.keys(), ...afterByKey.keys()]));
  const order = SUPPORTING_DOC_CATEGORY_KEYS;
  categoryKeys.sort((a, b) => {
    const ia = order.indexOf(a as (typeof order)[number]);
    const ib = order.indexOf(b as (typeof order)[number]);
    if (ia === -1 && ib === -1) return String(a).localeCompare(String(b));
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  console.log("SupportingDocumentsComparisonLayout categories:", categoryKeys.length);

  if (categoryKeys.length === 0) {
    return <p className={reviewEmptyStateClass}>No supporting documents in these snapshots.</p>;
  }

  return (
    <div className="space-y-2">
      {categoryKeys.map((categoryKey) => {
        const bG = beforeByKey.get(categoryKey);
        const aG = afterByKey.get(categoryKey);
        const categoryLabel = bG?.categoryLabel ?? aG?.categoryLabel ?? String(categoryKey);
        const bItems = bG?.items ?? [];
        const aItems = aG?.items ?? [];
        const maxLen = Math.max(bItems.length, aItems.length);
        return (
          <Collapsible key={String(categoryKey)} defaultOpen>
            <div className="rounded-xl border border-border">
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
                <div className="border-t border-border pl-4 sm:pl-12 pr-4 py-4 space-y-6">
                  {Array.from({ length: maxLen }, (_, i) => {
                    const bi = bItems[i];
                    const ai = aItems[i];
                    const title = bi?.label ?? ai?.label ?? `Document ${i + 1}`;
                    const rowChanged = fileListSignature(bi?.files ?? []) !== fileListSignature(ai?.files ?? []);
                    return (
                      <div
                        key={`${String(categoryKey)}-${i}-${bi?.key ?? ""}-${ai?.key ?? ""}`}
                        className={cn(rowChanged && "border-l-4 border-l-accent pl-3 -ml-1 rounded-r-md")}
                      >
                        <p className="text-sm font-medium text-foreground mb-3">{title}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-0">
                          <div className="md:pr-4 md:border-r md:border-border space-y-2 min-w-0">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              Before
                            </p>
                            <SupportingDocFileChips files={bi?.files ?? []} emptyLabel="—" />
                          </div>
                          <div className="md:pl-4 space-y-2 min-w-0 pt-4 md:pt-0">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              After
                            </p>
                            <SupportingDocFileChips files={ai?.files ?? []} emptyLabel="—" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}

function SupportingDocFileChips({
  files,
  emptyLabel,
}: {
  files: DocFile[];
  emptyLabel: string;
}) {
  if (files.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-2">
      {files.map((f, idx) => (
        <li
          key={`${f.s3Key}-${idx}`}
          className="flex items-start gap-2 rounded-lg border border-border/80 bg-muted/35 px-3 py-2"
        >
          <DocumentTextIcon className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <span className="text-sm text-foreground break-all">{f.label || f.s3Key}</span>
        </li>
      ))}
    </ul>
  );
}

export interface DocumentsSectionProps {
  supportingDocuments: unknown;
  reviewItems: { item_type: string; item_id: string; status: string }[];
  isReviewable: boolean;
  approvePending: boolean;
  isActionLocked?: boolean;
  actionLockTooltip?: string;
  viewDocumentPending: boolean;
  onViewDocument: (s3Key: string) => void;
  onDownloadDocument: (s3Key: string, fileName?: string) => void;
  onDownloadAllDocuments: (files: SupportingDocFile[]) => Promise<void> | void;
  isDownloadAllPending?: boolean;
  onApproveItem: (itemId: string) => Promise<void>;
  onRejectItem: (itemId: string) => void;
  onRequestAmendmentItem: (itemId: string) => void;
  onResetItemToPending?: (itemId: string) => void;
  comments: SectionCommentItem[];
  onAddComment?: (comment: string) => Promise<void> | void;
  sectionComparison?: {
    beforeDocs: unknown;
    afterDocs: unknown;
    isPathChanged: (path: string) => boolean;
  };
}

export function DocumentsSection({
  supportingDocuments,
  reviewItems,
  isReviewable,
  approvePending,
  isActionLocked,
  actionLockTooltip,
  viewDocumentPending,
  onViewDocument,
  onDownloadDocument,
  onDownloadAllDocuments,
  isDownloadAllPending = false,
  onApproveItem,
  onRejectItem,
  onRequestAmendmentItem,
  onResetItemToPending,
  comments,
  onAddComment,
  sectionComparison,
}: DocumentsSectionProps) {
  if (sectionComparison) {
    console.log("DocumentsSection comparison mode");
    const { beforeDocs, afterDocs } = sectionComparison;
    return (
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="h-5 w-5 text-primary" />
            <CardTitle className={reviewCardTitleClass}>Supporting Documents</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <SupportingDocumentsComparisonLayout beforeDocs={beforeDocs} afterDocs={afterDocs} />
          <SectionComments comments={comments} onSubmitComment={onAddComment} />
        </CardContent>
      </Card>
    );
  }

  const downloadableFiles = React.useMemo(
    () => collectSupportingDocumentFiles(supportingDocuments),
    [supportingDocuments]
  );

  const peerDocumentRejected = reviewItems.some(
    (r) => r.item_type === "document" && r.status === "REJECTED"
  );

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="h-5 w-5 text-primary" />
            <CardTitle className={reviewCardTitleClass}>Supporting Documents</CardTitle>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => onDownloadAllDocuments(downloadableFiles)}
            disabled={isDownloadAllPending || downloadableFiles.length === 0}
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            {isDownloadAllPending ? "Preparing ZIP..." : "Download all"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-10">
        {supportingDocuments && typeof supportingDocuments === "object" ? (
          <DocumentList
            documents={supportingDocuments}
            reviewItems={reviewItems}
            isReviewable={!!isReviewable}
            onViewDocument={onViewDocument}
            onDownloadDocument={onDownloadDocument}
            onApproveItem={onApproveItem}
            onRejectItem={onRejectItem}
            onRequestAmendmentItem={onRequestAmendmentItem}
            onResetItemToPending={onResetItemToPending}
            isItemActionPending={approvePending}
            isViewDocumentPending={viewDocumentPending}
            isActionLocked={isActionLocked}
            actionLockTooltip={actionLockTooltip}
            lockItemPrimaryReviewActions={peerDocumentRejected}
          />
        ) : (
          <p className={reviewEmptyStateClass}>No supporting documents submitted.</p>
        )}
        <SectionComments comments={comments} onSubmitComment={onAddComment} />
      </CardContent>
    </Card>
  );
}
