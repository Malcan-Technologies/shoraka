/**
 * SECTION: Unified director/shareholder status badge (display only)
 * WHY: One label from onboarding (KYC/KYB) + screening (AML), no AML-over-KYC priority.
 * INPUT: person.onboarding?.status, person.screening?.status
 * OUTPUT: { label, tone } and optional Tailwind badge fragment
 * WHERE USED: Admin director table, onboarding review dialog; issuer unified section, company details step.
 */

export type DirectorShareholderFinalStatusTone = "success" | "warning" | "danger" | "neutral";

export function getFinalStatusLabel(person: {
  onboarding?: { status?: string | null } | null;
  screening?: { status?: string | null } | null;
}): {
  label: string;
  tone: DirectorShareholderFinalStatusTone;
} {
  const normalize = (v?: string | null) =>
    (v || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");

  const onboarding = normalize(person.onboarding?.status ?? null);
  const screening = normalize(person.screening?.status ?? null);

  const statuses = [onboarding, screening].filter(Boolean);

  if (statuses.some((s) => ["REJECTED", "FAILED", "DECLINED"].includes(s))) {
    return { label: "Action Required", tone: "danger" };
  }

  if (statuses.some((s) => ["EXPIRED", "TIMEOUT"].includes(s))) {
    return { label: "Action Required", tone: "danger" };
  }

  if (
    statuses.some((s) =>
      [
        "WAIT_FOR_APPROVAL",
        "WAITING_FOR_APPROVAL",
        "PENDING_APPROVAL",
        "UNDER_REVIEW",
        "RISK_ASSESSED",
      ].includes(s)
    )
  ) {
    return { label: "Pending Review", tone: "warning" };
  }

  if (
    statuses.some((s) =>
      [
        "PENDING",
        "IN_PROGRESS",
        "PROCESSING",
        "ID_UPLOADED",
        "LIVENESS_STARTED",
        "LIVENESS_PASSED",
        "EMAIL_SENT",
        "SENT",
        "FORM_FILLING",
      ].includes(s)
    )
  ) {
    return { label: "In Progress", tone: "warning" };
  }

  if (
    statuses.length > 0 &&
    statuses.every((s) => ["APPROVED", "AML_APPROVED", "CLEAR"].includes(s))
  ) {
    return { label: "Verified", tone: "success" };
  }

  if (statuses.length === 0) {
    return { label: "Not Started", tone: "neutral" };
  }

  return { label: "In Progress", tone: "warning" };
}

export function getFinalStatusBadgeClassName(tone: DirectorShareholderFinalStatusTone): string {
  switch (tone) {
    case "success":
      return "bg-green-100 text-green-700";
    case "danger":
      return "bg-red-100 text-red-700";
    case "warning":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}
