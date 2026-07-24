/**
 * Admin Acceptance tab: single review card — offer acceptance, acceptance documents,
 * then signing package (with inline signed View/Download on each document).
 */
"use client";

import * as React from "react";
import { format } from "date-fns";
import { ArrowDownTrayIcon, ClockIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { CheckIcon } from "@heroicons/react/24/solid";
import { Progress } from "@cashsouk/ui";
import {
  getOfferAcceptanceFromOfferDetails,
  getOfferAcceptanceStatusPresentation,
  getOfferPhaseDeadlineDisplay,
  resolveOfferAcknowledgementsFromWorkflow,
  type ApplicationPersonRow,
  type OfferAcceptanceStatus,
} from "@cashsouk/types";
import { Badge } from "@/components/ui/badge";
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

/** Match Signing package status badge language — distinct hues for admin scan. */
const OFFER_ACCEPTANCE_STATUS_STYLES: Record<OfferAcceptanceStatus, string> = {
  PENDING_ISSUER: "bg-amber-100 text-amber-800",
  PENDING_ADMIN_REVIEW: "bg-sky-100 text-sky-800",
  CHANGES_REQUESTED: "bg-amber-100 text-amber-800",
  REJECTED: "bg-primary/10 text-primary",
  DECLINED: "bg-muted text-muted-foreground",
  APPROVED_FOR_SIGNING: "bg-emerald-100 text-emerald-800",
  SIGNING_IN_PROGRESS: "bg-indigo-100 text-indigo-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
};
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

function hasAcceptanceDocumentUploads(supportingDocuments: unknown): boolean {
  return collectAcceptanceDownloadFiles(supportingDocuments).length > 0;
}

/** Show Acceptance documents once the issuer has submitted (or uploads already exist). */
function isAcceptanceDocumentsSectionActive(
  offerDetails: unknown,
  supportingDocuments: unknown
): boolean {
  if (hasAcceptanceDocumentUploads(supportingDocuments)) return true;
  const acceptance = getOfferAcceptanceFromOfferDetails(offerDetails);
  if (!acceptance) return false;
  switch (acceptance.status) {
    case "PENDING_ADMIN_REVIEW":
    case "CHANGES_REQUESTED":
    case "APPROVED_FOR_SIGNING":
    case "SIGNING_IN_PROGRESS":
    case "COMPLETED":
      return true;
    default:
      return false;
  }
}

function OfferAcceptanceBlock({
  workflow,
  offerDetails,
  structureType,
  documentsSlot,
  documentsHeaderRight,
}: {
  workflow: unknown;
  offerDetails: unknown;
  structureType?: string | null;
  /** Acceptance documents list rendered inside this same package card. */
  documentsSlot?: React.ReactNode;
  /** e.g. Download all — shown beside the Acceptance documents heading. */
  documentsHeaderRight?: React.ReactNode;
}) {
  const acceptance = getOfferAcceptanceFromOfferDetails(offerDetails);
  const presentation = acceptance
    ? getOfferAcceptanceStatusPresentation(acceptance.status)
    : null;
  const configuredAcks = React.useMemo(
    () => resolveOfferAcknowledgementsFromWorkflow(workflow),
    [workflow]
  );
  const acknowledgedByKey = React.useMemo(() => {
    const map = new Map<string, { accepted_at: string }>();
    for (const ack of acceptance?.acknowledgements ?? []) {
      map.set(ack.document_key, { accepted_at: ack.accepted_at });
    }
    return map;
  }, [acceptance?.acknowledgements]);

  const isInvoiceOnly = structureType === "invoice_only";
  const emptyHint = isInvoiceOnly
    ? "Send an offer from Invoice to start acceptance."
    : "Send an offer from Contract to start acceptance.";

  const rows =
    acceptance == null
      ? []
      : configuredAcks.length > 0
        ? configuredAcks.map((doc) => ({
            key: doc.key,
            name: doc.name,
            recorded: acknowledgedByKey.get(doc.key) ?? null,
          }))
        : (acceptance.acknowledgements ?? []).map((ack) => ({
            key: ack.document_key,
            name: ack.document_key,
            recorded: { accepted_at: ack.accepted_at },
          }));

  const acknowledgedCount = rows.filter((row) => row.recorded != null).length;
  const totalCount = rows.length;
  const percent =
    totalCount > 0 ? Math.round((acknowledgedCount / totalCount) * 100) : 0;
  const deadlineDisplay = getOfferPhaseDeadlineDisplay(offerDetails);

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      {presentation && acceptance ? (
        <div className="space-y-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="truncate font-medium text-foreground">Financing offer</span>
            <Badge className={cn("font-normal", OFFER_ACCEPTANCE_STATUS_STYLES[acceptance.status])}>
              {presentation.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{presentation.hint}</p>
          {deadlineDisplay &&
          (acceptance.status === "PENDING_ISSUER" ||
            acceptance.status === "CHANGES_REQUESTED") ? (
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

          {totalCount > 0 ? (
            <>
              <div className="flex items-center gap-3">
                <Progress value={percent} className="h-2 flex-1" />
                <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                  {acknowledgedCount}/{totalCount} acknowledged ({percent}%)
                </span>
              </div>

              <div className="overflow-hidden rounded-xl border border-border bg-background">
                <ul className="divide-y divide-border">
                  {rows.map((row) => {
                    const done = row.recorded != null;
                    return (
                      <li
                        key={row.key}
                        className="flex items-start gap-3 px-3 py-2 sm:items-center"
                      >
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center sm:mt-0">
                          {done ? (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary">
                              <CheckIcon className="h-4 w-4 text-primary-foreground" />
                            </div>
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-border bg-background">
                              <ClockIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{row.name}</p>
                          {done && row.recorded ? (
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(row.recorded.accepted_at), "d MMM yyyy, h:mm a")}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Waiting for issuer</p>
                          )}
                        </div>
                        <Badge
                          className={cn(
                            "shrink-0 font-normal",
                            done
                              ? "border-transparent bg-status-success-bg text-status-success-text"
                              : "border-transparent bg-status-neutral-bg text-status-neutral-text"
                          )}
                        >
                          {done ? "Acknowledged" : "Pending"}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      )}

      {documentsSlot ? (
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-foreground">Acceptance documents</h4>
            {documentsHeaderRight}
          </div>
          {documentsSlot}
        </div>
      ) : null}
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
}: AcceptanceSectionProps) {
  const showSigningHub = typeof applicationId === "string" && applicationId.length > 0;
  const {
    signedDocumentPending,
    handleViewSignedDocument,
    handleDownloadSignedDocument,
  } = useAdminSignedSigningDocument(applicationId);

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

  const showAcceptanceDocuments = isAcceptanceDocumentsSectionActive(
    acceptanceOfferDetails,
    supportingDocuments
  );

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
        {(() => {
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
            return (
              <ReviewFieldBlock title="Offer acceptance">
                <OfferAcceptanceBlock
                  workflow={workflow}
                  offerDetails={acceptanceOfferDetails}
                  structureType={structureType}
                  documentsSlot={showAcceptanceDocuments ? documentsList : undefined}
                  documentsHeaderRight={showAcceptanceDocuments ? downloadAllButton : undefined}
                />
              </ReviewFieldBlock>
            );
          }

          if (!showAcceptanceDocuments) {
            return (
              <p className="text-sm text-muted-foreground">
                No acceptance documents to review yet.
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
