/**
 * SECTION: Application `company_details.directorShareholderWorkflow` JSON
 * WHY: CTOS mismatch + per-person admin review without new DB columns
 * INPUT: Raw `company_details` JSON from Prisma
 * OUTPUT: Parsed workflow object + merge helpers
 * WHERE USED: apps/api admin/issuer flows, admin and issuer UIs
 */

export type DirectorShareholderPersonWorkflowStatus = "PENDING" | "APPROVED" | "UNDER_REVIEW";

export interface DirectorShareholderPersonWorkflow {
  matchKey: string;
  status: DirectorShareholderPersonWorkflowStatus;
  remark?: string;
  updatedAt?: string;
}

export interface DirectorShareholderWorkflowRoot {
  directorShareholderPending?: boolean;
  persons?: Record<string, DirectorShareholderPersonWorkflow>;
  lastMismatchCheckAt?: string;
  lastCtosReportId?: string;
}

const WORKFLOW_KEY = "directorShareholderWorkflow";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getDirectorShareholderWorkflowFromCompanyDetails(
  companyDetails: unknown
): DirectorShareholderWorkflowRoot {
  if (!isObject(companyDetails)) return {};
  const w = companyDetails[WORKFLOW_KEY];
  if (!isObject(w)) return {};
  const personsRaw = w.persons;
  const persons: Record<string, DirectorShareholderPersonWorkflow> = {};
  if (isObject(personsRaw)) {
    for (const [k, v] of Object.entries(personsRaw)) {
      if (!isObject(v)) continue;
      const matchKey = typeof v.matchKey === "string" ? v.matchKey : k;
      const status = v.status;
      if (status !== "PENDING" && status !== "APPROVED" && status !== "UNDER_REVIEW") continue;
      persons[k] = {
        matchKey,
        status,
        remark: typeof v.remark === "string" ? v.remark : undefined,
        updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : undefined,
      };
    }
  }
  return {
    directorShareholderPending: typeof w.directorShareholderPending === "boolean" ? w.directorShareholderPending : undefined,
    persons: Object.keys(persons).length ? persons : undefined,
    lastMismatchCheckAt: typeof w.lastMismatchCheckAt === "string" ? w.lastMismatchCheckAt : undefined,
    lastCtosReportId: typeof w.lastCtosReportId === "string" ? w.lastCtosReportId : undefined,
  };
}

export type DirectorShareholderWorkflowMergePatch = Partial<DirectorShareholderWorkflowRoot> & {
  /** When true, `persons` replaces the map entirely (omit or `{}` clears stored persons). */
  replacePersons?: boolean;
};

export function mergeDirectorShareholderWorkflowIntoCompanyDetails(
  companyDetails: unknown,
  patch: DirectorShareholderWorkflowMergePatch
): Record<string, unknown> {
  const base = isObject(companyDetails) ? { ...companyDetails } : {};
  const prev = getDirectorShareholderWorkflowFromCompanyDetails(base);
  let nextPersons: Record<string, DirectorShareholderPersonWorkflow>;
  if (patch.replacePersons) {
    nextPersons = { ...(patch.persons ?? {}) };
  } else {
    nextPersons = { ...(prev.persons ?? {}) };
    if (patch.persons) {
      Object.assign(nextPersons, patch.persons);
    }
  }
  const merged: DirectorShareholderWorkflowRoot = {
    ...prev,
    directorShareholderPending:
      patch.directorShareholderPending !== undefined ? patch.directorShareholderPending : prev.directorShareholderPending,
    persons: Object.keys(nextPersons).length > 0 ? nextPersons : prev.persons,
    lastMismatchCheckAt: patch.lastMismatchCheckAt ?? prev.lastMismatchCheckAt,
    lastCtosReportId: patch.lastCtosReportId ?? prev.lastCtosReportId,
  };
  const serial: Record<string, unknown> = {};
  if (merged.directorShareholderPending !== undefined) {
    serial.directorShareholderPending = merged.directorShareholderPending;
  }
  if (patch.replacePersons) {
    if (Object.keys(nextPersons).length > 0) {
      serial.persons = nextPersons;
    }
  } else if (merged.persons && Object.keys(merged.persons).length > 0) {
    serial.persons = merged.persons;
  }
  if (merged.lastMismatchCheckAt !== undefined) serial.lastMismatchCheckAt = merged.lastMismatchCheckAt;
  if (merged.lastCtosReportId !== undefined) serial.lastCtosReportId = merged.lastCtosReportId;
  base[WORKFLOW_KEY] = serial;
  return base;
}

export function workflowHasAnyPersonPendingOrUnderReview(workflow: DirectorShareholderWorkflowRoot): boolean {
  const persons = workflow.persons ?? {};
  for (const p of Object.values(persons)) {
    if (p.status === "PENDING" || p.status === "UNDER_REVIEW") return true;
  }
  return false;
}

export function personWorkflowRemarkForMatchKey(
  workflow: DirectorShareholderWorkflowRoot,
  matchKey: string
): string | null {
  const k = matchKey.trim().toUpperCase();
  const persons = workflow.persons ?? {};
  const hit = persons[matchKey] ?? persons[k];
  if (!hit || hit.status !== "UNDER_REVIEW") return null;
  const r = hit.remark?.trim();
  return r && r.length > 0 ? r : null;
}
