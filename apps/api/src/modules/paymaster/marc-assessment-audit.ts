/**
 * Organization-level MARC assessment audit evidence.
 * Stores business fields only; S3 object keys stay technical metadata.
 */

import type { MarcAssessmentSnapshot } from "@cashsouk/types";

export const MARC_ASSESSMENT_SAVED = "MARC_ASSESSMENT_SAVED";

export const MARC_ASSESSMENT_AUDIT_FIELDS = [
  "creditGrade",
  "creditScore",
  "probabilityOfDefault",
  "reportFileName",
  "reportDate",
] as const;

export type MarcAssessmentAuditField = (typeof MARC_ASSESSMENT_AUDIT_FIELDS)[number];

export type MarcAssessmentAuditValues = {
  creditGrade: string | null;
  creditScore: number | null;
  probabilityOfDefault: number | null;
  reportFileName: string | null;
  reportDate: string | null;
};

function numericOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function textOrNull(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function dateKeyOrNull(value: unknown): string | null {
  const text = textOrNull(value);
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toISOString().slice(0, 10);
}

export function marcAssessmentAuditValues(
  snapshot: MarcAssessmentSnapshot | null | undefined
): MarcAssessmentAuditValues | null {
  if (!snapshot) return null;
  return {
    creditGrade: textOrNull(snapshot.creditGrade),
    creditScore: numericOrNull(snapshot.creditScore),
    probabilityOfDefault: numericOrNull(snapshot.probabilityOfDefault),
    reportFileName: textOrNull(snapshot.reportFileName),
    reportDate: dateKeyOrNull(snapshot.reportDate),
  };
}

function fieldEqual(field: MarcAssessmentAuditField, previous: unknown, next: unknown): boolean {
  if (field === "creditScore" || field === "probabilityOfDefault") {
    const a = numericOrNull(previous);
    const b = numericOrNull(next);
    if (a == null && b == null) return true;
    return a === b;
  }
  if (field === "reportDate") {
    return dateKeyOrNull(previous) === dateKeyOrNull(next);
  }
  return textOrNull(previous) === textOrNull(next);
}

export function marcAssessmentUpdatedFields(
  previous: MarcAssessmentAuditValues | null,
  next: MarcAssessmentAuditValues
): MarcAssessmentAuditField[] {
  if (!previous) {
    return MARC_ASSESSMENT_AUDIT_FIELDS.filter((field) => next[field] != null);
  }
  return MARC_ASSESSMENT_AUDIT_FIELDS.filter((field) => !fieldEqual(field, previous[field], next[field]));
}

export function buildMarcAssessmentAuditMetadata(input: {
  organizationId: string;
  organizationReference?: string;
  actorUserId: string;
  previous: MarcAssessmentAuditValues | null;
  next: MarcAssessmentAuditValues;
  reportS3Key?: string | null;
}): Record<string, unknown> {
  const updatedFields = marcAssessmentUpdatedFields(input.previous, input.next);
  return {
    updatedBy: input.actorUserId,
    organizationId: input.organizationId,
    ...(input.organizationReference ? { organizationReference: input.organizationReference } : {}),
    updatedFields,
    previousValues: input.previous,
    nextValues: input.next,
    ...(textOrNull(input.reportS3Key) ? { reportS3Key: textOrNull(input.reportS3Key) } : {}),
  };
}
