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
import { buildResubmitChangedPathSet, resubmitPathIsChanged } from "@/lib/resubmit-comparison-paths";
import type { ResubmitFieldChangeItem } from "@/components/application-revision-diff-panel";

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

  console.log("ResubmitComparisonModal state:", {
    open,
    applicationId,
    reviewCycle,
    hasData: !!data,
    tabCount: tabDescriptors.length,
  });

  const noopAsync = React.useCallback(async () => {}, []);
  const noop = React.useCallback(() => {}, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[90vh] flex flex-col overflow-hidden rounded-2xl p-0 gap-0 border border-border bg-background shadow-lg">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0 border-b border-border/80 space-y-1">
          <DialogTitle className="text-[17px] leading-7">
            Application resubmitted — compare revisions
          </DialogTitle>
          <DialogDescription className="text-sm">
            {applicationId ? `Application ${applicationId}` : "Application"}
            {reviewCycle != null ? ` · Review cycle ${reviewCycle}` : null}
            {data?.previous_review_cycle != null && data?.next_review_cycle != null ? (
              <span className="block text-xs text-muted-foreground mt-1">
                Cycles {data.previous_review_cycle} → {data.next_review_cycle} · Left = older · Right = newer
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {!isLoading && !isError && beforeApp && afterApp && tabDescriptors.length > 0 ? (
          <div
            className="shrink-0 grid grid-cols-2 gap-0 border-b border-border bg-muted/25 px-6 py-2.5 text-center sm:text-start"
            role="presentation"
          >
            <div className="min-w-0 pr-2 text-xs font-semibold uppercase tracking-wide text-foreground sm:border-r sm:border-border/80 sm:pr-4">
              Before
              <span className="mt-0.5 block text-[11px] font-normal normal-case text-muted-foreground">
                Earlier snapshot
              </span>
            </div>
            <div className="min-w-0 pl-2 sm:pl-4 text-xs font-semibold uppercase tracking-wide text-foreground">
              After
              <span className="mt-0.5 block text-[11px] font-normal normal-case text-muted-foreground">
                Later snapshot
              </span>
            </div>
          </div>
        ) : null}

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 pt-4">
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
          {!isLoading &&
            !isError &&
            beforeApp &&
            afterApp &&
            tabDescriptors.length > 0 && (
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
                    />
                  </ApplicationReviewTabContent>
                ))}
              </ApplicationReviewTabs>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
