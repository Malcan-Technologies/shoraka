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
import { ArrowDownTrayIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { reviewCardTitleClass, reviewEmptyStateClass } from "../review-section-styles";
import { DocumentList } from "../document-list";
import { SupportingDocumentsComparisonLayout } from "../comparison-document-pair";
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
  hideSectionComments?: boolean;
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
  hideSectionComments = false,
}: DocumentsSectionProps) {
  if (sectionComparison) {
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
          {!hideSectionComments ? (
            <SectionComments comments={comments} onSubmitComment={onAddComment} />
          ) : null}
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
        {!hideSectionComments ? (
          <SectionComments comments={comments} onSubmitComment={onAddComment} />
        ) : null}
      </CardContent>
    </Card>
  );
}
