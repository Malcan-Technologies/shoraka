"use client";

import {
  PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT,
  PROSPECTUS_HIGHLIGHT_KEYS,
  type ProspectusHistoricalNotesAdminTable,
  type ProspectusReviewStoredContent,
} from "@cashsouk/types";
import { HIGHLIGHT_FIELD_LABELS } from "@/notes/prospectus-review/labels";
import type { CoreTermRow, NoteInvestmentDetailSection } from "@/notes/prospectus-review/core-terms";
import { ProspectusHistoricalNotesTable } from "@/notes/prospectus-review/historical-notes-table";
import {
  ProspectusEditableTextField,
  ProspectusEditableTextarea,
  ProspectusInfoGrid,
  ProspectusPageHeader,
  ProspectusReadOnlyField,
  ProspectusSectionShell,
} from "@/notes/prospectus-review/field-presentation";

export type WorkingAreaPageOneProps = {
  draft: ProspectusReviewStoredContent;
  locked: boolean;
  canManage: boolean;
  dirty: boolean;
  noteInvestmentSections: NoteInvestmentDetailSection[];
  historicalNotes: ProspectusHistoricalNotesAdminTable;
  updateDraft: (
    updater: (prev: ProspectusReviewStoredContent) => ProspectusReviewStoredContent
  ) => void;
  completionLabel?: string;
};

function sectionRows(
  sections: NoteInvestmentDetailSection[],
  ids: string[]
): CoreTermRow[] {
  return sections.filter((s) => ids.includes(s.id)).flatMap((s) => s.rows);
}

function ReadOnlyRows({ rows }: { rows: CoreTermRow[] }) {
  return (
    <ProspectusInfoGrid>
      {rows.map((row) => (
        <ProspectusReadOnlyField key={row.label} label={row.label} value={row.value} />
      ))}
    </ProspectusInfoGrid>
  );
}

export function WorkingAreaPageOne({
  draft,
  locked,
  canManage,
  dirty,
  noteInvestmentSections,
  historicalNotes,
  updateDraft,
  completionLabel,
}: WorkingAreaPageOneProps) {
  const disabled = locked || !canManage;
  const noteOverviewRows = sectionRows(noteInvestmentSections, [
    "note-details",
    "dates-paymaster",
  ]);
  const riskRows =
    noteInvestmentSections.find((s) => s.id === "risk-information")?.rows ?? [];
  const investmentTermRows =
    noteInvestmentSections.find((s) => s.id === "investment-terms")?.rows ?? [];
  const issuerTrackRows =
    noteInvestmentSections.find((s) => s.id === "issuer-track-record")?.rows ?? [];

  return (
    <div className="space-y-8" data-prospectus-working-page="1">
      <ProspectusPageHeader
        title="Page 1 / Investment Overview"
        subtitle="Note facts, highlights, and issuer history"
        completionLabel={completionLabel}
        dirty={dirty}
      />

      <ProspectusSectionShell title="Note Overview">
        <ReadOnlyRows rows={noteOverviewRows} />
      </ProspectusSectionShell>

      <ProspectusSectionShell title="Risk Information">
        <ProspectusInfoGrid>
          {riskRows.map((row) => (
            <ProspectusReadOnlyField
              key={row.label}
              label={row.label}
              value={row.value}
              source="Invoice Offer"
              className={
                row.label === "Risk Explanation"
                  ? "sm:col-span-2 lg:col-span-3"
                  : undefined
              }
            />
          ))}
        </ProspectusInfoGrid>
      </ProspectusSectionShell>

      <ProspectusSectionShell title="Investment Terms">
        <ReadOnlyRows rows={investmentTermRows} />
      </ProspectusSectionShell>

      <ProspectusSectionShell title="Investor Highlights">
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

            if (isShariah) {
              return (
                <div key={key} className="space-y-3">
                  <div className="text-sm font-semibold text-foreground">{label}</div>
                  <ProspectusInfoGrid columns={2}>
                    <ProspectusReadOnlyField label="Highlight Title" value={title} />
                    <ProspectusReadOnlyField
                      label="Highlight Description"
                      value={description}
                      className="sm:col-span-2 lg:col-span-1"
                    />
                  </ProspectusInfoGrid>
                </div>
              );
            }

            return (
              <div key={key} className="space-y-3 rounded-xl border border-border px-4 py-4">
                <div className="text-sm font-semibold text-foreground">{label}</div>
                <ProspectusEditableTextField
                  label="Highlight Title"
                  value={title}
                  disabled={disabled}
                  required
                  onChange={(value) =>
                    updateDraft((prev) => {
                      const next = structuredClone(prev);
                      const idx = next.page1.keyInvestorHighlights.findIndex(
                        (h) => h.key === key
                      );
                      const updated = { key, title: value, description: row.description };
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
                  label="Highlight Description"
                  value={description}
                  disabled={disabled}
                  required
                  rows={3}
                  onChange={(value) =>
                    updateDraft((prev) => {
                      const next = structuredClone(prev);
                      const idx = next.page1.keyInvestorHighlights.findIndex(
                        (h) => h.key === key
                      );
                      const updated = { key, title: row.title, description: value };
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
            );
          })}
        </div>
      </ProspectusSectionShell>

      {issuerTrackRows.length > 0 ? (
        <ProspectusSectionShell title="Issuer Track Record">
          <ReadOnlyRows rows={issuerTrackRows} />
        </ProspectusSectionShell>
      ) : null}

      <ProspectusSectionShell title="Historical Notes">
        <ProspectusHistoricalNotesTable table={historicalNotes} />
      </ProspectusSectionShell>
    </div>
  );
}
