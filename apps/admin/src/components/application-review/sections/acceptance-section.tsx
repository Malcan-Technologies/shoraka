/**
 * Admin Acceptance tab: single review card — offer acceptance, acceptance documents,
 * then signing package (with inline signed View/Download on each document).
 */
"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownTrayIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import {
  getOfferAcceptanceFromOfferDetails,
  getOfferAcceptanceStatusPresentation,
  getOfferPhaseDeadlineDisplay,
  isOfferAcceptanceDocumentsVisibleToAdmin,
  workflowHasAcceptanceDocuments,
  type ApplicationPersonRow,
} from "@cashsouk/types";
import { StatusBadge } from "@cashsouk/ui";
import { getAdminStatusToken } from "@/lib/admin-status-token";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentsSection } from "./documents-section";
import {
  SigningEnvelopePanel,
  resolveAcceptanceOfferDetails,
} from "../signing/signing-envelope-panel";
import { ReviewFieldBlock } from "../review-field-block";
import { SectionComments, type SectionCommentItem } from "../section-comments";
import { reviewCardTitleClass } from "../review-section-styles";
import { useAdminSignedSigningDocument } from "@/hooks/use-admin-signed-signing-document";
import { cn } from "@/lib/utils";

export type AcceptanceSectionProps = {
  supportingDocuments: unknown;
  reviewItems: { item_type: string; item_id: string; status: string }[];
  isReviewable: boolean;
  approvePending: boolean;
  isActionLocked?: boolean;
  actionLockTooltip?: string;
  viewDocumentPending: boolean;
  onViewDocument: (s3Key: string) => void;
  onDownloadDocument: (s3Key: string, fileName?: string) => void;
  onDownloadAllDocuments: (
    files: { s3Key: string; fileName: string; category: string; field: string }[]
  ) => Promise<void> | void;
  isDownloadAllPending?: boolean;
  onApproveItem: (itemId: string) => Promise<void>;
  onRejectItem: (itemId: string) => void;
  onRequestAmendmentItem: (itemId: string) => void;
  onResetItemToPending?: (itemId: string) => void;
  comments: SectionCommentItem[];
  onAddComment?: (comment: string) => Promise<void> | void;
  hideSectionComments?: boolean;
  /** Live review only — when set, show offer-acceptance + signing hub. */
  applicationId?: string;
  workflow?: unknown;
  people?: ApplicationPersonRow[];
  guarantors?: unknown;
  contractId?: string | null;
  productVersion?: number | null;
  canManageSigning?: boolean;
  contractOfferDetails?: unknown;
  invoices?: { id: string; offer_details?: unknown }[];
  structureType?: string | null;
  acceptanceReviewMode?: "live" | "inherited";
  inheritedSourceApplication?: { id: string; productId: string | null };
};

function collectAcceptanceDownloadFiles(
  supportingDocuments: unknown
): { s3Key: string; fileName: string; category: string; field: string }[] {
  const root = supportingDocuments as Record<string, unknown> | null;
  const list = Array.isArray(root?.documents)
    ? (root!.documents as Record<string, unknown>[])
    : [];
  const files: { s3Key: string; fileName: string; category: string; field: string }[] = [];
  list.forEach((doc, i) => {
    const title = String(doc.title ?? doc.name ?? `document-${i + 1}`);
    const single = doc.file as Record<string, unknown> | undefined;
    if (typeof single?.s3_key === "string" && single.s3_key) {
      files.push({
        s3Key: single.s3_key,
        fileName: String(single.file_name ?? `${title}.pdf`),
        category: "Acceptance Documents",
        field: title,
      });
    }
    const multiple = Array.isArray(doc.files) ? (doc.files as Array<Record<string, unknown>>) : [];
    multiple.forEach((f, fileIndex) => {
      if (typeof f?.s3_key === "string" && f.s3_key) {
        files.push({
          s3Key: f.s3_key,
          fileName: String(f.file_name ?? `${title}-${fileIndex + 1}.pdf`),
          category: "Acceptance Documents",
          field: title,
        });
      }
    });
  });
  return files;
}

/** Show Acceptance documents only after issuer Submit — not draft uploads while PENDING_ISSUER. */
function isAcceptanceDocumentsSectionActive(offerDetails: unknown): boolean {
  return isOfferAcceptanceDocumentsVisibleToAdmin(
    getOfferAcceptanceFromOfferDetails(offerDetails)
  );
}

function OfferAcceptanceBlock({
  offerDetails,
  structureType,
  documentsSlot,
}: {
  offerDetails: unknown;
  structureType?: string | null;
  /** Acceptance documents list rendered inside this same package card. */
  documentsSlot?: React.ReactNode;
}) {
  const acceptance = getOfferAcceptanceFromOfferDetails(offerDetails);
  const isInvoiceOnly = structureType === "invoice_only";
  const emptyHint = isInvoiceOnly
    ? "Send an offer from Invoice to start acceptance."
    : "Send an offer from Contract to start acceptance.";
  const deadlineDisplay = getOfferPhaseDeadlineDisplay(offerDetails);
  const showDeadline =
    acceptance &&
    deadlineDisplay &&
    (acceptance.status === "PENDING_ISSUER" || acceptance.status === "CHANGES_REQUESTED");

  return (
    <div className="space-y-4">
      {showDeadline ? (
        <p
          className={cn(
            "text-sm",
            deadlineDisplay.urgency === "past"
              ? "font-medium text-destructive"
              : deadlineDisplay.urgency === "soon"
                ? "font-medium text-amber-800"
                : "text-muted-foreground"
          )}
        >
          {deadlineDisplay.summary}
        </p>
      ) : null}

      {documentsSlot ? (
        documentsSlot
      ) : acceptance ? (
        <p className="text-sm text-muted-foreground">
          Acceptance documents appear here after the issuer submits them.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      )}
    </div>
  );
}

export function AcceptanceSection({
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
  hideSectionComments = false,
  applicationId,
  workflow,
  people = [],
  guarantors,
  contractId,
  productVersion,
  canManageSigning = true,
  contractOfferDetails,
  invoices = [],
  structureType,
  acceptanceReviewMode = "live",
  inheritedSourceApplication,
}: AcceptanceSectionProps) {
  const isInheritedAcceptance = acceptanceReviewMode === "inherited";
  const showSigningHub = typeof applicationId === "string" && applicationId.length > 0;
  const {
    signedDocumentPending,
    handleViewSignedDocument,
    handleDownloadSignedDocument,
  } = useAdminSignedSigningDocument(applicationId ?? "");

  const acceptanceOfferDetails = React.useMemo(
    () =>
      resolveAcceptanceOfferDetails({
        offerDetails: contractOfferDetails,
        invoices,
      }),
    [contractOfferDetails, invoices]
  );

  const downloadableFiles = React.useMemo(
    () => collectAcceptanceDownloadFiles(supportingDocuments),
    [supportingDocuments]
  );

  const productHasAcceptanceDocuments = workflowHasAcceptanceDocuments(workflow);
  const showAcceptanceDocuments =
    productHasAcceptanceDocuments &&
    (isInheritedAcceptance || isAcceptanceDocumentsSectionActive(acceptanceOfferDetails));

  const inheritedSourceHref =
    inheritedSourceApplication?.productId && inheritedSourceApplication.id
      ? `/applications/${encodeURIComponent(inheritedSourceApplication.productId)}/${encodeURIComponent(inheritedSourceApplication.id)}`
      : null;

  const downloadAllButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="shrink-0 gap-1.5 rounded-lg px-3"
      onClick={() => onDownloadAllDocuments(downloadableFiles)}
      disabled={isDownloadAllPending || downloadableFiles.length === 0}
    >
      <ArrowDownTrayIcon className="h-4 w-4" />
      {isDownloadAllPending ? "Preparing ZIP..." : "Download all"}
    </Button>
  );

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <DocumentTextIcon className="h-5 w-5 text-primary" />
          <CardTitle className={reviewCardTitleClass}>Acceptance</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-10">
        {isInheritedAcceptance ? (
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Acceptance and signing were completed when this contract was approved
            {inheritedSourceHref ? (
              <>
                {" "}
                in{" "}
                <Link
                  href={inheritedSourceHref}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  the originating application
                </Link>
              </>
            ) : (
              " in the originating application"
            )}
            . This view is read-only.
          </div>
        ) : null}
        {(() => {
          if (showSigningHub && !productHasAcceptanceDocuments) {
            return null;
          }

          const documentsList = (
            <DocumentsSection
              supportingDocuments={supportingDocuments}
              documentKind="acceptance"
              reviewItems={reviewItems}
              isReviewable={isReviewable}
              approvePending={approvePending}
              isActionLocked={isActionLocked}
              actionLockTooltip={actionLockTooltip}
              viewDocumentPending={viewDocumentPending}
              onViewDocument={onViewDocument}
              onDownloadDocument={onDownloadDocument}
              onDownloadAllDocuments={onDownloadAllDocuments}
              isDownloadAllPending={isDownloadAllPending}
              onApproveItem={onApproveItem}
              onRejectItem={onRejectItem}
              onRequestAmendmentItem={onRequestAmendmentItem}
              onResetItemToPending={onResetItemToPending}
              comments={comments}
              hideSectionComments
              embedded
              hideDownloadAll
            />
          );

          if (showSigningHub) {
            const acceptance = getOfferAcceptanceFromOfferDetails(acceptanceOfferDetails);
            const presentation = acceptance
              ? getOfferAcceptanceStatusPresentation(acceptance.status)
              : null;
            return (
              <ReviewFieldBlock
                title="Acceptance documents"
                titleAside={
                  presentation && acceptance ? (
                    <StatusBadge
                      label={presentation.label}
                      status={getAdminStatusToken(acceptance.status)}
                    />
                  ) : null
                }
                titleEnd={showAcceptanceDocuments ? downloadAllButton : undefined}
              >
                <OfferAcceptanceBlock
                  offerDetails={acceptanceOfferDetails}
                  structureType={structureType}
                  documentsSlot={showAcceptanceDocuments ? documentsList : undefined}
                />
              </ReviewFieldBlock>
            );
          }

          if (!productHasAcceptanceDocuments || !showAcceptanceDocuments) {
            return (
              <p className="text-sm text-muted-foreground">
                {productHasAcceptanceDocuments
                  ? "No acceptance documents to review yet."
                  : "No acceptance documents are configured for this product."}
              </p>
            );
          }

          return (
            <ReviewFieldBlock title="Acceptance documents">
              <div className="space-y-3">
                <div className="-mt-1 flex justify-end">{downloadAllButton}</div>
                {documentsList}
              </div>
            </ReviewFieldBlock>
          );
        })()}

        {showSigningHub ? (
          <ReviewFieldBlock title="Signing package">
            <SigningEnvelopePanel
              applicationId={applicationId}
              workflow={workflow}
              people={people}
              guarantors={guarantors}
              contractId={contractId}
              productVersion={productVersion}
              canManage={canManageSigning}
              offerDetails={contractOfferDetails}
              invoices={invoices}
              showOfferAcceptanceSummary={false}
              structureType={structureType}
              embedded
              signedDocumentPending={signedDocumentPending}
              onViewSignedDocument={handleViewSignedDocument}
              onDownloadSignedDocument={handleDownloadSignedDocument}
            />
          </ReviewFieldBlock>
        ) : null}

        {!hideSectionComments ? (
          <SectionComments comments={comments} onSubmitComment={onAddComment} />
        ) : null}
      </CardContent>
    </Card>
  );
}
