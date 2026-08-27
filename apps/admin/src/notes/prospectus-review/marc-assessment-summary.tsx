"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import {
  MARC_ASSESSMENT_REQUIRED_MESSAGE,
  isMarcSmeGrade,
  type MarcAssessmentSnapshot,
} from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { issuerMarcHref } from "@/lib/admin-directory-hrefs";
import {
  ProspectusInfoGrid,
  ProspectusReadOnlyField,
} from "@/notes/prospectus-review/field-presentation";

function formatMarcDate(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return format(parsed, "dd MMM yyyy");
}

function formatMarcScore(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  return String(value);
}

function formatMarcPd(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  const raw = String(value).trim();
  return raw.endsWith("%") ? raw : `${raw}%`;
}

export function hasUsableMarcAssessment(
  assessment: MarcAssessmentSnapshot | null | undefined
): boolean {
  return isMarcSmeGrade(assessment?.creditGrade);
}

export function ProspectusMarcAssessmentSummary({
  assessment,
  issuerOrganizationId,
  loading,
}: {
  assessment: MarcAssessmentSnapshot | null | undefined;
  issuerOrganizationId: string | null | undefined;
  loading?: boolean;
}) {
  const orgId = issuerOrganizationId?.trim() || null;
  const href = orgId ? issuerMarcHref(orgId) : null;
  const usable = hasUsableMarcAssessment(assessment);

  return (
    <div className="space-y-3" data-prospectus-marc-assessment>
      <h4 className="text-sm font-semibold text-foreground">MARC Credit Assessment</h4>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading MARC assessment…</p>
      ) : !usable ? (
        <div
          role="status"
          className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-50 p-3 dark:bg-amber-950/30"
        >
          <div className="flex gap-2">
            <ExclamationTriangleIcon
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden
            />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                {MARC_ASSESSMENT_REQUIRED_MESSAGE}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                MARC Credit Grade, Score, and Probability of Default are read from the issuer
                organization assessment.
              </p>
            </div>
          </div>
          {href ? (
            <Button asChild variant="outline" size="sm">
              <Link href={href}>Manage MARC Assessment</Link>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Open the issuer organization to add a MARC assessment.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <ProspectusInfoGrid columns={3}>
            <ProspectusReadOnlyField label="Credit Grade" value={assessment!.creditGrade ?? "—"} />
            <ProspectusReadOnlyField
              label="Credit Score"
              value={formatMarcScore(assessment!.creditScore)}
            />
            <ProspectusReadOnlyField
              label="Probability of Default"
              value={formatMarcPd(assessment!.probabilityOfDefault)}
            />
            <ProspectusReadOnlyField
              label="Report"
              value={assessment!.reportFileName?.trim() || "—"}
            />
            <ProspectusReadOnlyField
              label="Last Updated"
              value={formatMarcDate(assessment!.assessedAt ?? assessment!.reportDate)}
            />
          </ProspectusInfoGrid>
          <div className="flex flex-wrap gap-2">
            {href && assessment!.reportFileName?.trim() ? (
              <Button asChild variant="outline" size="sm">
                <Link href={href}>View Report</Link>
              </Button>
            ) : null}
            {href ? (
              <Button asChild variant="outline" size="sm">
                <Link href={href}>Manage MARC Assessment</Link>
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
