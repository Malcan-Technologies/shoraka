"use client";

/**
 * SECTION: Full-screen admin modal comparing two application revision snapshots
 * WHY: Mirrors review tabs read-only with before/after columns per plan.
 * INPUT: applicationId, productKey, reviewCycle, fieldChanges for highlights
 * OUTPUT: Dialog with ApplicationReviewTabs + SectionContent comparison mode
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
import {
  ApplicationReviewTabs,
  ApplicationReviewTabContent,
} from "@/components/application-review-tabs";
import { SectionContent } from "@/components/application-review/section-content";
import {
  getReviewTabDescriptorsFromWorkflow,
} from "@/components/application-review/review-registry";
import { revisionSnapshotToReviewApp } from "@/lib/revision-snapshot-to-review-app";
import { getSupportingDocumentsStepConfig } from "@/components/application-review/supporting-documents-admin-meta";
import { buildResubmitChangedPathSet, resubmitPathIsChanged } from "@/lib/resubmit-comparison-paths";
import type { ResubmitFieldChangeItem } from "@/components/application-revision-diff-panel";
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";

export interface ResubmitComparisonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string | null;
  productKey: string | null;
  reviewCycle: number | null;
  fieldChanges?: ResubmitFieldChangeItem[];
}

export function ResubmitComparisonModal({
  open,
  onOpenChange,
  applicationId,
  productKey,
  reviewCycle,
  fieldChanges,
}: ResubmitComparisonModalProps) {
  const { data, isLoading, error, isError } = useResubmitComparison(applicationId, reviewCycle, open);
  const { data: productsData } = useProducts({ page: 1, pageSize: 100 });
  const product = React.useMemo(
    () => productsData?.products.find((p) => p.id === productKey),
    [productsData?.products, productKey]
  );
  const tabDescriptors = React.useMemo(
    () => getReviewTabDescriptorsFromWorkflow(product?.workflow as unknown[] | undefined),
    [product?.workflow]
  );

  const supportingDocumentsStepConfig = React.useMemo(() => {
    const cfg = getSupportingDocumentsStepConfig(product?.workflow as unknown[] | undefined);
    console.log("Resubmit modal supporting documents workflow hints:", cfg ? "found" : "none");
    return cfg;
  }, [product?.workflow]);

  const changedPaths = React.useMemo(() => buildResubmitChangedPathSet(fieldChanges), [fieldChanges]);
  const isPathChanged = React.useCallback(
    (path: string) => resubmitPathIsChanged(path, changedPaths),
    [changedPaths]
  );

  const beforeApp = React.useMemo(() => {
    if (!data?.previous_snapshot || !applicationId) return null;
    return revisionSnapshotToReviewApp(applicationId, data.previous_snapshot as Record<string, unknown>);
  }, [data?.previous_snapshot, applicationId]);

  const afterApp = React.useMemo(() => {
    if (!data?.next_snapshot || !applicationId) return null;
    return revisionSnapshotToReviewApp(applicationId, data.next_snapshot as Record<string, unknown>);
  }, [data?.next_snapshot, applicationId]);

  const noopAsync = React.useCallback(async () => {}, []);
  const noop = React.useCallback(() => {}, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[90vh] flex flex-col overflow-hidden rounded-2xl p-0 gap-0 border border-border bg-background shadow-lg">
        <DialogHeader className="space-y-1 shrink-0 border-b border-border/80 px-6 pb-1.5 pt-6">
          <DialogTitle className="text-[17px] leading-7">What changed in this application</DialogTitle>
          <DialogDescription className="text-sm">
            {applicationId ? `Application ${applicationId}` : "Application"}
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Left: their old answers. Right: their new answers. This window is read only. You cannot
              change anything here.
            </span>
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
            {!isLoading && !isError && beforeApp && afterApp && tabDescriptors.length > 0 ? (
              <>
                <div
                  className="sticky top-0 z-20 -mx-6 mb-2 isolate overflow-hidden border border-border bg-background"
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
                        <p className="text-xs font-semibold uppercase tracking-wide text-status-rejected-text">
                          Before
                        </p>
                        <p className="mt-0.5 text-[11px] font-normal leading-snug text-muted-foreground">
                          Before resubmit
                        </p>
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
                        <p className="text-xs font-semibold uppercase tracking-wide text-status-action-text">
                          After
                        </p>
                        <p className="mt-0.5 text-[11px] font-normal leading-snug text-muted-foreground">
                          After resubmit
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <ApplicationReviewTabs
                  sections={tabDescriptors.map((t) => ({
                    section: t.reviewSection,
                    status: "PENDING",
                  }))}
                  tabDescriptors={tabDescriptors}
                >
                  {tabDescriptors.map((descriptor) => (
                    <ApplicationReviewTabContent key={descriptor.id} value={descriptor.id}>
                      <SectionContent
                        descriptor={descriptor}
                        app={afterApp}
                        sectionComparison={{
                          beforeApp,
                          afterApp,
                          isPathChanged,
                        }}
                        hideSectionComments
                        isReviewable={false}
                        approveSectionPending={false}
                        approveItemPending={false}
                        viewDocumentPending={false}
                        onApproveSection={noop}
                        onRejectSection={noop}
                        onRequestAmendmentSection={noop}
                        onViewDocument={noop}
                        onDownloadDocument={noop}
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
