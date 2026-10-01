"use client";

/**
 * SECTION: Full-screen admin modal comparing two application revision snapshots
 * WHY: Mirrors the live review tabs (Offer & acceptance merged) read-only with before/after columns.
 *      A tab shows Diff only when a row it renders visibly differs (same projection as the rows).
 * INPUT: applicationId, productKey, reviewCycle, review tab statuses / visible sections
 * OUTPUT: Dialog with optional Before/After banner + sticky tab strip + SectionContent comparison mode
 * WHERE USED: Admin activity timeline (resubmit events)
 */

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@cashsouk/ui";
import { useProducts } from "@/hooks/use-products";
import { useResubmitComparison } from "@/hooks/use-resubmit-comparison";
import { useAdminS3DocumentViewDownload } from "@/hooks/use-admin-s3-document-view-download";
import {
  ApplicationReviewTabs,
  ApplicationReviewTabContent,
} from "@/components/application-review-tabs";
import { SectionContent } from "@/components/application-review/section-content";
import { type ReviewSectionId } from "@/components/application-review/review-registry";
import { revisionSnapshotToReviewApp } from "@/lib/revision-snapshot-to-review-app";
import { ResubmitTabAmendmentNotesBar } from "@/components/resubmit-tab-amendment-notes";
import { getSupportingDocumentsStepConfig } from "@/components/application-review/supporting-documents-admin-meta";
import {
  buildResubmitTabStripSections,
  getResubmitComparisonTabDescriptors,
  resolveResubmitComparisonWorkflow,
  resubmitTabDescriptorHasChanges,
  resubmitTabSections,
} from "@/lib/resubmit-comparison/modal-tabs";
import { companyComparisonHasChanges } from "@/lib/resubmit-comparison/company-projection";
import { businessComparisonHasChanges } from "@/lib/resubmit-comparison/business-projection";
import { documentsComparisonHasChanges } from "@/lib/resubmit-comparison/documents-projection";
import { projectOfferAcceptanceComparison } from "@/lib/resubmit-comparison/offer-acceptance-projection";
import { stagesHaveChanges } from "@/lib/resubmit-comparison/projection-types";
import { diffIssuerFinancialRevisionSnapshots, formatApplicationReference } from "@cashsouk/types";
import {
  USE_MOCK_GUARANTOR_COMPARISON,
  applyMockGuarantorComparisonApps,
} from "@/lib/mock-guarantor-comparison";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";

const RESUBMIT_FINANCIAL_TAB_ID = "financial";

export interface ResubmitComparisonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string | null;
  applicationDisplayReference?: string | null;
  productKey: string | null;
  reviewCycle: number | null;
  /** From application detail — aligns tab status dots with main review page (e.g. green when approved). */
  reviewTabSections?: { section: string; status: string }[];
  /** Same as application detail `visible_review_sections` — when set, tab list matches main page API filter. */
  visibleReviewSections?: unknown;
}

export function ResubmitComparisonModal({
  open,
  onOpenChange,
  applicationId,
  applicationDisplayReference,
  productKey,
  reviewCycle,
  reviewTabSections,
  visibleReviewSections: visibleReviewSectionsFromParent,
}: ResubmitComparisonModalProps) {
  const { data, isLoading, error, isError } = useResubmitComparison(applicationId, reviewCycle, open);
  const { data: productsData } = useProducts({ page: 1, pageSize: 100 });
  const product = React.useMemo(
    () => productsData?.products.find((p) => p.id === productKey),
    [productsData?.products, productKey]
  );

  const { viewDocumentPending, handleViewDocument, handleDownloadDocument } =
    useAdminS3DocumentViewDownload();

  /** Frozen product version from the after snapshot; live catalog only when the snapshot has none. */
  const comparisonWorkflow = React.useMemo(
    () => resolveResubmitComparisonWorkflow(data?.next_snapshot, product?.workflow),
    [data?.next_snapshot, product?.workflow]
  );

  const supportingDocumentsStepConfig = React.useMemo(() => {
    return getSupportingDocumentsStepConfig(comparisonWorkflow);
  }, [comparisonWorkflow]);

  /** Issuer User Input diff from the two consecutive ApplicationRevision snapshots (raw values only). */
  const financialDiff = React.useMemo(
    () =>
      data ? diffIssuerFinancialRevisionSnapshots(data.previous_snapshot, data.next_snapshot) : [],
    [data]
  );

  const beforeApp = React.useMemo(() => {
    if (!data?.previous_snapshot || !applicationId) return null;
    return revisionSnapshotToReviewApp(applicationId, data.previous_snapshot as Record<string, unknown>);
  }, [data, applicationId]);

  const afterApp = React.useMemo(() => {
    if (!data?.next_snapshot || !applicationId) return null;
    return revisionSnapshotToReviewApp(applicationId, data.next_snapshot as Record<string, unknown>);
  }, [data, applicationId]);

  const { comparisonBeforeApp, comparisonAfterApp } = React.useMemo(() => {
    if (!beforeApp || !afterApp) {
      return { comparisonBeforeApp: null as typeof beforeApp, comparisonAfterApp: null as typeof afterApp };
    }
    if (!USE_MOCK_GUARANTOR_COMPARISON) {
      return { comparisonBeforeApp: beforeApp, comparisonAfterApp: afterApp };
    }
    const { beforeApp: b, afterApp: a } = applyMockGuarantorComparisonApps(beforeApp, afterApp);
    return { comparisonBeforeApp: b, comparisonAfterApp: a };
  }, [beforeApp, afterApp]);

  const effectiveTabDescriptors = React.useMemo(() => {
    const appShape = comparisonAfterApp
      ? {
          visible_review_sections:
            visibleReviewSectionsFromParent ?? comparisonAfterApp.visible_review_sections,
          financing_structure: comparisonAfterApp.financing_structure,
          invoices: comparisonAfterApp.invoices,
        }
      : null;
    return getResubmitComparisonTabDescriptors(comparisonWorkflow, appShape);
  }, [comparisonWorkflow, comparisonAfterApp, visibleReviewSectionsFromParent]);

  /**
   * Diff = a rendered row differs. Financial keeps the issuer User Input diff; the other tabs use
   * the projection their comparison renders. acceptance_documents has no comparison data.
   * Computed once per backend section behind the visible tabs.
   */
  const sectionHasChanges = React.useMemo(() => {
    const result = new Map<ReviewSectionId, boolean>();
    /** Offer & acceptance projects contract + invoice stages together; project once for both. */
    let offerAcceptance: ReturnType<typeof projectOfferAcceptanceComparison> | null = null;
    const compute = (section: ReviewSectionId): boolean => {
      if (section === "financial") return financialDiff.length > 0;
      if (!comparisonBeforeApp || !comparisonAfterApp) return false;
      switch (section) {
        case "company_details":
          return companyComparisonHasChanges(comparisonBeforeApp, comparisonAfterApp);
        case "business_details":
          return businessComparisonHasChanges(comparisonBeforeApp, comparisonAfterApp);
        case "supporting_documents":
          return documentsComparisonHasChanges(comparisonBeforeApp, comparisonAfterApp);
        case "contract_details":
        case "invoice_details":
          offerAcceptance ??= projectOfferAcceptanceComparison(comparisonBeforeApp, comparisonAfterApp);
          return stagesHaveChanges(offerAcceptance[section]);
        default:
          return false;
      }
    };
    for (const descriptor of effectiveTabDescriptors) {
      for (const section of resubmitTabSections(descriptor)) {
        if (!result.has(section)) result.set(section, compute(section));
      }
    }
    return result;
  }, [effectiveTabDescriptors, financialDiff, comparisonBeforeApp, comparisonAfterApp]);

  const resubmitTabHasChanges = React.useCallback(
    (section: ReviewSectionId) => sectionHasChanges.get(section) ?? false,
    [sectionHasChanges]
  );

  const tabStripSections = React.useMemo(
    () => buildResubmitTabStripSections(effectiveTabDescriptors, reviewTabSections),
    [reviewTabSections, effectiveTabDescriptors]
  );

  const noopAsync = React.useCallback(async () => {}, []);
  const noop = React.useCallback(() => {}, []);

  const amendmentRemarks = data?.amendment_remarks;

  const [resubmitTabId, setResubmitTabId] = React.useState(RESUBMIT_FINANCIAL_TAB_ID);
  React.useEffect(() => {
    if (!open || isLoading || effectiveTabDescriptors.length === 0) return;
    setResubmitTabId(effectiveTabDescriptors[0]?.id ?? RESUBMIT_FINANCIAL_TAB_ID);
  }, [open, isLoading, effectiveTabDescriptors]);

  const activeTabDescriptor = React.useMemo(
    () => effectiveTabDescriptors.find((d) => d.id === resubmitTabId),
    [effectiveTabDescriptors, resubmitTabId]
  );

  const showResubmitBeforeAfterBanner =
    activeTabDescriptor != null &&
    resubmitTabDescriptorHasChanges(activeTabDescriptor, resubmitTabHasChanges);

  const resubmitBeforeAfterBanner = showResubmitBeforeAfterBanner ? (
    <div
      className="isolate overflow-hidden rounded-lg border border-border"
      role="presentation"
    >
      <div className="grid w-full grid-cols-2 items-stretch gap-0">
        <div className="relative flex min-h-[3.25rem] h-full items-start justify-center gap-2 overflow-hidden border-r border-border px-4 py-2.5 text-center sm:justify-start">
          <span aria-hidden className="pointer-events-none absolute inset-0 size-full bg-muted" />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 size-full bg-status-rejected-bg dark:bg-status-rejected-text/22"
          />
          <span
            className="relative z-10 mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-status-rejected-text/40 bg-background text-status-rejected-text"
            title="Older version"
          >
            <XMarkIcon className="h-4 w-4" aria-hidden />
          </span>
          <div className="relative z-10 min-w-0 text-start">
            <p className="text-xs font-semibold uppercase tracking-wide text-status-rejected-text">Before</p>
            <p className="mt-0.5 text-meta font-normal leading-snug text-muted-foreground">Before resubmit</p>
          </div>
        </div>
        <div className="relative flex min-h-[3.25rem] h-full items-start justify-center gap-2 overflow-hidden px-4 py-2.5 text-center sm:justify-start">
          <span aria-hidden className="pointer-events-none absolute inset-0 size-full bg-muted" />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 size-full bg-status-action-bg dark:bg-status-action-text/26"
          />
          <span
            className="relative z-10 mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-status-action-text/40 bg-background text-status-action-text"
            title="Newer version"
          >
            <CheckIcon className="h-4 w-4" aria-hidden />
          </span>
          <div className="relative z-10 min-w-0 text-start">
            <p className="text-xs font-semibold uppercase tracking-wide text-status-action-text">After</p>
            <p className="mt-0.5 text-meta font-normal leading-snug text-muted-foreground">After resubmit</p>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[90vh] flex flex-col overflow-hidden rounded-2xl p-0 gap-0 border border-border bg-background shadow-lg">
        <DialogHeader className="space-y-1 shrink-0 border-b border-border/80 px-6 pb-1.5 pt-6">
          <DialogTitle className="text-dialog-title">What changed in this application</DialogTitle>
          <DialogDescription className="text-sm">
            {applicationId
              ? `Application ${formatApplicationReference({
                  displayReference: applicationDisplayReference,
                  id: applicationId,
                })}`
              : "Application"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pt-0 [scrollbar-gutter:stable]">
            {isLoading && (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-64 w-full rounded-xl" />
              </div>
            )}
            {isError && (
              <p className="text-sm text-destructive" role="alert">
                {error instanceof Error ? error.message : "Failed to load comparison"}
              </p>
            )}
            {!isLoading && !isError && comparisonBeforeApp && comparisonAfterApp && effectiveTabDescriptors.length > 0 ? (
              <>
                {USE_MOCK_GUARANTOR_COMPARISON ? (
                  <p
                    className="mb-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
                    role="status"
                  >
                    Dev mock: guarantor comparison sample is active. Turn off in{" "}
                    <code className="rounded bg-background/80 px-1 text-xs">mock-guarantor-comparison.ts</code>.
                  </p>
                ) : null}
                <ApplicationReviewTabs
                  sections={tabStripSections}
                  tabDescriptors={effectiveTabDescriptors}
                  resubmitTabHasChanges={resubmitTabHasChanges}
                  stickyTabList
                  stickyTopSlot={resubmitBeforeAfterBanner}
                  tabValue={resubmitTabId}
                  onTabValueChange={setResubmitTabId}
                >
                  {effectiveTabDescriptors.map((descriptor) => (
                    <ApplicationReviewTabContent key={descriptor.id} value={descriptor.id}>
                      <ResubmitTabAmendmentNotesBar
                        reviewSection={descriptor.reviewSection}
                        reviewSections={resubmitTabSections(descriptor)}
                        remarks={amendmentRemarks}
                      />
                      <SectionContent
                        descriptor={descriptor}
                        app={comparisonAfterApp}
                        sectionComparison={{
                          beforeApp: comparisonBeforeApp,
                          afterApp: comparisonAfterApp,
                          financialDiff,
                        }}
                        resubmitAmendmentRemarks={amendmentRemarks}
                        hideSectionComments
                        isReviewable={false}
                        approveSectionPending={false}
                        approveItemPending={false}
                        viewDocumentPending={viewDocumentPending}
                        onApproveSection={noop}
                        onRejectSection={noop}
                        onRequestAmendmentSection={noop}
                        onViewDocument={handleViewDocument}
                        onDownloadDocument={handleDownloadDocument}
                        onDownloadAllDocuments={noopAsync}
                        onApproveItem={async () => {}}
                        onRejectItem={noop}
                        onRequestAmendmentItem={noop}
                        supportingDocumentsStepConfig={supportingDocumentsStepConfig}
                      />
                    </ApplicationReviewTabContent>
                  ))}
                </ApplicationReviewTabs>
              </>
            ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
