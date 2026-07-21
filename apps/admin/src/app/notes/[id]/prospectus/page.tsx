"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { Skeleton } from "@cashsouk/ui";
import {
  normalizeProspectusCompanySize,
  normalizeProspectusConfidenceGrading,
  normalizeProspectusDeedOfAssignment,
  normalizeProspectusPaymasterRating,
  type ProspectusReviewStoredContent,
  type ProspectusReviewStatus,
} from "@cashsouk/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SystemHealthIndicator } from "@/components/system-health-indicator";
import { RequirePermission } from "@/components/require-permission";
import { usePermissions } from "@/hooks/use-permissions";
import { useNoteDetail } from "@/notes/hooks/use-note-detail";
import { useApplicationDetail } from "@/hooks/use-application-detail";
import { useUserDetail } from "@/hooks/use-users";
import {
  ProspectusReviewConflictError,
  useApproveProspectusReview,
  useProspectusReview,
  useProspectusReviewPreview,
  useSaveProspectusReviewDraft,
} from "@/notes/hooks/use-prospectus-review";
import {
  PROSPECTUS_STEP_GROUPS,
  PROSPECTUS_STEP_PAGE_LABEL,
  formatActorDisplayName,
  formatProspectusReviewStatus,
  type ProspectusWorkflowStepId,
} from "@/notes/prospectus-review/labels";
import {
  PROSPECTUS_STEP_STATUS_LABEL,
  buildProspectusMissingRequiredFields,
  formatProspectusPageCompletionLabel,
  getProspectusStepStatuses,
} from "@/notes/prospectus-review/completion";
import {
  appendIssuerTrackRecordSection,
  buildNoteInvestmentDetailSections,
} from "@/notes/prospectus-review/core-terms";
import { mergeOfficerOverridesIntoFinancialTable } from "@/notes/prospectus-review/page-two-coverage";
import {
  buildPageThreeAdminOverviewRows,
  buildPageThreeBalanceSheetTable,
  buildPageThreeCoverageTable,
  buildPageThreeIncomeStatementTable,
  selectPageThreeYears,
} from "@/notes/prospectus-review/page-three-coverage";
import { ProspectusPreviewSheet } from "@/notes/prospectus-review/preview-sheet";
import { ProspectusStatusBadge } from "@/notes/prospectus-review/status-badge";
import { getProspectusActionVisibility } from "@/notes/prospectus-review/action-visibility";
import {
  PROSPECTUS_ACTIVE_COLUMN_CLASS,
  PROSPECTUS_STEPS_GRID_CLASS,
} from "@/notes/prospectus-review/step-icons";
import { WorkingAreaPageOne } from "@/notes/prospectus-review/working-area-page-one";
import { WorkingAreaPageTwo } from "@/notes/prospectus-review/working-area-page-two";
import { WorkingAreaPageThree } from "@/notes/prospectus-review/working-area-page-three";
import { WorkingAreaPreviewApproval } from "@/notes/prospectus-review/working-area-preview-approval";

function ProspectusReviewPageInner() {
  const params = useParams<{ id: string }>();
  const noteId = params.id;
  const router = useRouter();
  const { can } = usePermissions();
  const canManage = can("notes.manage");

  const { data, isLoading, error, refetch } = useProspectusReview(noteId);
  const { data: note } = useNoteDetail(noteId);
  const { data: application } = useApplicationDetail(note?.sourceApplicationId ?? "");
  const { data: updatedByUser } = useUserDetail(data?.review.updatedByUserId ?? null);

  const saveDraft = useSaveProspectusReviewDraft(noteId);
  const approve = useApproveProspectusReview(noteId);

  const [step, setStep] = React.useState<ProspectusWorkflowStepId>(0);
  const [pageOneTab, setPageOneTab] = React.useState<
    import("@/notes/prospectus-review/working-area-placeholders").PageOneTabId
  >("overview");
  const [pageTwoTab, setPageTwoTab] = React.useState<
    import("@/notes/prospectus-review/working-area-placeholders").PageTwoTabId
  >("issuer_paymaster");
  const [pageThreeTab, setPageThreeTab] = React.useState<
    import("@/notes/prospectus-review/working-area-placeholders").PageThreeTabId
  >("overview");
  const [draft, setDraft] = React.useState<ProspectusReviewStoredContent | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const stepPanelRef = React.useRef<HTMLDivElement>(null);
  const preview = useProspectusReviewPreview(noteId, previewOpen);

  React.useEffect(() => {
    if (data?.review.draftContent && !dirty) {
      setDraft(structuredClone(data.review.draftContent));
    }
  }, [data, dirty]);

  React.useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const status = data?.review.status as ProspectusReviewStatus | undefined;
  const notePublished = note?.status === "PUBLISHED" || note?.publishedAt != null;
  const locked = notePublished || status === "PUBLISHED";

  const updateDraft = (
    updater: (prev: ProspectusReviewStoredContent) => ProspectusReviewStoredContent
  ) => {
    setDraft((prev) => {
      if (!prev) return prev;
      setDirty(true);
      return updater(prev);
    });
  };

  const focusStepPanel = React.useCallback(() => {
    requestAnimationFrame(() => {
      const panel = stepPanelRef.current;
      if (!panel) return;
      const target = panel.querySelector<HTMLElement>(
        'input:not([disabled]), button[role="combobox"]:not([disabled]), [role="combobox"]:not([disabled]), select:not([disabled]), textarea:not([disabled])'
      );
      target?.focus();
    });
  }, []);

  const goToStep = (
    next: ProspectusWorkflowStepId,
    focusField = false,
    tabId?: string
  ) => {
    setStep(next);
    if (tabId) {
      if (next === 0) {
        setPageOneTab(tabId as typeof pageOneTab);
      } else if (next === 1) {
        setPageTwoTab(tabId as typeof pageTwoTab);
      } else if (next === 2) {
        setPageThreeTab(tabId as typeof pageThreeTab);
      }
    }
    if (focusField) focusStepPanel();
  };

  const onSave = async (): Promise<boolean> => {
    if (!draft || !data) return false;
    try {
      await saveDraft.mutateAsync({
        draftContent: draft,
        expectedUpdatedAt: data.review.updatedAt,
      });
      setDirty(false);
      toast.success("Draft saved");
      return true;
    } catch (e) {
      if (e instanceof ProspectusReviewConflictError) {
        toast.error("This review was updated elsewhere. Refresh and try again.");
        void refetch();
        setDirty(false);
        return false;
      }
      toast.error(e instanceof Error ? e.message : "Save failed");
      return false;
    }
  };

  const onSaveAndPreview = async () => {
    if (!canManage || locked) {
      setPreviewOpen(true);
      return;
    }
    if (dirty) {
      const saved = await onSave();
      if (!saved) return;
    }
    setPreviewOpen(true);
  };

  const onApprove = async () => {
    if (
      !window.confirm(
        "Approve this Prospectus? It will become eligible for marketplace publication. Any edits made before publication will require approval again."
      )
    ) {
      return;
    }
    if (!draft || !data) return;
    try {
      await approve.mutateAsync(
        dirty
          ? { draftContent: draft, expectedUpdatedAt: data.review.updatedAt }
          : undefined
      );
      setDirty(false);
      toast.success("Prospectus approved — Note is eligible for publication");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approve failed");
    }
  };

  if (isLoading || !data || !draft) {
    return (
      <div className="space-y-6 px-4 py-10 md:px-6 md:py-12">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-10 text-sm text-destructive md:px-6">
        {error instanceof Error ? error.message : "Failed to load review"}
      </div>
    );
  }

  const catalogues = data.catalogues;
  const actorName = formatActorDisplayName(updatedByUser);
  const noteInvestmentSections =
    note != null
      ? appendIssuerTrackRecordSection(
          buildNoteInvestmentDetailSections(note),
          data?.issuerTrackRecord?.rows
        )
      : [];
  const officerCompanySize = normalizeProspectusCompanySize(
    draft.page2.issuerProfile?.companySize
  );
  const issuerRows = (data?.issuerProfile?.rows ?? []).map((row) =>
    row.label === "Company Size"
      ? { ...row, value: officerCompanySize ?? "Data not available" }
      : row
  );
  const officerDeedOfAssignment = normalizeProspectusDeedOfAssignment(
    draft.page2.invoicePaymaster?.deedOfAssignment
  );
  const officerPaymasterRating = normalizeProspectusPaymasterRating(
    draft.page2.invoicePaymaster?.paymasterRating
  );
  const officerConfidenceGrading = normalizeProspectusConfidenceGrading(
    draft.page2.invoicePaymaster?.confidenceGrading
  );
  const invoicePaymasterRows = (data?.invoicePaymaster?.rows ?? []).map((row) => {
    if (row.label === "Deed of Assignment (DOA)") {
      return { ...row, value: officerDeedOfAssignment ?? "Data not available" };
    }
    if (row.label === "Paymaster Rating") {
      return { ...row, value: officerPaymasterRating ?? "Data not available" };
    }
    if (row.label === "Confidence Grading") {
      return { ...row, value: officerConfidenceGrading ?? "Data not available" };
    }
    return row;
  });
  const pageTwoFinancialTable = data?.financialComparison?.table
    ? mergeOfficerOverridesIntoFinancialTable(
        data.financialComparison.table,
        draft.page2.financialComparison?.overrides
      )
    : { yearHeaders: [], rows: [] };
  const financialComparisonOpsWarning = data?.financialComparison?.opsWarning
    ? {
        title: "Missing expected financial year",
        description: data.financialComparison.opsWarning,
      }
    : null;
  const financialStatements = (
    application as { financial_statements?: unknown } | undefined
  )?.financial_statements;
  const pageThreeYears = selectPageThreeYears(financialStatements);
  const activeFinancialYears =
    pageThreeYears.length > 0 ? pageThreeYears : (["2022", "2023", "2024"] as const);
  const incomeStatementYearKeys = activeFinancialYears.map(String);
  const completionOptions = { incomeStatementYears: incomeStatementYearKeys };
  const stepStatuses = getProspectusStepStatuses(draft, completionOptions);
  const manualYears = draft.page3.manualFinancialInputs?.years;
  const pageThreeMetadataRows = note
    ? buildPageThreeAdminOverviewRows(note, {
        companySize: officerCompanySize,
        paymasterRating: officerPaymasterRating,
        confidenceGrading: officerConfidenceGrading,
      })
    : [];
  const incomeStatementTable = buildPageThreeIncomeStatementTable(
    financialStatements,
    manualYears
  );
  const balanceSheetTable = buildPageThreeBalanceSheetTable(financialStatements, manualYears);
  const coverageTable = buildPageThreeCoverageTable(
    financialStatements,
    manualYears,
    draft.page2.financialComparison?.overrides
  );

  const updateManualFieldForYear = (year: string, field: string, value: string) => {
    updateDraft((prev) => {
      const years = { ...(prev.page3.manualFinancialInputs?.years ?? {}) };
      const row = { ...(years[year] ?? {}) };
      row[field] = value === "" ? null : value;
      years[year] = row;
      return {
        ...prev,
        page3: {
          ...prev.page3,
          manualFinancialInputs: { years },
        },
      };
    });
  };
  const previewStatusLabel =
    status === "APPROVED" || status === "PUBLISHED"
      ? ("Approved preview" as const)
      : ("Draft preview" as const);
  const actions = getProspectusActionVisibility({
    step,
    status: status ?? "DRAFT",
    canManage,
    notePublished,
  });
  const dirtyLabel = dirty ? "Unsaved changes" : "All changes saved";
  const pageCompletion = formatProspectusPageCompletionLabel(
    draft,
    step,
    completionOptions
  );
  const requiredMissingCount = buildProspectusMissingRequiredFields(
    draft,
    completionOptions
  ).length;

  const stepNav = (
    <nav aria-label="Prospectus review steps" className="space-y-4">
      {PROSPECTUS_STEP_GROUPS.map((group) => (
        <div key={group.group} className="space-y-1">
          <div className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {group.group}
          </div>
          <div className="space-y-0.5">
            {group.steps.map((item) => {
              const rowStatus = stepStatuses[item.id];
              const isCurrent = step === item.id;
              const isRequiredIncomplete = rowStatus === "required";
              return (
                <Button
                  key={item.id}
                  type="button"
                  variant={isCurrent ? "secondary" : "ghost"}
                  className="h-auto w-full justify-between gap-2 px-3 py-2 text-left text-sm"
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={
                    rowStatus
                      ? `${PROSPECTUS_STEP_PAGE_LABEL[item.id]} ${item.label}, ${PROSPECTUS_STEP_STATUS_LABEL[rowStatus]}`
                      : `${PROSPECTUS_STEP_PAGE_LABEL[item.id]} ${item.label}`
                  }
                  onClick={() => goToStep(item.id)}
                >
                  <span
                    className={`min-w-0 flex-1 truncate ${
                      isRequiredIncomplete && !isCurrent ? "font-medium text-foreground" : ""
                    }`}
                  >
                    <span className="mr-1 text-xs text-muted-foreground">
                      {PROSPECTUS_STEP_PAGE_LABEL[item.id]}
                    </span>
                    {item.label}
                  </span>
                  {rowStatus ? <ProspectusStatusBadge status={rowStatus} /> : null}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const actionBar =
    step === 3 ? null : (
      <div
        data-prospectus-action-bar
        className="sticky bottom-0 z-10 border-t bg-background/95 px-1 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 text-xs text-muted-foreground" data-prospectus-dirty-state>
            {dirtyLabel}
          </span>
          {actions.saveDraft ? (
            <Button
              variant="outline"
              onClick={() => void onSave()}
              disabled={saveDraft.isPending || !dirty}
            >
              Save Draft
            </Button>
          ) : null}
          {actions.saveAndPreview ? (
            <Button
              variant="secondary"
              onClick={() => void onSaveAndPreview()}
              disabled={preview.isFetching || saveDraft.isPending}
            >
              Save &amp; Preview
            </Button>
          ) : null}
          {actions.approve ? (
            <Button
              onClick={() => void onApprove()}
              disabled={approve.isPending || requiredMissingCount > 0}
            >
              Approve Prospectus
            </Button>
          ) : null}
          {actions.viewProspectus ? (
            <Button variant="secondary" onClick={() => setPreviewOpen(true)}>
              View Prospectus
            </Button>
          ) : null}
          {actions.backToNote ? (
            <Button variant="ghost" onClick={() => router.push(`/notes/${noteId}`)}>
              Back to Note
            </Button>
          ) : null}
        </div>
      </div>
    );

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/notes/${noteId}`)}
          className="-ml-1 gap-1.5"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Note
        </Button>
        <Separator orientation="vertical" className="mx-2 h-4" />
        <h1 className="truncate text-lg font-semibold">Prospectus Review</h1>
        <div className="ml-auto">
          <SystemHealthIndicator />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="w-full space-y-6 px-4 py-10 md:px-6 md:py-12 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <DocumentTextIcon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Prospectus Review
                </div>
                <h2 className="truncate text-2xl font-bold">{data.note.noteReference}</h2>
                <p className="mt-1 truncate text-sm text-muted-foreground">{data.note.title}</p>
              </div>
            </div>
            <Badge variant="outline" className="shrink-0">
              {formatProspectusReviewStatus(data.review.status, notePublished)}
            </Badge>
          </div>

          <Card className="rounded-2xl">
            <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Note Reference</div>
                <div className="mt-1 truncate text-sm font-semibold">{data.note.noteReference}</div>
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Review Status</div>
                <div className="mt-1 text-sm font-semibold">
                  {formatProspectusReviewStatus(data.review.status, notePublished)}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Last Saved</div>
                <div className="mt-1 text-sm font-semibold">
                  {new Date(data.review.updatedAt).toLocaleString()}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Last Updated By</div>
                <div className="mt-1 truncate text-sm font-semibold" title={actorName}>
                  {actorName}
                </div>
              </div>
            </CardContent>
          </Card>

          <div data-prospectus-steps-grid className={PROSPECTUS_STEPS_GRID_CLASS}>
            <Card className="hidden h-fit rounded-2xl lg:block" data-prospectus-steps-card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Steps</CardTitle>
              </CardHeader>
              <CardContent className="min-w-0">{stepNav}</CardContent>
            </Card>

            <div className={PROSPECTUS_ACTIVE_COLUMN_CLASS}>
              <div className="lg:hidden">
                <Label className="text-sm">Step</Label>
                <Select
                  value={String(step)}
                  onValueChange={(value) => goToStep(Number(value) as ProspectusWorkflowStepId)}
                >
                  <SelectTrigger className="mt-1.5 h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROSPECTUS_STEP_GROUPS.flatMap((group) =>
                      group.steps.map((item) => {
                        const rowStatus = stepStatuses[item.id];
                        const suffix = rowStatus
                          ? ` (${PROSPECTUS_STEP_STATUS_LABEL[rowStatus]})`
                          : "";
                        return (
                          <SelectItem key={item.id} value={String(item.id)}>
                            {PROSPECTUS_STEP_PAGE_LABEL[item.id]} — {item.label}
                            {suffix}
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
              </div>

              <Card className="rounded-2xl" data-prospectus-active-step-card>
                <CardContent className="space-y-6 pt-6">
                  <div
                    className="sr-only"
                    data-prospectus-step-icon={step}
                    aria-hidden="true"
                  />
                  <div ref={stepPanelRef} data-prospectus-step-panel className="space-y-6">
                    {step === 0 ? (
                      note ? (
                        <WorkingAreaPageOne
                          draft={draft}
                          locked={locked}
                          canManage={canManage}
                          dirty={dirty}
                          noteInvestmentSections={noteInvestmentSections}
                          historicalNotes={
                            data.historicalNotes ?? {
                              headers: [],
                              rows: [],
                              emptyStateMessage: "No eligible historical notes found.",
                            }
                          }
                          updateDraft={updateDraft}
                          completionLabel={pageCompletion}
                          activeTab={pageOneTab}
                          onTabChange={setPageOneTab}
                        />
                      ) : (
                        <Skeleton className="h-40 w-full" />
                      )
                    ) : null}

                    {step === 1 ? (
                      <WorkingAreaPageTwo
                        draft={draft}
                        locked={locked}
                        canManage={canManage}
                        dirty={dirty}
                        catalogues={catalogues}
                        issuerProfileRows={issuerRows}
                        invoicePaymasterRows={invoicePaymasterRows}
                        financialComparisonTable={pageTwoFinancialTable}
                        financialComparisonOverrides={
                          draft.page2.financialComparison?.overrides
                        }
                        financialComparisonOpsWarning={financialComparisonOpsWarning}
                        noteRiskRating={note?.riskRating}
                        updateDraft={updateDraft}
                        completionLabel={pageCompletion}
                        completionOptions={completionOptions}
                        activeTab={pageTwoTab}
                        onTabChange={setPageTwoTab}
                      />
                    ) : null}

                    {step === 2 ? (
                      <WorkingAreaPageThree
                        draft={draft}
                        overviewRows={pageThreeMetadataRows}
                        incomeStatementTable={incomeStatementTable}
                        balanceSheetTable={balanceSheetTable}
                        coverageTable={coverageTable}
                        years={incomeStatementYearKeys}
                        manualYears={manualYears}
                        catalogues={catalogues}
                        locked={locked}
                        canManage={canManage}
                        dirty={dirty}
                        updateManualField={updateManualFieldForYear}
                        updateDraft={updateDraft}
                        completionLabel={pageCompletion}
                        completionOptions={completionOptions}
                        activeTab={pageThreeTab}
                        onTabChange={setPageThreeTab}
                      />
                    ) : null}

                    {step === 3 ? (
                      <WorkingAreaPreviewApproval
                        draft={draft}
                        completionOptions={completionOptions}
                        stepStatuses={stepStatuses}
                        onNavigate={(next, tabId) => goToStep(next, true, tabId)}
                        onSave={() => void onSave()}
                        onPreview={() => void onSaveAndPreview()}
                        onApprove={() => void onApprove()}
                        actions={actions}
                        dirty={dirty}
                        savePending={saveDraft.isPending}
                        previewPending={preview.isFetching || saveDraft.isPending}
                        approvePending={approve.isPending}
                        publishBlockedReason={
                          data.publishBlockedReason
                            ? "Prospectus approval required."
                            : status === "APPROVED"
                              ? "Approved and ready to publish from the Note detail page."
                              : null
                        }
                      />
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              {actionBar}
            </div>
          </div>
        </div>
      </div>

      <ProspectusPreviewSheet
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        workflowStep={step}
        statusLabel={previewStatusLabel}
        isLoading={preview.isLoading}
        isFetching={preview.isFetching}
        errorMessage={
          preview.error instanceof Error
            ? preview.error.message
            : preview.error
              ? "Preview failed"
              : null
        }
        html={preview.data?.html ?? null}
      />
    </div>
  );
}

export default function ProspectusReviewPage() {
  return (
    <RequirePermission permission="notes.view">
      <ProspectusReviewPageInner />
    </RequirePermission>
  );
}
