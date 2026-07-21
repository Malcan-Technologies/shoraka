"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { Skeleton } from "@cashsouk/ui";
import {
  MARKETPLACE_MIN_COMMIT_MYR,
  PROSPECTUS_COMPANY_SIZE_VALUES,
  PROSPECTUS_CONFIDENCE_GRADING_VALUES,
  PROSPECTUS_DEED_OF_ASSIGNMENT_VALUES,
  PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT,
  PROSPECTUS_HIGHLIGHT_KEYS,
  PROSPECTUS_PAYMASTER_RATING_VALUES,
  SOUKSCORE_RISK_RATING_GRADES,
  isSoukscoreRiskRating,
  normalizeProspectusCompanySize,
  normalizeProspectusConfidenceGrading,
  normalizeProspectusDeedOfAssignment,
  normalizeProspectusPaymasterRating,
  type ProspectusReviewStoredContent,
  type ProspectusReviewStatus,
} from "@cashsouk/types";
import { formatCurrency } from "@cashsouk/config";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  HIGHLIGHT_FIELD_LABELS,
  INVOICE_WORK_FIELD_LABELS,
  PROSPECTUS_STEP_GROUPS,
  PROSPECTUS_STEP_TITLES,
  formatActorDisplayName,
  formatProspectusReviewStatus,
  type ProspectusWorkflowStepId,
} from "@/notes/prospectus-review/labels";
import {
  CHECKLIST_ITEM_STEP,
  PROSPECTUS_STEP_STATUS_LABEL,
  buildProspectusCompletionChecklist,
  getProspectusStepStatuses,
  statusForCompletionItem,
} from "@/notes/prospectus-review/completion";
import {
  appendIssuerTrackRecordSection,
  buildNoteInvestmentDetailSections,
} from "@/notes/prospectus-review/core-terms";
import {
  mergeOfficerOverridesIntoFinancialTable,
  PAGE_TWO_OFFICER_FINANCIAL_METRICS,
} from "@/notes/prospectus-review/page-two-coverage";
import {
  buildPageThreeBalanceSheetTable,
  buildPageThreeCoverageTable,
  buildPageThreeIncomeStatementTable,
  buildPageThreeMetadataRows,
  buildPageThreeOverviewRows,
  selectPageThreeYears,
} from "@/notes/prospectus-review/page-three-coverage";
import { ProspectusFinancialMetricTable } from "@/notes/prospectus-review/financial-metric-table";
import { ProspectusHistoricalNotesTable } from "@/notes/prospectus-review/historical-notes-table";
import { ProspectusIncomeStatementWorkingTable } from "@/notes/prospectus-review/income-statement-working-table";
import { ProspectusPreviewSheet } from "@/notes/prospectus-review/preview-sheet";
import { ProspectusSectionHeading } from "@/notes/prospectus-review/section-heading";
import { ProspectusStatusBadge } from "@/notes/prospectus-review/status-badge";
import { getProspectusActionVisibility } from "@/notes/prospectus-review/action-visibility";
import {
  PROSPECTUS_ACTIVE_COLUMN_CLASS,
  PROSPECTUS_STEP_ICONS,
  PROSPECTUS_STEP_ICON_CLASS,
  PROSPECTUS_STEPS_GRID_CLASS,
} from "@/notes/prospectus-review/step-icons";

function OptionSelect(props: {
  label: string;
  value: string | null | undefined;
  options: Array<{ key: string; label: string }>;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{props.label}</Label>
      <Select
        disabled={props.disabled}
        value={props.value ?? undefined}
        onValueChange={props.onChange}
      >
        <SelectTrigger className="h-11">
          <SelectValue placeholder="Select option" />
        </SelectTrigger>
        <SelectContent>
          {props.options.map((o) => (
            <SelectItem key={o.key} value={o.key}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ReadOnlyGrid({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <div key={row.label} className="min-w-0 rounded-xl border bg-muted/30 px-4 py-3">
          <div className="text-xs text-muted-foreground">{row.label}</div>
          <div className="mt-1 break-words text-sm font-medium text-foreground">{row.value}</div>
        </div>
      ))}
    </div>
  );
}

const MANUAL_BALANCE_FIELDS: Array<[string, string, string?]> = [
  ["cashAndBank", "Cash & Bank", "RM"],
  ["tradeReceivables", "Trade Receivables", "RM"],
  ["totalEquity", "Total Equity", "RM"],
  ["quickRatio", "Quick Ratio"],
];

const MANUAL_COVERAGE_FIELDS: Array<[string, string, string?]> = [
  ["operatingCashFlow", "Operating Cash Flow", "RM"],
  ["freeCashFlow", "Free Cash Flow", "RM"],
  ["interestCoverage", "Interest Coverage"],
  ["dscr", "DSCR"],
  ["debtEquity", "Debt / Equity"],
  ["returnOnAssets", "Return on Assets", "%"],
  ["receivablesDays", "Receivables Days", "days"],
  ["payablesDays", "Payables Days", "days"],
  ["assetTurnover", "Asset Turnover"],
];

function ManualFinancialInputs(props: {
  fields: Array<[string, string, string?]>;
  disabled: boolean;
  values: Record<string, string | number | null | undefined> | undefined;
  onChange: (field: string, value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {props.fields.map(([field, label, unit]) => (
        <div key={field} className="space-y-1.5">
          <Label className="text-sm">
            {label}
            {unit ? ` (${unit})` : ""}
          </Label>
          <Input
            className="h-11"
            type="number"
            disabled={props.disabled}
            value={props.values?.[field] == null ? "" : String(props.values[field])}
            onChange={(e) => props.onChange(field, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}

function OfficerInputHeading({ title }: { title: string }) {
  return (
    <div className="mb-3 border-b border-border pb-2">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
    </div>
  );
}

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
  const [draft, setDraft] = React.useState<ProspectusReviewStoredContent | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [financialYear, setFinancialYear] = React.useState<string>("2024");
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
  /** Editable until Note/Prospectus is published (Approved remains editable). */
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

  const goToStep = React.useCallback(
    (next: ProspectusWorkflowStepId, focusField = false) => {
      setStep(next);
      if (focusField) focusStepPanel();
    },
    [focusStepPanel]
  );

  const goToChecklistItem = (itemId: string) => {
    const mapped = CHECKLIST_ITEM_STEP[itemId];
    if (mapped == null) return;
    goToStep(mapped, true);
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
  const paymasterTrackRows = data?.paymasterTrackRecord?.rows ?? [];
  const financialStatements = (
    application as { financial_statements?: unknown } | undefined
  )?.financial_statements;
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
  const pageThreeYears = selectPageThreeYears(financialStatements);
  const activeFinancialYears =
    pageThreeYears.length > 0 ? pageThreeYears : (["2022", "2023", "2024"] as const);
  const incomeStatementYearKeys = activeFinancialYears.map(String);
  const completionOptions = { incomeStatementYears: incomeStatementYearKeys };
  const checklist = buildProspectusCompletionChecklist(draft, completionOptions);
  const stepStatuses = getProspectusStepStatuses(draft, completionOptions);
  const yearManual = draft.page3.manualFinancialInputs?.years?.[financialYear];
  const manualYears = draft.page3.manualFinancialInputs?.years;
  const pageThreeOverviewRows = buildPageThreeOverviewRows(financialStatements);
  const pageThreeMetadataRows = note
    ? buildPageThreeMetadataRows(note, {
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
  const coverageTable = buildPageThreeCoverageTable(financialStatements, manualYears);

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
  const updateManualField = (field: string, value: string) => {
    updateManualFieldForYear(financialYear, field, value);
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
  const StepIcon = PROSPECTUS_STEP_ICONS[step];

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
                      ? `${item.label}, ${PROSPECTUS_STEP_STATUS_LABEL[rowStatus]}`
                      : item.label
                  }
                  onClick={() => goToStep(item.id)}
                >
                  <span
                    className={`min-w-0 flex-1 truncate ${
                      isRequiredIncomplete && !isCurrent ? "font-medium text-foreground" : ""
                    }`}
                  >
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

  const actionBar = (
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
          <Button onClick={() => void onApprove()} disabled={approve.isPending}>
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
                <h2 className="truncate text-2xl font-bold">
                  {data.note.noteReference}
                </h2>
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

            {/*
              flex + gap (not space-y): hidden mobile Select must not add top margin
              to the active-step card on desktop (space-y still margins display:none siblings).
            */}
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
                            {item.label}
                            {suffix}
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
              </div>

              <Card className="rounded-2xl" data-prospectus-active-step-card>
                <CardHeader className="pb-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <StepIcon
                      className={PROSPECTUS_STEP_ICON_CLASS}
                      data-prospectus-step-icon={step}
                      aria-hidden="true"
                    />
                    <CardTitle className="min-w-0 text-base font-semibold text-foreground">
                      {PROSPECTUS_STEP_TITLES[step]}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div ref={stepPanelRef} data-prospectus-step-panel className="space-y-6">
                  {step === 0 ? (
                    <div className="space-y-6">
                      {note ? (
                        <>
                          {noteInvestmentSections.map((section) => (
                            <section key={section.id}>
                              <ProspectusSectionHeading title={section.title} />
                              {section.id === "issuer-track-record" ? (
                                <p className="mb-3 text-sm text-muted-foreground">
                                  These figures are calculated automatically from the issuer&apos;s
                                  previous CashSouk Notes.
                                </p>
                              ) : null}
                              <ReadOnlyGrid rows={section.rows} />
                            </section>
                          ))}
                          <section data-prospectus-historical-notes>
                            <ProspectusSectionHeading title="Historical Notes" />
                            <p className="mb-3 text-sm text-muted-foreground">
                              Previous eligible Notes for this issuer, excluding the current Note.
                            </p>
                            <ProspectusHistoricalNotesTable
                              table={
                                data?.historicalNotes ?? {
                                  headers: [],
                                  rows: [],
                                  emptyStateMessage: "No notes are available yet.",
                                }
                              }
                            />
                          </section>
                        </>
                      ) : (
                        <Skeleton className="h-40 w-full" />
                      )}
                    </div>
                  ) : null}

                  {step === 1 ? (
                    <div className="space-y-6">
                      <section>
                        <ProspectusSectionHeading title="Key Investor Highlights" />
                        <div className="space-y-4">
                          {PROSPECTUS_HIGHLIGHT_KEYS.map((key) => {
                            const row =
                              draft.page1.keyInvestorHighlights.find((h) => h.key === key) ?? {
                                key,
                                title: "",
                                description: "",
                              };
                            const label = HIGHLIGHT_FIELD_LABELS[key] ?? "Investor Highlight";
                            const isShariah = key === "shariah";
                            const title = isShariah
                              ? PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT.title
                              : row.title;
                            const description = isShariah
                              ? PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT.description
                              : row.description;

                            return (
                              <div
                                key={key}
                                className="space-y-3 rounded-xl border bg-muted/20 px-4 py-4"
                              >
                                <div className="text-[17px] font-semibold text-foreground">
                                  {label}
                                </div>
                                {isShariah ? (
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <div className="min-w-0 rounded-xl border bg-muted/30 px-4 py-3">
                                      <div className="text-xs text-muted-foreground">
                                        Highlight Title
                                      </div>
                                      <div className="mt-1 break-words text-sm font-medium text-foreground">
                                        {title}
                                      </div>
                                    </div>
                                    <div className="min-w-0 rounded-xl border bg-muted/30 px-4 py-3 md:col-span-2">
                                      <div className="text-xs text-muted-foreground">
                                        Highlight Description
                                      </div>
                                      <div className="mt-1 break-words text-sm font-medium text-foreground">
                                        {description}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="grid gap-3">
                                    <div className="space-y-1.5">
                                      <Label className="text-sm" htmlFor={`highlight-title-${key}`}>
                                        Highlight Title
                                      </Label>
                                      <Input
                                        id={`highlight-title-${key}`}
                                        disabled={locked || !canManage}
                                        value={title}
                                        maxLength={160}
                                        onChange={(e) =>
                                          updateDraft((prev) => {
                                            const next = structuredClone(prev);
                                            const idx = next.page1.keyInvestorHighlights.findIndex(
                                              (h) => h.key === key
                                            );
                                            const updated = {
                                              key,
                                              title: e.target.value,
                                              description:
                                                idx >= 0
                                                  ? next.page1.keyInvestorHighlights[idx]!
                                                      .description
                                                  : "",
                                            };
                                            if (idx >= 0) {
                                              next.page1.keyInvestorHighlights[idx] = updated;
                                            } else {
                                              next.page1.keyInvestorHighlights.push(updated);
                                            }
                                            return next;
                                          })
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label
                                        className="text-sm"
                                        htmlFor={`highlight-description-${key}`}
                                      >
                                        Highlight Description
                                      </Label>
                                      <Textarea
                                        id={`highlight-description-${key}`}
                                        disabled={locked || !canManage}
                                        value={description}
                                        maxLength={800}
                                        rows={3}
                                        className="min-h-[5.5rem] text-[17px] leading-7"
                                        onChange={(e) =>
                                          updateDraft((prev) => {
                                            const next = structuredClone(prev);
                                            const idx = next.page1.keyInvestorHighlights.findIndex(
                                              (h) => h.key === key
                                            );
                                            const updated = {
                                              key,
                                              title:
                                                idx >= 0
                                                  ? next.page1.keyInvestorHighlights[idx]!.title
                                                  : "",
                                              description: e.target.value,
                                            };
                                            if (idx >= 0) {
                                              next.page1.keyInvestorHighlights[idx] = updated;
                                            } else {
                                              next.page1.keyInvestorHighlights.push(updated);
                                            }
                                            return next;
                                          })
                                        }
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    </div>
                  ) : null}

                  {step === 2 ? (
                    <div className="space-y-6">
                      <section data-prospectus-issuer-profile>
                        <ProspectusSectionHeading title="Issuer Profile" />
                        <p className="mb-3 text-sm text-muted-foreground">
                          Business profile information shown in the investor Prospectus.
                        </p>
                        {issuerRows.length > 0 ? (
                          <ReadOnlyGrid rows={issuerRows} />
                        ) : (
                          <Skeleton className="h-32 w-full" />
                        )}
                        <div className="mt-4 max-w-md space-y-1.5">
                          <Label htmlFor="prospectus-company-size" className="text-sm">
                            Company Size
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Select the company size to display in the investor Prospectus.
                            Required before Approve.
                          </p>
                          <Select
                            disabled={locked || !canManage}
                            value={officerCompanySize ?? undefined}
                            onValueChange={(value) =>
                              updateDraft((prev) => ({
                                ...prev,
                                page2: {
                                  ...prev.page2,
                                  issuerProfile: {
                                    ...prev.page2.issuerProfile,
                                    companySize: normalizeProspectusCompanySize(value),
                                  },
                                },
                              }))
                            }
                          >
                            <SelectTrigger id="prospectus-company-size" className="h-11">
                              <SelectValue placeholder="Select company size" />
                            </SelectTrigger>
                            <SelectContent>
                              {PROSPECTUS_COMPANY_SIZE_VALUES.map((size) => (
                                <SelectItem key={size} value={size}>
                                  {size}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </section>
                      <section data-prospectus-invoice-paymaster>
                        <ProspectusSectionHeading title="Invoice & Paymaster Information" />
                        <p className="mb-3 text-sm text-muted-foreground">
                          Invoice and paymaster facts shown in the investor Prospectus.
                        </p>
                        {invoicePaymasterRows.length > 0 ? (
                          <ReadOnlyGrid rows={invoicePaymasterRows} />
                        ) : (
                          <Skeleton className="h-32 w-full" />
                        )}
                        <div className="mt-4 grid gap-4 md:grid-cols-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="prospectus-deed-of-assignment" className="text-sm">
                              Deed of Assignment (DOA)
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Required before Approve.
                            </p>
                            <Select
                              disabled={locked || !canManage}
                              value={officerDeedOfAssignment ?? undefined}
                              onValueChange={(value) =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  page2: {
                                    ...prev.page2,
                                    invoicePaymaster: {
                                      ...prev.page2.invoicePaymaster,
                                      deedOfAssignment:
                                        normalizeProspectusDeedOfAssignment(value),
                                    },
                                  },
                                }))
                              }
                            >
                              <SelectTrigger
                                id="prospectus-deed-of-assignment"
                                className="h-11"
                              >
                                <SelectValue placeholder="Select DOA status" />
                              </SelectTrigger>
                              <SelectContent>
                                {PROSPECTUS_DEED_OF_ASSIGNMENT_VALUES.map((value) => (
                                  <SelectItem key={value} value={value}>
                                    {value}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="prospectus-paymaster-rating" className="text-sm">
                              Paymaster Rating
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Required before Approve.
                            </p>
                            <Select
                              disabled={locked || !canManage}
                              value={officerPaymasterRating ?? undefined}
                              onValueChange={(value) =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  page2: {
                                    ...prev.page2,
                                    invoicePaymaster: {
                                      ...prev.page2.invoicePaymaster,
                                      paymasterRating:
                                        normalizeProspectusPaymasterRating(value),
                                    },
                                  },
                                }))
                              }
                            >
                              <SelectTrigger id="prospectus-paymaster-rating" className="h-11">
                                <SelectValue placeholder="Select paymaster rating" />
                              </SelectTrigger>
                              <SelectContent>
                                {PROSPECTUS_PAYMASTER_RATING_VALUES.map((value) => (
                                  <SelectItem key={value} value={value}>
                                    {value}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="prospectus-confidence-grading" className="text-sm">
                              Confidence Grading
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              Required before Approve.
                            </p>
                            <Select
                              disabled={locked || !canManage}
                              value={officerConfidenceGrading ?? undefined}
                              onValueChange={(value) =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  page2: {
                                    ...prev.page2,
                                    invoicePaymaster: {
                                      ...prev.page2.invoicePaymaster,
                                      confidenceGrading:
                                        normalizeProspectusConfidenceGrading(value),
                                    },
                                  },
                                }))
                              }
                            >
                              <SelectTrigger
                                id="prospectus-confidence-grading"
                                className="h-11"
                              >
                                <SelectValue placeholder="Select confidence grading" />
                              </SelectTrigger>
                              <SelectContent>
                                {PROSPECTUS_CONFIDENCE_GRADING_VALUES.map((value) => (
                                  <SelectItem key={value} value={value}>
                                    {value}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </section>
                      <section data-prospectus-paymaster-track-record>
                        <ProspectusSectionHeading title="Paymaster Track Record" />
                        <p className="mb-3 text-sm text-muted-foreground">
                          Historical payment performance for the selected Paymaster.
                        </p>
                        {paymasterTrackRows.length > 0 ? (
                          <ReadOnlyGrid rows={paymasterTrackRows} />
                        ) : (
                          <Skeleton className="h-32 w-full" />
                        )}
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {(
                            [
                              ["totalInvoicesPaid", "Total Invoices Paid", ""],
                              ["totalAmountPaid", "Total Amount Paid", "RM"],
                              ["successfulRepaymentPercent", "Successful Repayment", "%"],
                              ["onTimePaymentPercent", "On-Time Payment", "%"],
                              ["averagePaymentPeriodDays", "Average Payment Period", "days"],
                            ] as const
                          ).map(([key, label, unit]) => (
                            <div key={key} className="space-y-1.5">
                              <Label className="text-sm">
                                {label}
                                {unit ? ` (${unit})` : ""}
                              </Label>
                              <Input
                                className="h-11"
                                type="number"
                                disabled={locked || !canManage}
                                value={
                                  draft.page2.paymasterTrackRecord?.[key] == null
                                    ? ""
                                    : String(draft.page2.paymasterTrackRecord[key])
                                }
                                onChange={(e) =>
                                  updateDraft((prev) => ({
                                    ...prev,
                                    page2: {
                                      ...prev.page2,
                                      paymasterTrackRecord: {
                                        ...prev.page2.paymasterTrackRecord,
                                        [key]:
                                          e.target.value === ""
                                            ? null
                                            : key === "totalInvoicesPaid"
                                              ? Number(e.target.value)
                                              : e.target.value,
                                      },
                                    },
                                  }))
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </section>
                      <section data-prospectus-financial-comparison>
                        <ProspectusSectionHeading title="3-Year Financial Comparison (MYR mil.)" />
                        <p className="mb-3 text-sm text-muted-foreground">
                          Same year set as Admin Financial Statements (CTOS/audited + management
                          accounts). Latest three years with available data, oldest to newest.
                          Optional officer metrics may be entered below per financial year-end.
                        </p>
                        {financialComparisonOpsWarning ? (
                          <div
                            role="status"
                            data-testid="financial-comparison-ops-warning"
                            className="mb-3 flex gap-2 rounded-lg border border-amber-500/40 bg-amber-50 p-3 text-sm text-foreground dark:bg-amber-950/30"
                          >
                            <ExclamationTriangleIcon
                              className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
                              aria-hidden
                            />
                            <div className="min-w-0 space-y-1">
                              <p className="font-semibold">
                                {financialComparisonOpsWarning.title}
                              </p>
                              <p className="text-[13px] leading-relaxed text-muted-foreground">
                                {financialComparisonOpsWarning.description}
                              </p>
                            </div>
                          </div>
                        ) : null}
                        {data?.financialComparison?.table ? (
                          <ProspectusFinancialMetricTable table={pageTwoFinancialTable} />
                        ) : (
                          <Skeleton className="h-40 w-full" />
                        )}
                        {pageTwoFinancialTable.yearHeaders.length > 0 ? (
                          <div className="mt-4 space-y-4">
                            <p className="text-sm text-muted-foreground">
                              Optional: Net Debt / Equity, Interest Coverage, DSCR, and Receivables
                              Days. Not derived from CTOS or gearing. Empty cells show Data not
                              available.
                            </p>
                            {pageTwoFinancialTable.yearHeaders.map((header) => (
                              <div key={header.key} className="space-y-2">
                                <p className="text-sm font-medium text-foreground">
                                  {header.yearLabel}
                                  <span className="ml-2 text-muted-foreground">
                                    ({header.fyeLabel})
                                  </span>
                                </p>
                                <div className="grid gap-3 md:grid-cols-2">
                                  {PAGE_TWO_OFFICER_FINANCIAL_METRICS.map((metric) => (
                                    <div key={`${header.key}-${metric.key}`} className="space-y-1.5">
                                      <Label className="text-sm">
                                        {metric.label} ({metric.unit})
                                      </Label>
                                      <Input
                                        className="h-11"
                                        type="number"
                                        disabled={locked || !canManage}
                                        value={
                                          draft.page2.financialComparison?.overrides?.[
                                            header.key
                                          ]?.[metric.key] == null
                                            ? ""
                                            : String(
                                                draft.page2.financialComparison.overrides[
                                                  header.key
                                                ]?.[metric.key]
                                              )
                                        }
                                        onChange={(e) =>
                                          updateDraft((prev) => ({
                                            ...prev,
                                            page2: {
                                              ...prev.page2,
                                              financialComparison: {
                                                ...prev.page2.financialComparison,
                                                overrides: {
                                                  ...prev.page2.financialComparison?.overrides,
                                                  [header.key]: {
                                                    ...prev.page2.financialComparison
                                                      ?.overrides?.[header.key],
                                                    [metric.key]:
                                                      e.target.value === ""
                                                        ? null
                                                        : e.target.value,
                                                  },
                                                },
                                              },
                                            },
                                          }))
                                        }
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </section>
                    </div>
                  ) : null}

                  {step === 3 ? (
                    <div className="space-y-6">
                      <section>
                        <ProspectusSectionHeading title="Credit Insights" />
                        <p className="mb-3 text-sm text-muted-foreground">
                          Select the final investor-facing assessment for each item. All five rows
                          are required and always shown on the Prospectus.
                        </p>
                        <div className="grid gap-3 md:grid-cols-2">
                          {(
                            [
                              ["creditScoreOptionKey", "creditScore", "Credit Score"],
                              [
                                "paymentBehaviourOptionKey",
                                "paymentBehaviour",
                                "Payment Behaviour",
                              ],
                              [
                                "creditUtilisationOptionKey",
                                "creditUtilisation",
                                "Credit Utilisation",
                              ],
                              ["litigationCheckOptionKey", "litigationCheck", "Litigation Check"],
                              ["ccrisStatusOptionKey", "ccrisStatus", "CCRIS Status"],
                            ] as const
                          ).map(([field, catalogueKey, label]) => (
                            <OptionSelect
                              key={field}
                              label={label}
                              disabled={locked || !canManage}
                              value={draft.page2.creditInsights[field]}
                              options={catalogues.creditInsights[catalogueKey] ?? []}
                              onChange={(value) =>
                                updateDraft((prev) => ({
                                  ...prev,
                                  page2: {
                                    ...prev.page2,
                                    creditInsights: {
                                      ...prev.page2.creditInsights,
                                      [field]: value,
                                    },
                                  },
                                }))
                              }
                            />
                          ))}
                        </div>
                      </section>
                      <section data-prospectus-about-invoice>
                        <ProspectusSectionHeading title="About the Invoice / Work Performed" />
                        <p className="mb-3 text-sm text-muted-foreground">
                          Same pattern as Key Investor Highlights: suggested wording may be
                          pre-filled. Confirm or edit each statement before Approve. Do not leave
                          claims that are not true for this Note.
                        </p>
                        <div className="space-y-4">
                          {(draft.page2.aboutInvoice?.items ?? []).map((item, idx) => (
                            <div key={item.id} className="space-y-1.5">
                              <Label className="text-sm">
                                {INVOICE_WORK_FIELD_LABELS[item.id] ?? "Invoice statement"}
                                {item.sourceType === "SYSTEM_SUGGESTION" ? (
                                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                                    (suggested)
                                  </span>
                                ) : null}
                              </Label>
                              <Textarea
                                className="min-h-[5.5rem] text-[17px] leading-7"
                                disabled={locked || !canManage}
                                value={item.text}
                                onChange={(e) =>
                                  updateDraft((prev) => {
                                    const items = [
                                      ...(prev.page2.aboutInvoice?.items ?? []),
                                    ];
                                    items[idx] = {
                                      ...items[idx]!,
                                      text: e.target.value,
                                      sourceType: "OFFICER_ENTERED",
                                    };
                                    return {
                                      ...prev,
                                      page2: {
                                        ...prev.page2,
                                        aboutInvoice: { items },
                                      },
                                    };
                                  })
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </section>
                      <section data-prospectus-risk-rating-scale>
                        <ProspectusSectionHeading title="Risk Rating Scale" />
                        <p className="mb-3 text-sm text-muted-foreground">
                          Risk rating is taken from the approved invoice offer and cannot be edited
                          here.
                        </p>
                        <ol
                          className="flex w-full list-none border border-border p-0"
                          aria-label="Risk Rating Scale"
                        >
                          {SOUKSCORE_RISK_RATING_GRADES.map((grade) => {
                            const selected = isSoukscoreRiskRating(note?.riskRating)
                              ? note.riskRating === grade
                              : false;
                            return (
                              <li
                                key={grade}
                                data-grade={grade}
                                data-selected={selected ? "true" : "false"}
                                aria-current={selected ? "true" : undefined}
                                className={
                                  selected
                                    ? "flex-1 border-r border-border px-2 py-2 text-center text-[17px] font-bold leading-7 last:border-r-0 outline outline-2 outline-foreground outline-offset-[-2px] bg-muted"
                                    : "flex-1 border-r border-border px-2 py-2 text-center text-[17px] font-normal leading-7 last:border-r-0"
                                }
                              >
                                {grade}
                              </li>
                            );
                          })}
                        </ol>
                        {!isSoukscoreRiskRating(note?.riskRating) ? (
                          <p className="mt-2 text-sm text-muted-foreground">
                            Risk rating not available
                          </p>
                        ) : null}
                      </section>
                      <section data-prospectus-investment-cta>
                        <ProspectusSectionHeading title="Investment CTA" />
                        <p className="mb-3 text-sm text-muted-foreground">
                          Static Prospectus content. The Invest Now control is shown for layout
                          review only and is not clickable here. Live investing stays on the
                          investor marketplace.
                        </p>
                        <div className="space-y-3">
                          <p className="text-[17px] font-semibold leading-7 tracking-wide">
                            INVEST WITH CONFIDENCE
                          </p>
                          <button
                            type="button"
                            disabled
                            aria-disabled="true"
                            className="inline-flex cursor-default items-center border border-foreground bg-muted px-4 py-2 text-[17px] font-bold leading-7 tracking-wide text-foreground opacity-100 pointer-events-none"
                          >
                            INVEST NOW
                          </button>
                          <p className="text-[17px] leading-7 text-muted-foreground">
                            Minimum investment: {formatCurrency(MARKETPLACE_MIN_COMMIT_MYR)}
                          </p>
                        </div>
                      </section>
                    </div>
                  ) : null}

                  {step === 4 ? (
                    <div className="space-y-6">
                      <section>
                        <ProspectusSectionHeading title="Financial Summary" />
                        <ReadOnlyGrid rows={pageThreeOverviewRows} />
                      </section>

                      <section>
                        <ProspectusSectionHeading title="Financing & Risk Details" />
                        <p className="mb-3 text-sm text-muted-foreground">
                          Paymaster and confidence gradings are taken from the Page 2 Invoice &
                          Paymaster assessment.
                        </p>
                        {note ? (
                          <ReadOnlyGrid rows={pageThreeMetadataRows} />
                        ) : (
                          <Skeleton className="h-24 w-full" />
                        )}
                      </section>

                      <section data-prospectus-income-statement>
                        <ProspectusSectionHeading title="3-Year Income Statement Summary" />
                        <p className="mb-3 text-sm text-muted-foreground">
                          Values sourced from financial statements are read-only. Complete only the
                          missing Prospectus-specific fields.
                        </p>
                        <ProspectusIncomeStatementWorkingTable
                          table={incomeStatementTable}
                          years={incomeStatementYearKeys}
                          manualYears={manualYears ?? {}}
                          disabled={locked || !canManage}
                          onChange={updateManualFieldForYear}
                        />
                      </section>

                      <section>
                        <ProspectusSectionHeading title="Balance Sheet & Liquidity" />
                        <ProspectusFinancialMetricTable table={balanceSheetTable} />
                      </section>

                      <section>
                        <ProspectusSectionHeading title="Cash Flow, Coverage & Efficiency" />
                        <ProspectusFinancialMetricTable table={coverageTable} showTrend />
                      </section>

                      <section>
                        <ProspectusSectionHeading title="Officer Input" />
                        <p className="mb-3 text-sm text-muted-foreground">
                          Balance Sheet and coverage fields that are not available from financial
                          statements. Income Statement officer fields are edited in the table above.
                        </p>
                        <div className="mb-4 flex flex-wrap gap-2">
                          {activeFinancialYears.map((year) => (
                            <Button
                              key={year}
                              size="sm"
                              type="button"
                              variant={financialYear === year ? "secondary" : "outline"}
                              onClick={() => setFinancialYear(year)}
                            >
                              FY{year}
                            </Button>
                          ))}
                        </div>
                        <div className="space-y-6">
                          <div>
                            <OfficerInputHeading title="Balance Sheet & Liquidity" />
                            <ManualFinancialInputs
                              fields={MANUAL_BALANCE_FIELDS}
                              disabled={locked || !canManage}
                              values={yearManual}
                              onChange={updateManualField}
                            />
                          </div>
                          <div>
                            <OfficerInputHeading title="Cash Flow, Coverage & Efficiency" />
                            <ManualFinancialInputs
                              fields={MANUAL_COVERAGE_FIELDS}
                              disabled={locked || !canManage}
                              values={yearManual}
                              onChange={updateManualField}
                            />
                          </div>
                        </div>
                      </section>
                    </div>
                  ) : null}

                  {step === 5 ? (
                    <section>
                      <ProspectusSectionHeading title="Investor Takeaways" />
                      <div className="grid gap-3 md:grid-cols-2">
                        {(
                          [
                            [
                              "revenue_profitability",
                              "revenueProfitabilityOptionKey",
                              "Revenue and Profitability",
                            ],
                            ["liquidity", "liquidityOptionKey", "Liquidity"],
                            ["leverage", "leverageOptionKey", "Leverage"],
                            [
                              "debt_servicing_capacity",
                              "debtServicingCapacityOptionKey",
                              "Debt-Servicing Capacity",
                            ],
                            [
                              "working_capital_efficiency",
                              "workingCapitalEfficiencyOptionKey",
                              "Working-Capital Efficiency",
                            ],
                            [
                              "overall_financial_profile",
                              "overallFinancialProfileOptionKey",
                              "Overall Financial Profile",
                            ],
                          ] as const
                        ).map(([catalogueKey, field, label]) => (
                          <OptionSelect
                            key={field}
                            label={label}
                            disabled={locked || !canManage}
                            value={draft.page3.investorTakeaways[field]}
                            options={catalogues.takeaways[catalogueKey] ?? []}
                            onChange={(value) =>
                              updateDraft((prev) => ({
                                ...prev,
                                page3: {
                                  ...prev.page3,
                                  investorTakeaways: {
                                    ...prev.page3.investorTakeaways,
                                    [field]: value,
                                  },
                                },
                              }))
                            }
                          />
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {step === 6 ? (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Review the checklist below, then Save &amp; Preview and Approve Prospectus
                        or approval.
                      </p>
                      <ul
                        className="overflow-hidden rounded-xl border"
                        aria-label="Prospectus completion checklist"
                      >
                        {checklist.map((item) => {
                          const rowStatus = statusForCompletionItem(item);
                          return (
                            <li key={item.id} className="border-b last:border-b-0">
                              <button
                                type="button"
                                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                                onClick={() => goToChecklistItem(item.id)}
                              >
                                <span className="min-w-0 flex-1 truncate font-medium">
                                  {item.label}
                                </span>
                                <ProspectusStatusBadge status={rowStatus} />
                                <ChevronRightIcon
                                  className="h-4 w-4 shrink-0 text-muted-foreground"
                                  aria-hidden="true"
                                />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      {data.publishBlockedReason ? (
                        <p className="text-sm text-muted-foreground">
                          Prospectus approval required.
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Approved and ready to publish from the Note detail page.
                        </p>
                      )}
                    </div>
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
          preview.error instanceof Error ? preview.error.message : preview.error ? "Preview failed" : null
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
