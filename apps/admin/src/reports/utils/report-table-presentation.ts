import type { ReportColumn } from "@cashsouk/types";
import type { StatusToken } from "@cashsouk/ui";
import { humanizeAdminTimelineToken } from "@/components/admin-timeline-format";

const SERVICING_STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Not started",
  CURRENT: "Current",
  PARTIAL: "Partial",
  ADVANCE_PAID: "Advance paid",
  OVERDUE: "Overdue",
  LATE: "Late",
  ARREARS: "Arrears",
  DEFAULTED: "Defaulted",
  SETTLED: "Settled",
};

const SERVICING_STATUS_TOKEN: Record<string, StatusToken> = {
  NOT_STARTED: "neutral",
  CURRENT: "active",
  PARTIAL: "submitted",
  ADVANCE_PAID: "active",
  OVERDUE: "action",
  LATE: "action",
  ARREARS: "rejected",
  DEFAULTED: "rejected",
  SETTLED: "success",
};

const DPD_BUCKET_LABEL: Record<string, string> = {
  CURRENT: "Current",
  DPD_1_30: "1–30 days",
  DPD_31_60: "31–60 days",
  DPD_61_90: "61–90 days",
  DPD_90_PLUS: "Over 90 days",
};

const DPD_BUCKET_TOKEN: Record<string, StatusToken> = {
  CURRENT: "active",
  DPD_1_30: "action",
  DPD_31_60: "action",
  DPD_61_90: "rejected",
  DPD_90_PLUS: "rejected",
};

const LISTING_STATUS_LABEL: Record<string, string> = {
  NOT_LISTED: "Not listed",
  DRAFT: "Draft",
  PUBLISHED: "Published",
  UNPUBLISHED: "Unpublished",
  CLOSED: "Closed",
};

const LISTING_STATUS_TOKEN: Record<string, StatusToken> = {
  NOT_LISTED: "neutral",
  DRAFT: "neutral",
  PUBLISHED: "active",
  UNPUBLISHED: "neutral",
  CLOSED: "success",
};

const FUNDING_STATUS_LABEL: Record<string, string> = {
  NOT_OPEN: "Not listed",
  OPEN: "Open",
  FUNDED: "Funded",
  FAILED: "Failed",
  CLOSED: "Closed",
};

const FUNDING_STATUS_TOKEN: Record<string, StatusToken> = {
  NOT_OPEN: "neutral",
  OPEN: "action",
  FUNDED: "success",
  FAILED: "rejected",
  CLOSED: "neutral",
};

const OUTCOME_TOKEN: Record<string, StatusToken> = {
  FUNDED: "success",
  FAILED: "rejected",
  OPEN: "action",
  CLOSED: "neutral",
  "NOT LISTED": "neutral",
};

export type ReportBadgePresentation = {
  kind: "badge";
  label: string;
  token: StatusToken;
  href?: string;
};

function tokenKey(value: string | number | boolean | null): string {
  return String(value ?? "").trim().toUpperCase();
}

export function formatReportEnumLabel(value: string): string {
  const key = tokenKey(value);
  return SERVICING_STATUS_LABEL[key] ?? DPD_BUCKET_LABEL[key] ?? LISTING_STATUS_LABEL[key] ?? FUNDING_STATUS_LABEL[key] ?? humanizeAdminTimelineToken(value);
}

export function reportServicingStatusToken(value: string): StatusToken {
  return SERVICING_STATUS_TOKEN[tokenKey(value)] ?? "neutral";
}

function noteHref(row: Record<string, string | number | boolean | null>): string | undefined {
  const noteId = row.noteId;
  return typeof noteId === "string" && noteId.trim() ? `/notes/${noteId}` : undefined;
}

export function presentReportCell(
  column: ReportColumn,
  row: Record<string, string | number | boolean | null>
): ReportBadgePresentation | null {
  const value = row[column.key] ?? null;
  if (column.key === "noteReference") {
    if (value == null || value === "") return null;
    const raw = String(value);
    return {
      kind: "badge",
      label: formatReportEnumLabel(raw),
      token: reportServicingStatusToken(String(row.servicingStatus ?? "")),
      href: noteHref(row),
    };
  }
  if (column.key === "servicingStatus") {
    if (value == null || value === "") return null;
    const raw = String(value);
    return {
      kind: "badge",
      label: formatReportEnumLabel(raw),
      token: reportServicingStatusToken(raw),
    };
  }
  if (column.key === "dpdBucket") {
    if (value == null || value === "") return null;
    const raw = String(value);
    return {
      kind: "badge",
      label: DPD_BUCKET_LABEL[tokenKey(raw)] ?? formatReportEnumLabel(raw),
      token: DPD_BUCKET_TOKEN[tokenKey(raw)] ?? "neutral",
    };
  }
  if (column.key === "listingStatus") {
    if (value == null || value === "") return null;
    const raw = String(value);
    return {
      kind: "badge",
      label: LISTING_STATUS_LABEL[tokenKey(raw)] ?? formatReportEnumLabel(raw),
      token: LISTING_STATUS_TOKEN[tokenKey(raw)] ?? "neutral",
    };
  }
  if (column.key === "fundingStatus" || column.key === "outcome") {
    if (value == null || value === "") return null;
    const raw = String(value);
    const key = tokenKey(raw);
    return {
      kind: "badge",
      label: FUNDING_STATUS_LABEL[key] ?? formatReportEnumLabel(raw),
      token: FUNDING_STATUS_TOKEN[key] ?? OUTCOME_TOKEN[key] ?? "neutral",
    };
  }
  if (column.kind === "boolean") {
    const yes = value === true || value === "true";
    return {
      kind: "badge",
      label: yes ? "Yes" : "No",
      token: yes ? "rejected" : "neutral",
    };
  }
  return null;
}
