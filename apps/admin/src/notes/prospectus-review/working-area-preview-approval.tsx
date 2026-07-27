"use client";

import {
  CheckCircleIcon,
  ChevronRightIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import type { ProspectusReviewStoredContent } from "@cashsouk/types";
import {
  buildProspectusMissingRequiredFields,
  getProspectusStepStatuses,
  type ProspectusCompletionOptions,
  type ProspectusStepStatus,
} from "@/notes/prospectus-review/completion";
import type { ProspectusActionVisibility } from "@/notes/prospectus-review/action-visibility";
import {
  HIGHLIGHT_FIELD_LABELS,
  INVOICE_WORK_FIELD_LABELS,
  PROSPECTUS_STEP_PAGE_LABEL,
  PROSPECTUS_STEP_TITLES,
  type ProspectusWorkflowStepId,
} from "@/notes/prospectus-review/labels";
import {
  ProspectusPageHeader,
  ProspectusSectionShell,
} from "@/notes/prospectus-review/field-presentation";

export type WorkingAreaPreviewApprovalProps = {
  draft: ProspectusReviewStoredContent;
  completionOptions?: ProspectusCompletionOptions;
  stepStatuses: Partial<Record<ProspectusWorkflowStepId, ProspectusStepStatus>>;
  onNavigate: (step: ProspectusWorkflowStepId, tabId?: string) => void;
  actions: ProspectusActionVisibility;
  publishBlockedReason?: string | null;
};

function formatMissingFieldLabel(field: string): string {
  if (field in HIGHLIGHT_FIELD_LABELS) {
    return HIGHLIGHT_FIELD_LABELS[field] ?? field;
  }
  if (field in INVOICE_WORK_FIELD_LABELS) {
    return INVOICE_WORK_FIELD_LABELS[field] ?? field;
  }
  return field.replace(/_/g, " ");
}

function pageReadinessLabel(
  pageStep: ProspectusWorkflowStepId,
  pageMissing: number,
  totalMissing: number
): { text: string; tone: "complete" | "missing" } {
  if (pageStep === 3) {
    if (totalMissing === 0) return { text: "Complete", tone: "complete" };
    return {
      text: `${totalMissing} required field${totalMissing === 1 ? "" : "s"} missing`,
      tone: "missing",
    };
  }
  if (pageMissing === 0) return { text: "Complete", tone: "complete" };
  return {
    text: `${pageMissing} required field${pageMissing === 1 ? "" : "s"} missing`,
    tone: "missing",
  };
}

export function WorkingAreaPreviewApproval({
  draft,
  completionOptions,
  stepStatuses: stepStatusesProp,
  onNavigate,
  publishBlockedReason,
}: WorkingAreaPreviewApprovalProps) {
  const stepStatuses =
    Object.keys(stepStatusesProp).length > 0
      ? stepStatusesProp
      : getProspectusStepStatuses(draft, completionOptions);
  const missing = buildProspectusMissingRequiredFields(draft, completionOptions);
  const totalMissing = missing.length;
  const isReady = totalMissing === 0;

  const missingByPage = missing.reduce<
    Record<ProspectusWorkflowStepId, typeof missing>
  >(
    (acc, item) => {
      const bucket = acc[item.pageStep] ?? [];
      bucket.push(item);
      acc[item.pageStep] = bucket;
      return acc;
    },
    {} as Record<ProspectusWorkflowStepId, typeof missing>
  );

  const pageSteps: ProspectusWorkflowStepId[] = [0, 1, 2, 3];

  return (
    <div className="space-y-8" data-prospectus-working-page="preview">
      <ProspectusPageHeader title="Preview & Approval" />

      <ProspectusSectionShell title="Readiness by page" icon={ClipboardDocumentCheckIcon}>
        <ul className="overflow-hidden rounded-xl border" aria-label="Prospectus page readiness">
          {pageSteps.map((pageStep) => {
            const pageMissing = missingByPage[pageStep]?.length ?? 0;
            const readiness = pageReadinessLabel(pageStep, pageMissing, totalMissing);
            const status = stepStatuses[pageStep];
            return (
              <li key={pageStep} className="border-b last:border-b-0">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  onClick={() => onNavigate(pageStep)}
                  aria-label={`${PROSPECTUS_STEP_PAGE_LABEL[pageStep]} — ${PROSPECTUS_STEP_TITLES[pageStep]}: ${readiness.text}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-foreground">
                      {PROSPECTUS_STEP_PAGE_LABEL[pageStep]} — {PROSPECTUS_STEP_TITLES[pageStep]}
                    </span>
                    <span
                      className={
                        readiness.tone === "complete"
                          ? "mt-0.5 block text-xs font-medium text-emerald-700 dark:text-emerald-400"
                          : "mt-0.5 block text-xs font-medium text-amber-700 dark:text-amber-400"
                      }
                      data-prospectus-page-readiness={readiness.tone}
                      data-prospectus-step-status={status}
                    >
                      {readiness.text}
                    </span>
                  </span>
                  <ChevronRightIcon
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </ProspectusSectionShell>

      {totalMissing > 0 ? (
        <ProspectusSectionShell title="Missing required fields" icon={ExclamationTriangleIcon}>
          <ul className="space-y-4" aria-label="Missing required fields">
            {pageSteps
              .filter((page) => (missingByPage[page]?.length ?? 0) > 0)
              .map((page) => (
                <li key={page} className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {PROSPECTUS_STEP_PAGE_LABEL[page]} — {PROSPECTUS_STEP_TITLES[page]}
                  </div>
                  <ul className="overflow-hidden rounded-xl border">
                    {missingByPage[page]!.map((item, index) => {
                      const fieldLabel = `${formatMissingFieldLabel(item.field)}${
                        item.year ? ` (${item.year})` : ""
                      }`;
                      return (
                        <li key={`${item.section}-${item.field}-${item.year ?? index}`}>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                            onClick={() => onNavigate(item.pageStep, item.tabId)}
                            aria-label={`Go to ${item.section}, ${fieldLabel}`}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="text-muted-foreground">{item.section}</span>
                              <span className="mx-1.5 text-muted-foreground">·</span>
                              <span className="font-medium text-foreground">{fieldLabel}</span>
                            </span>
                            <ChevronRightIcon
                              className="h-4 w-4 shrink-0 text-muted-foreground"
                              aria-hidden
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
          </ul>
        </ProspectusSectionShell>
      ) : (
        <div
          className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/40"
          role="status"
          data-prospectus-ready-state="complete"
        >
          <CheckCircleIcon
            className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400"
            aria-hidden
          />
          <div className="space-y-0.5 text-sm">
            <p className="font-medium text-emerald-900 dark:text-emerald-100">
              All required fields are complete.
            </p>
            <p className="text-emerald-800 dark:text-emerald-200">
              The Prospectus is ready for approval.
            </p>
          </div>
        </div>
      )}

      <div
        className="space-y-1"
        role="status"
        aria-live="polite"
        data-prospectus-approval-readiness={isReady ? "ready" : "unavailable"}
      >
        {isReady ? (
          <>
            <p className="text-sm font-semibold text-foreground">Ready for approval</p>
            <p className="text-sm text-muted-foreground">All required fields are complete.</p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-foreground">Approval unavailable</p>
            <p className="text-sm text-muted-foreground">
              {totalMissing} required field{totalMissing === 1 ? "" : "s"} are still missing.
            </p>
          </>
        )}
      </div>

      {publishBlockedReason ? (
        <p className="text-sm text-muted-foreground">{publishBlockedReason}</p>
      ) : null}
    </div>
  );
}
