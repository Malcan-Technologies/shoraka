"use client";

import { ChevronRightIcon } from "@heroicons/react/24/outline";
import type { ProspectusReviewStoredContent } from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import {
  CHECKLIST_ITEM_STEP,
  buildProspectusCompletionChecklist,
  buildProspectusMissingRequiredFields,
  getProspectusStepStatuses,
  statusForCompletionItem,
  type ProspectusCompletionOptions,
  type ProspectusStepStatus,
} from "@/notes/prospectus-review/completion";
import type { ProspectusActionVisibility } from "@/notes/prospectus-review/action-visibility";
import {
  PROSPECTUS_STEP_PAGE_LABEL,
  PROSPECTUS_STEP_TITLES,
  type ProspectusWorkflowStepId,
} from "@/notes/prospectus-review/labels";
import { ProspectusPageHeader } from "@/notes/prospectus-review/field-presentation";
import { ProspectusStatusBadge } from "@/notes/prospectus-review/status-badge";
import { HIGHLIGHT_FIELD_LABELS, INVOICE_WORK_FIELD_LABELS } from "@/notes/prospectus-review/labels";

export type WorkingAreaPreviewApprovalProps = {
  draft: ProspectusReviewStoredContent;
  completionOptions?: ProspectusCompletionOptions;
  stepStatuses: Partial<Record<ProspectusWorkflowStepId, ProspectusStepStatus>>;
  onNavigate: (step: ProspectusWorkflowStepId, tabId?: string) => void;
  onSave: () => void;
  onPreview: () => void;
  onApprove: () => void;
  actions: ProspectusActionVisibility;
  dirty: boolean;
  savePending?: boolean;
  previewPending?: boolean;
  approvePending?: boolean;
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

export function WorkingAreaPreviewApproval({
  draft,
  completionOptions,
  stepStatuses: stepStatusesProp,
  onNavigate,
  onSave,
  onPreview,
  onApprove,
  actions,
  dirty,
  savePending,
  previewPending,
  approvePending,
  publishBlockedReason,
}: WorkingAreaPreviewApprovalProps) {
  const checklist = buildProspectusCompletionChecklist(draft, completionOptions);
  const stepStatuses =
    Object.keys(stepStatusesProp).length > 0
      ? stepStatusesProp
      : getProspectusStepStatuses(draft, completionOptions);
  const missing = buildProspectusMissingRequiredFields(draft, completionOptions);

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
      <ProspectusPageHeader title="Preview & Approval" dirty={dirty} />

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Readiness by page</h3>
        <ul className="overflow-hidden rounded-xl border" aria-label="Prospectus page readiness">
          {pageSteps.map((pageStep) => {
            const status = stepStatuses[pageStep];
            const pageMissing = missingByPage[pageStep]?.length ?? 0;
            return (
              <li key={pageStep} className="border-b last:border-b-0">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  onClick={() => onNavigate(pageStep)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-foreground">
                      {PROSPECTUS_STEP_PAGE_LABEL[pageStep]} — {PROSPECTUS_STEP_TITLES[pageStep]}
                    </span>
                    {pageMissing > 0 ? (
                      <span className="mt-0.5 block text-xs text-amber-700 dark:text-amber-400">
                        {pageMissing} required field{pageMissing === 1 ? "" : "s"} missing
                      </span>
                    ) : null}
                  </span>
                  {status ? <ProspectusStatusBadge status={status} /> : null}
                  <ChevronRightIcon
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Completion checklist</h3>
        <ul className="overflow-hidden rounded-xl border" aria-label="Prospectus completion checklist">
          {checklist.map((item) => {
            const rowStatus = statusForCompletionItem(item);
            return (
              <li key={item.id} className="border-b last:border-b-0">
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  onClick={() => {
                    const mapped = CHECKLIST_ITEM_STEP[item.id];
                    if (mapped != null) onNavigate(mapped);
                  }}
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                  <ProspectusStatusBadge status={rowStatus} />
                  <ChevronRightIcon
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {missing.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Missing required fields</h3>
          <ul className="space-y-4">
            {pageSteps
              .filter((page) => (missingByPage[page]?.length ?? 0) > 0)
              .map((page) => (
                <li key={page} className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {PROSPECTUS_STEP_PAGE_LABEL[page]} — {PROSPECTUS_STEP_TITLES[page]}
                  </div>
                  <ul className="overflow-hidden rounded-xl border">
                    {missingByPage[page]!.map((item, index) => (
                      <li key={`${item.section}-${item.field}-${item.year ?? index}`}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                          onClick={() => onNavigate(item.pageStep, item.tabId)}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="text-muted-foreground">{item.section}</span>
                            <span className="mx-1.5 text-muted-foreground">·</span>
                            <span className="font-medium text-foreground">
                              {formatMissingFieldLabel(item.field)}
                              {item.year ? ` (${item.year})` : ""}
                            </span>
                          </span>
                          <ChevronRightIcon
                            className="h-4 w-4 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          All required fields are complete. Save &amp; Preview, then Approve when ready.
        </p>
      )}

      {publishBlockedReason ? (
        <p className="text-sm text-muted-foreground">{publishBlockedReason}</p>
      ) : null}

      <div
        data-prospectus-action-bar
        className="flex flex-wrap items-center gap-2 border-t pt-4"
      >
        {actions.saveDraft ? (
          <Button variant="outline" onClick={onSave} disabled={savePending || !dirty}>
            Save Draft
          </Button>
        ) : null}
        {actions.saveAndPreview ? (
          <Button variant="secondary" onClick={onPreview} disabled={previewPending || savePending}>
            Save &amp; Preview
          </Button>
        ) : null}
        {actions.approve ? (
          <Button onClick={onApprove} disabled={approvePending || missing.length > 0}>
            Approve Prospectus
          </Button>
        ) : null}
        {actions.viewProspectus ? (
          <Button variant="secondary" onClick={onPreview} disabled={previewPending}>
            View Prospectus
          </Button>
        ) : null}
      </div>
    </div>
  );
}
