"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { Skeleton } from "@cashsouk/ui";
import {
  PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT,
  PROSPECTUS_HIGHLIGHT_KEYS,
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
  useReopenProspectusReview,
  useSaveProspectusReviewDraft,
  useSubmitProspectusReview,
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
  isProspectusDraftReadyToSubmit,
  statusForCompletionItem,
} from "@/notes/prospectus-review/completion";
import {
  buildIssuerProfileRows,
  buildNoteInvestmentDetailSections,
} from "@/notes/prospectus-review/core-terms";
import {
  buildInvoicePaymasterVerificationRows,
  buildPageTwoFinancialComparisonTable,
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

const MANUAL_INCOME_FIELDS: Array<[string, string, string?]> = [
  ["grossProfit", "Gross Profit", "RM"],
  ["ebitda", "EBITDA", "RM"],
  ["ebit", "EBIT", "RM"],
];

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
  const submit = useSubmitProspectusReview(noteId);
  const approve = useApproveProspectusReview(noteId);
  const reopen = useReopenProspectusReview(noteId);

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
  const locked = status === "APPROVED";
  const notePublished = note?.status === "PUBLISHED" || note?.publishedAt != null;

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

  const onPreview = async () => {
    if (dirty && canManage && !locked) {
      const saved = await onSave();
      if (!saved) return;
    }
    setPreviewOpen(true);
  };

  const onSubmit = async () => {
    if (dirty) {
      toast.error("Save draft before submitting for review");
      return;
    }
    try {
      await submit.mutateAsync();
      toast.success("Submitted for review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Submit failed");
    }
  };

  const onApprove = async () => {
    if (dirty) {
      toast.error("Save draft before approving");
      return;
    }
    if (status !== "READY_FOR_REVIEW") {
      toast.error("Submit for review before approving");
      return;
    }
    try {
      await approve.mutateAsync();
      toast.success("Prospectus approved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approve failed");
    }
  };

  const onReopen = async () => {
    try {
      await reopen.mutateAsync();
      setDirty(false);
      toast.success("Review reopened for editing");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reopen failed");
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
  const checklist = buildProspectusCompletionChecklist(draft);
  const canSubmitReady = isProspectusDraftReadyToSubmit(draft);
  const stepStatuses = getProspectusStepStatuses(draft);
  const noteInvestmentSections = note ? buildNoteInvestmentDetailSections(note) : [];
  const issuerRows = note ? buildIssuerProfileRows(note) : [];
  const invoicePaymasterRows = note ? buildInvoicePaymasterVerificationRows(note) : [];
  const financialStatements = (
    application as { financial_statements?: unknown } | undefined
  )?.financial_statements;
  const pageTwoFinancialTable = buildPageTwoFinancialComparisonTable(financialStatements);
  const pageThreeYears = selectPageThreeYears(financialStatements);
  const activeFinancialYears =
    pageThreeYears.length > 0 ? pageThreeYears : (["2022", "2023", "2024"] as const);
  const yearManual = draft.page3.manualFinancialInputs?.years?.[financialYear];
  const manualYears = draft.page3.manualFinancialInputs?.years;
  const pageThreeOverviewRows = buildPageThreeOverviewRows(financialStatements);
  const pageThreeMetadataRows = note ? buildPageThreeMetadataRows(note) : [];
  const incomeStatementTable = buildPageThreeIncomeStatementTable(
    financialStatements,
    manualYears
  );
  const balanceSheetTable = buildPageThreeBalanceSheetTable(financialStatements, manualYears);
  const coverageTable = buildPageThreeCoverageTable(financialStatements, manualYears);

  const updateManualField = (field: string, value: string) => {
    updateDraft((prev) => {
      const years = { ...(prev.page3.manualFinancialInputs?.years ?? {}) };
      const row = { ...(years[financialYear] ?? {}) };
      row[field] = value === "" ? null : value;
      years[financialYear] = row;
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
    status === "APPROVED" ? ("Approved preview" as const) : ("Draft preview" as const);
  const actions = getProspectusActionVisibility({
    step,
    status: status ?? "DRAFT",
    canManage,
    notePublished,
  });
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
        {actions.saveDraft ? (
          <Button
            variant="outline"
            onClick={() => void onSave()}
            disabled={saveDraft.isPending || !dirty}
          >
            Save Draft
          </Button>
        ) : null}
        {actions.preview ? (
          <Button
            variant="secondary"
            onClick={() => void onPreview()}
            disabled={preview.isFetching}
          >
            Preview Prospectus
          </Button>
        ) : null}
        {actions.submitForReview ? (
          <Button
            onClick={() => void onSubmit()}
            disabled={submit.isPending || dirty || !canSubmitReady}
          >
            Submit for Review
          </Button>
        ) : null}
        {actions.approve ? (
          <Button onClick={() => void onApprove()} disabled={approve.isPending || dirty}>
            Approve Prospectus
          </Button>
        ) : null}
        {actions.reopen ? (
          <Button variant="outline" onClick={() => void onReopen()} disabled={reopen.isPending}>
            Reopen for Editing
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
              {formatProspectusReviewStatus(data.review.status)}
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
                  {formatProspectusReviewStatus(data.review.status)}
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
                        noteInvestmentSections.map((section) => (
                          <section key={section.id}>
                            <ProspectusSectionHeading title={section.title} />
                            <ReadOnlyGrid rows={section.rows} />
                          </section>
                        ))
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
                      <section>
                        <ProspectusSectionHeading title="Issuer Information" />
                        {note ? (
                          <ReadOnlyGrid rows={issuerRows} />
                        ) : (
                          <Skeleton className="h-32 w-full" />
                        )}
                      </section>
                      <section>
                        <ProspectusSectionHeading title="Invoice & Paymaster Information" />
                        {note ? (
                          <ReadOnlyGrid rows={invoicePaymasterRows} />
                        ) : (
                          <Skeleton className="h-32 w-full" />
                        )}
                      </section>
                      <section>
                        <ProspectusSectionHeading title="Paymaster Track Record" />
                        <div className="grid gap-3 md:grid-cols-2">
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
                      <section>
                        <ProspectusSectionHeading title="3-Year Financial Comparison" />
                        <ProspectusFinancialMetricTable table={pageTwoFinancialTable} />
                      </section>
                    </div>
                  ) : null}

                  {step === 3 ? (
                    <div className="space-y-6">
                      <section>
                        <ProspectusSectionHeading title="Credit Insights" />
                        <div className="grid gap-3 md:grid-cols-2">
                          {(
                            [
                              ["creditScoreOptionKey", "Credit Score"],
                              ["paymentBehaviourOptionKey", "Payment Behaviour"],
                              ["creditUtilisationOptionKey", "Credit Utilisation"],
                              ["litigationCheckOptionKey", "Litigation Check"],
                              ["ccrisStatusOptionKey", "CCRIS Status"],
                            ] as const
                          ).map(([field, label]) => (
                            <OptionSelect
                              key={field}
                              label={label}
                              disabled={locked || !canManage}
                              value={draft.page2.creditInsights[field]}
                              options={catalogues.creditInsights}
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
                      <section>
                        <ProspectusSectionHeading title="Invoice / Work Information" />
                        <div className="grid gap-3 md:grid-cols-2">
                          {draft.page2.invoiceWorkStatements.map((s, idx) => (
                            <OptionSelect
                              key={s.key}
                              label={INVOICE_WORK_FIELD_LABELS[s.key] ?? "Invoice statement"}
                              disabled={locked || !canManage}
                              value={s.optionKey}
                              options={catalogues.invoiceWork[s.key] ?? []}
                              onChange={(value) =>
                                updateDraft((prev) => {
                                  const next = structuredClone(prev);
                                  next.page2.invoiceWorkStatements[idx] = {
                                    ...next.page2.invoiceWorkStatements[idx]!,
                                    optionKey: value,
                                    isVisible: value !== "do_not_display",
                                  };
                                  return next;
                                })
                              }
                            />
                          ))}
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
                        {note ? (
                          <ReadOnlyGrid rows={pageThreeMetadataRows} />
                        ) : (
                          <Skeleton className="h-24 w-full" />
                        )}
                      </section>

                      <section>
                        <ProspectusSectionHeading title="Income Statement" />
                        <ProspectusFinancialMetricTable table={incomeStatementTable} />
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
                            <OfficerInputHeading title="Income Statement" />
                            <ManualFinancialInputs
                              fields={MANUAL_INCOME_FIELDS}
                              disabled={locked || !canManage}
                              values={yearManual}
                              onChange={updateManualField}
                            />
                          </div>
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
                        Review the checklist below, then open the prospectus preview before submit
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
                          Publishing stays blocked until this prospectus is approved.
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
