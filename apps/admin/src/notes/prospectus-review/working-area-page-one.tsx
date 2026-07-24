"use client";

import * as React from "react";
import {
  BanknotesIcon,
  ChartBarIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import {
  PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT,
  PROSPECTUS_HIGHLIGHT_KEYS,
  type ProspectusHistoricalNotesAdminTable,
  type ProspectusReviewStoredContent,
} from "@cashsouk/types";
import { cn } from "@/lib/utils";
import { HIGHLIGHT_FIELD_LABELS } from "@/notes/prospectus-review/labels";
import type { CoreTermRow, NoteInvestmentDetailSection } from "@/notes/prospectus-review/core-terms";
import { ProspectusHistoricalNotesTable } from "@/notes/prospectus-review/historical-notes-table";
import { countMissingForTab } from "@/notes/prospectus-review/completion";
import {
  ProspectusEditableTextField,
  ProspectusEditableTextarea,
  ProspectusInfoGrid,
  ProspectusPageHeader,
  ProspectusReadOnlyField,
  ProspectusSectionShell,
} from "@/notes/prospectus-review/field-presentation";
import { ProspectusInternalTabs } from "@/notes/prospectus-review/working-area-tabs";
import type { PageOneTabId } from "@/notes/prospectus-review/working-area-placeholders";
import { HIGHLIGHT_PLACEHOLDERS } from "@/notes/prospectus-review/working-area-placeholders";

export type WorkingAreaPageOneProps = {
  draft: ProspectusReviewStoredContent;
  locked: boolean;
  canManage: boolean;
  noteInvestmentSections: NoteInvestmentDetailSection[];
  historicalNotes: ProspectusHistoricalNotesAdminTable;
  updateDraft: (
    updater: (prev: ProspectusReviewStoredContent) => ProspectusReviewStoredContent
  ) => void;
  completionLabel?: string;
  activeTab?: PageOneTabId;
  onTabChange?: (tab: PageOneTabId) => void;
};

function remapRiskLabel(label: string): string {
  if (label === "Risk Rating") return "Risk Grade";
  if (label === "Risk Label") return "Risk Level";
  if (label === "Risk Explanation") return "Explanation";
  return label;
}

function ReadOnlyRows({
  rows,
  remapLabel,
}: {
  rows: CoreTermRow[];
  remapLabel?: (label: string) => string;
}) {
  return (
    <ProspectusInfoGrid>
      {rows.map((row) => (
        <ProspectusReadOnlyField
          key={row.label}
          label={remapLabel ? remapLabel(row.label) : row.label}
          value={row.value}
          className={
            row.label === "Risk Explanation" || row.label === "Product Description"
              ? "sm:col-span-2 lg:col-span-3"
              : undefined
          }
        />
      ))}
    </ProspectusInfoGrid>
  );
}

export function WorkingAreaPageOne({
  draft,
  locked,
  canManage,
  noteInvestmentSections,
  historicalNotes,
  updateDraft,
  completionLabel,
  activeTab: controlledTab,
  onTabChange,
}: WorkingAreaPageOneProps) {
  const disabled = locked || !canManage;
  const [internalTab, setInternalTab] = React.useState<PageOneTabId>("overview");
  const tab = controlledTab ?? internalTab;
  const setTab = (next: PageOneTabId) => {
    onTabChange?.(next);
    if (controlledTab == null) setInternalTab(next);
  };

  const noteDetails =
    noteInvestmentSections.find((s) => s.id === "note-details")?.rows ?? [];
  const datesPaymaster =
    noteInvestmentSections.find((s) => s.id === "dates-paymaster")?.rows ?? [];
  const riskRows =
    noteInvestmentSections.find((s) => s.id === "risk-information")?.rows ?? [];
  const investmentTermRows =
    noteInvestmentSections.find((s) => s.id === "investment-terms")?.rows ?? [];
  const issuerTrackRows =
    noteInvestmentSections.find((s) => s.id === "issuer-track-record")?.rows ?? [];

  const highlightsMissing = countMissingForTab(draft, "highlights");

  return (
    <div className="space-y-6" data-prospectus-working-page="1">
      <ProspectusPageHeader
        title="Page 1 — Investment Overview"
        completionLabel={completionLabel}
      />

      <ProspectusInternalTabs
        value={tab}
        onChange={setTab}
        aria-label="Page 1 sections"
        tabs={[
          { id: "overview", label: "Overview", missingCount: 0 },
          {
            id: "highlights",
            label: "Investor Highlights",
            missingCount: highlightsMissing,
          },
          { id: "track", label: "Track Record", missingCount: 0 },
        ]}
      />

      {tab === "overview" ? (
        <div className="space-y-6" role="tabpanel">
          <ProspectusSectionShell title="Note Overview" icon={DocumentTextIcon}>
            <ReadOnlyRows rows={noteDetails} />
          </ProspectusSectionShell>
          <ProspectusSectionShell title="Dates & Paymaster" icon={DocumentTextIcon}>
            <ReadOnlyRows rows={datesPaymaster} />
          </ProspectusSectionShell>
          <ProspectusSectionShell title="Risk Information" icon={ShieldCheckIcon}>
            <ReadOnlyRows rows={riskRows} remapLabel={remapRiskLabel} />
          </ProspectusSectionShell>
          <ProspectusSectionShell title="Investment Terms" icon={BanknotesIcon}>
            <ReadOnlyRows rows={investmentTermRows} />
          </ProspectusSectionShell>
        </div>
      ) : null}

      {tab === "highlights" ? (
        <div className="space-y-3" role="tabpanel">
          <ProspectusSectionShell
            title="Investor Highlights"
            icon={SparklesIcon}
            missingCount={highlightsMissing}
          >
            <div className="overflow-hidden rounded-xl border divide-y">
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
                const incomplete =
                  !isShariah && (!title.trim() || !description.trim());

                return (
                  <div
                    key={key}
                    className="grid gap-4 px-4 py-4 lg:grid-cols-[10rem_1fr_1.4fr_5rem]"
                    data-highlight-key={key}
                  >
                    <div className="text-sm font-semibold text-foreground">{label}</div>
                    {isShariah ? (
                      <>
                        <ProspectusReadOnlyField label="Title" value={title} />
                        <ProspectusReadOnlyField
                          label="Description"
                          value={description}
                          className="lg:col-span-1"
                        />
                        <div className="flex items-start">
                          <span className="rounded-md border px-2 py-1 text-xs text-muted-foreground">
                            Fixed
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <ProspectusEditableTextField
                          label="Title"
                          value={title}
                          disabled={disabled}
                          placeholder={
                            key in HIGHLIGHT_PLACEHOLDERS
                              ? HIGHLIGHT_PLACEHOLDERS[key as keyof typeof HIGHLIGHT_PLACEHOLDERS]
                                  .title
                              : "Enter highlight title"
                          }
                          onChange={(value) =>
                            updateDraft((prev) => {
                              const next = structuredClone(prev);
                              const idx = next.page1.keyInvestorHighlights.findIndex(
                                (h) => h.key === key
                              );
                              const updated = {
                                key,
                                title: value,
                                description: row.description,
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
                        <ProspectusEditableTextarea
                          label="Description"
                          value={description}
                          disabled={disabled}
                          rows={3}
                          placeholder={
                            key in HIGHLIGHT_PLACEHOLDERS
                              ? HIGHLIGHT_PLACEHOLDERS[key as keyof typeof HIGHLIGHT_PLACEHOLDERS]
                                  .description
                              : "Enter highlight description"
                          }
                          onChange={(value) =>
                            updateDraft((prev) => {
                              const next = structuredClone(prev);
                              const idx = next.page1.keyInvestorHighlights.findIndex(
                                (h) => h.key === key
                              );
                              const updated = {
                                key,
                                title: row.title,
                                description: value,
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
                        <div className="flex items-start">
                          <span
                            className={cn(
                              "rounded-md border px-2 py-1 text-xs",
                              incomplete
                                ? "border-amber-500/70 text-amber-700 dark:text-amber-400"
                                : "text-muted-foreground"
                            )}
                          >
                            Required
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </ProspectusSectionShell>
        </div>
      ) : null}

      {tab === "track" ? (
        <div className="space-y-6" role="tabpanel">
          {issuerTrackRows.length > 0 ? (
            <ProspectusSectionShell title="Issuer Track Record" icon={ChartBarIcon}>
              <ReadOnlyRows rows={issuerTrackRows} />
            </ProspectusSectionShell>
          ) : null}
          <ProspectusSectionShell title="Historical Notes" icon={ChartBarIcon}>
            <ProspectusHistoricalNotesTable table={historicalNotes} />
          </ProspectusSectionShell>
        </div>
      ) : null}
    </div>
  );
}
