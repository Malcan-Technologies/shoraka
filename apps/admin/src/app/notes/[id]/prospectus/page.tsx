"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { Skeleton } from "@cashsouk/ui";
import type { ProspectusReviewStoredContent } from "@cashsouk/types";
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
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SystemHealthIndicator } from "@/components/system-health-indicator";
import { RequirePermission } from "@/components/require-permission";
import { usePermissions } from "@/hooks/use-permissions";
import {
  useApproveProspectusReview,
  useProspectusReview,
  useProspectusReviewPreview,
  useReopenProspectusReview,
  useSaveProspectusReviewDraft,
} from "@/notes/hooks/use-prospectus-review";

const STEPS = [
  "Page 1 — Core Terms",
  "Page 1 — Investor Highlights",
  "Page 2 — Issuer and Paymaster",
  "Page 2 — Credit and Invoice Narrative",
  "Page 3 — Financial Review",
  "Page 3 — Investor Takeaways",
  "Final Preview and Approval",
] as const;

function OptionSelect(props: {
  label: string;
  value: string | null | undefined;
  options: Array<{ key: string; label: string }>;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{props.label}</Label>
      <Select
        disabled={props.disabled}
        value={props.value ?? undefined}
        onValueChange={props.onChange}
      >
        <SelectTrigger>
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

function ProspectusReviewPageInner() {
  const params = useParams<{ id: string }>();
  const noteId = params.id;
  const router = useRouter();
  const { can } = usePermissions();
  const canManage = can("notes.manage");

  const { data, isLoading, error } = useProspectusReview(noteId);
  const saveDraft = useSaveProspectusReviewDraft(noteId);
  const approve = useApproveProspectusReview(noteId);
  const reopen = useReopenProspectusReview(noteId);

  const [step, setStep] = React.useState(0);
  const [draft, setDraft] = React.useState<ProspectusReviewStoredContent | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);
  const preview = useProspectusReviewPreview(noteId, showPreview && step === 6);

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

  const locked = data?.review.status === "APPROVED";

  const updateDraft = (updater: (prev: ProspectusReviewStoredContent) => ProspectusReviewStoredContent) => {
    setDraft((prev) => {
      if (!prev) return prev;
      setDirty(true);
      return updater(prev);
    });
  };

  const onSave = async () => {
    if (!draft || !data) return;
    try {
      await saveDraft.mutateAsync({
        draftContent: draft,
        expectedUpdatedAt: data.review.updatedAt,
      });
      setDirty(false);
      toast.success("Draft saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const onApprove = async () => {
    if (dirty) {
      toast.error("Save draft before approving");
      return;
    }
    try {
      await approve.mutateAsync();
      toast.success("Prospectus review approved");
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
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load review"}
      </div>
    );
  }

  const catalogues = data.catalogues;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/notes/${noteId}`)}
            aria-label="Back to note"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Prospectus Review</h1>
            <p className="text-sm text-muted-foreground">
              {data.note.noteReference} · {data.note.title}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{data.review.status}</Badge>
          <SystemHealthIndicator />
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {STEPS.map((label, index) => (
              <Button
                key={label}
                variant={step === index ? "secondary" : "ghost"}
                className="w-full justify-start text-left text-sm"
                onClick={() => {
                  setStep(index);
                  setShowPreview(index === 6);
                }}
              >
                {index + 1}. {label}
              </Button>
            ))}
          </CardContent>
        </Card>

        <div className="min-h-0 space-y-4 overflow-y-auto">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">{STEPS[step]}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Last saved {new Date(data.review.updatedAt).toLocaleString()} · v
                  {data.review.contentVersion}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canManage && !locked ? (
                  <Button onClick={onSave} disabled={saveDraft.isPending || !dirty}>
                    Save Draft
                  </Button>
                ) : null}
                {canManage && locked ? (
                  <Button variant="outline" onClick={onReopen} disabled={reopen.isPending}>
                    Reopen for Editing
                  </Button>
                ) : null}
                {canManage && !locked && step === 6 ? (
                  <Button onClick={onApprove} disabled={approve.isPending || dirty}>
                    Approve
                  </Button>
                ) : null}
                {data.review.status === "APPROVED" ? (
                  <Button onClick={() => router.push(`/notes/${noteId}`)}>Back to Note</Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {step === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Listing Date, Closing Date, Maturity Date, Paymaster, Financing Amount, Minimum
                  Investment, Expected Return, Tenure, Purpose, and SoukScore are auto-derived and
                  read-only in the prospectus. Use the next steps for officer selections.
                </p>
              ) : null}

              {step === 1 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {draft.page1.keyInvestorHighlights.map((h, idx) => (
                    <OptionSelect
                      key={h.key}
                      label={`Highlight: ${h.key}`}
                      disabled={locked || !canManage}
                      value={h.optionKey}
                      options={catalogues.highlights[h.key] ?? []}
                      onChange={(value) =>
                        updateDraft((prev) => {
                          const next = structuredClone(prev);
                          next.page1.keyInvestorHighlights[idx] = {
                            ...next.page1.keyInvestorHighlights[idx]!,
                            optionKey: value,
                            isVisible: value !== "do_not_display",
                          };
                          return next;
                        })
                      }
                    />
                  ))}
                  <OptionSelect
                    label="Payment Basis"
                    disabled={locked || !canManage}
                    value={draft.page1.paymentBasisOptionKey}
                    options={catalogues.paymentBasis}
                    onChange={(value) =>
                      updateDraft((prev) => ({
                        ...prev,
                        page1: { ...prev.page1, paymentBasisOptionKey: value },
                      }))
                    }
                  />
                  <OptionSelect
                    label="Shariah Principle"
                    disabled={locked || !canManage}
                    value={draft.page1.shariahPrincipleOptionKey}
                    options={catalogues.shariahPrinciple}
                    onChange={(value) =>
                      updateDraft((prev) => ({
                        ...prev,
                        page1: { ...prev.page1, shariahPrincipleOptionKey: value },
                      }))
                    }
                  />
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Issuer name and registration number stay hidden from the investor prospectus.
                    Industry, entity type, country, and business description remain auto-derived.
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {(
                      [
                        ["totalInvoicesPaid", "Total Invoices Paid"],
                        ["totalAmountPaid", "Total Amount Paid"],
                        ["successfulRepaymentPercent", "Successful Repayment %"],
                        ["onTimePaymentPercent", "On-time Payment %"],
                        ["averagePaymentPeriodDays", "Average Payment Period (days)"],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key} className="space-y-1.5">
                        <Label>{label}</Label>
                        <Input
                          disabled={locked || !canManage}
                          value={String(draft.page2.paymasterTrackRecord?.[key] ?? "")}
                          onChange={(e) =>
                            updateDraft((prev) => ({
                              ...prev,
                              page2: {
                                ...prev.page2,
                                paymasterTrackRecord: {
                                  ...prev.page2.paymasterTrackRecord,
                                  [key]:
                                    key === "totalInvoicesPaid"
                                      ? e.target.value === ""
                                        ? null
                                        : Number(e.target.value)
                                      : e.target.value === ""
                                        ? null
                                        : e.target.value,
                                },
                              },
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="grid gap-4 md:grid-cols-2">
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
                  {draft.page2.invoiceWorkStatements.map((s, idx) => (
                    <OptionSelect
                      key={s.key}
                      label={`Invoice/Work: ${s.key}`}
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
              ) : null}

              {step === 4 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Confirmed derived fields (Revenue, PAT, ratios, etc.) stay read-only. Enter
                    unsupported fields only, by year (YYYY). Zero is valid.
                  </p>
                  {["2022", "2023", "2024"].map((year) => (
                    <Card key={year}>
                      <CardHeader>
                        <CardTitle className="text-sm">FY{year} manual fills</CardTitle>
                      </CardHeader>
                      <CardContent className="grid gap-3 md:grid-cols-3">
                        {(
                          [
                            "grossProfit",
                            "ebitda",
                            "ebit",
                            "cashAndBank",
                            "tradeReceivables",
                            "totalEquity",
                            "quickRatio",
                            "operatingCashFlow",
                            "freeCashFlow",
                            "interestCoverage",
                            "dscr",
                            "debtEquity",
                            "returnOnAssets",
                            "receivablesDays",
                            "payablesDays",
                            "assetTurnover",
                          ] as const
                        ).map((field) => (
                          <div key={field} className="space-y-1.5">
                            <Label>{field}</Label>
                            <Input
                              disabled={locked || !canManage}
                              value={String(
                                draft.page3.manualFinancialInputs?.years?.[year]?.[field] ?? ""
                              )}
                              onChange={(e) =>
                                updateDraft((prev) => {
                                  const years = {
                                    ...(prev.page3.manualFinancialInputs?.years ?? {}),
                                  };
                                  const row = { ...(years[year] ?? {}) };
                                  row[field] = e.target.value === "" ? null : e.target.value;
                                  years[year] = row;
                                  return {
                                    ...prev,
                                    page3: {
                                      ...prev.page3,
                                      manualFinancialInputs: { years },
                                    },
                                  };
                                })
                              }
                            />
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : null}

              {step === 5 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {(
                    [
                      ["revenue_profitability", "revenueProfitabilityOptionKey", "Revenue and Profitability"],
                      ["liquidity", "liquidityOptionKey", "Liquidity"],
                      ["leverage", "leverageOptionKey", "Leverage"],
                      ["debt_servicing_capacity", "debtServicingCapacityOptionKey", "Debt-Servicing Capacity"],
                      ["working_capital_efficiency", "workingCapitalEfficiencyOptionKey", "Working-Capital Efficiency"],
                      ["overall_financial_profile", "overallFinancialProfileOptionKey", "Overall Financial Profile"],
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
              ) : null}

              {step === 6 ? (
                <div className="space-y-3">
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                    Draft Prospectus — not yet approved. Preview uses the same Page 1–3 builders as
                    publication.
                  </p>
                  {data.publishBlockedReason ? (
                    <p className="text-sm text-muted-foreground">{data.publishBlockedReason}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Approved and ready for marketplace publish from the Note detail page.
                    </p>
                  )}
                  {preview.isLoading ? <Skeleton className="h-40 w-full" /> : null}
                  {preview.data ? (
                    <div className="space-y-4">
                      {(["page1", "page2", "page3"] as const).map((key) => (
                        <iframe
                          key={key}
                          title={`Prospectus ${key}`}
                          className="h-[480px] w-full rounded-md border bg-white"
                          srcDoc={preview.data.html[key]}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
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
