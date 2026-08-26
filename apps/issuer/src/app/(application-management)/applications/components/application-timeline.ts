import type { ApplicationLogEntry } from "@/hooks/use-application-logs";
import type { NormalizedApplication } from "../status";

export type TimelineMilestone = {
  id: string;
  label: string;
  description?: string;
  at: string | null;
  source: "log" | "status";
};

const EVENT_LABELS: Record<string, string> = {
  APPLICATION_CREATED: "You Started This Application",
  APPLICATION_SUBMITTED: "You Submitted This Application",
  APPLICATION_RESUBMITTED: "You Resubmitted This Application",
  APPLICATION_APPROVED: "Application approved",
  APPLICATION_REJECTED: "Your Application Was Not Approved",
  APPLICATION_WITHDRAWN: "You Withdrew This Application",
  APPLICATION_COMPLETED: "Application Completed",
  APPLICATION_RESET_TO_UNDER_REVIEW: "Your Application Is Under Review Again",
  SECTION_REVIEWED_AMENDMENT_REQUESTED: "Changes Requested on a Section",
  ITEM_REVIEWED_AMENDMENT_REQUESTED: "Changes Requested on an Item",
  SECTION_REVIEWED_REJECTED: "A Section Was Not Approved",
  ITEM_REVIEWED_REJECTED: "An Item Was Not Approved",
  CONTRACT_OFFER_SENT: "You Received a Facility Offer",
  CONTRACT_OFFER_ACCEPTANCE_SUBMITTED: "You Submitted Your Facility Offer Acceptance",
  CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED: "You Resubmitted Your Facility Offer Acceptance",
  CONTRACT_OFFER_ACCEPTED: "Facility Offer Accepted",
  CONTRACT_OFFER_REJECTED: "You declined the facility offer",
  CONTRACT_OFFER_RETRACTED: "CashSouk Retracted the Facility Offer",
  CONTRACT_OFFER_EXPIRED: "Facility offer expired",
  CONTRACT_SIGNING_DEADLINE_EXTENDED: "Signing deadline extended",
  CONTRACT_OFFER_DECLINED: "You Declined the Facility Offer",
  INVOICE_OFFER_SENT: "You Received an Invoice Offer",
  INVOICE_OFFER_ACCEPTANCE_SUBMITTED: "You Submitted Your Invoice Offer Acceptance",
  INVOICE_OFFER_ACCEPTANCE_RESUBMITTED: "You Resubmitted Your Invoice Offer Acceptance",
  INVOICE_OFFER_ACCEPTED: "Invoice Offer Accepted",
  INVOICE_OFFER_REJECTED: "You Declined the Invoice Offer",
  INVOICE_OFFER_RETRACTED: "CashSouk Retracted the Invoice Offer",
  INVOICE_OFFER_EXPIRED: "Invoice offer expired",
  INVOICE_SIGNING_DEADLINE_EXTENDED: "Signing deadline extended",
  INVOICE_WITHDRAWN: "Invoice withdrawn",
  OFFER_EXPIRED: "An offer expired",
  AMENDMENTS_SUBMITTED: "Amendments Submitted",
};

/** Events useful for issuer-facing timeline (skip noisy section/item approve noise). */
const ISSUER_VISIBLE_EVENTS = new Set(Object.keys(EVENT_LABELS));

function statusFallbacks(app: NormalizedApplication): TimelineMilestone[] {
  const milestones: TimelineMilestone[] = [];

  milestones.push({
    id: "created",
    label: "Application started",
    at: app.applicationDate ? `${app.applicationDate}T00:00:00.000Z` : app.updatedAt,
    source: "status",
  });

  if (app.submittedAt) {
    milestones.push({
      id: "submitted",
      label: "You submitted this application",
      at: app.submittedAt,
      source: "status",
    });
  }

  if (app.status === "amendment_requested") {
    milestones.push({
      id: "needs-changes",
      label: "Needs changes from you",
      at: app.updatedAt,
      source: "status",
    });
  }

  if (app.status === "offer_sent" || app.cardStatus.showReviewOffer) {
    milestones.push({
      id: "offer-sent",
      label: "Offer waiting for your response",
      description: app.expiresAt
        ? `Respond by ${new Date(app.expiresAt).toLocaleDateString("en-MY", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}`
        : undefined,
      at: app.expiresAt ?? app.updatedAt,
      source: "status",
    });
  }

  if (app.status === "accepted" || app.status === "approved") {
    milestones.push({
      id: "approved",
      label: "Offer accepted / approved",
      at: app.updatedAt,
      source: "status",
    });
  }

  if (app.status === "completed") {
    milestones.push({
      id: "completed",
      label: "Financing completed",
      at: app.updatedAt,
      source: "status",
    });
  }

  if (app.status === "withdrawn" || app.status === "declined" || app.status === "offer_expired") {
    milestones.push({
      id: "closed",
      label:
        app.status === "declined"
          ? "You declined this offer"
          : app.status === "offer_expired"
            ? "Offer expired"
            : "Application withdrawn",
      at: app.updatedAt,
      source: "status",
    });
  }

  if (app.status === "rejected") {
    milestones.push({
      id: "rejected",
      label: "Application was not approved",
      at: app.updatedAt,
      source: "status",
    });
  }

  return milestones;
}

export function buildApplicationTimeline(
  logs: ApplicationLogEntry[],
  application: NormalizedApplication
): TimelineMilestone[] {
  const fromLogs = logs
    .filter((log) => ISSUER_VISIBLE_EVENTS.has(log.event_type))
    .map((log) => {
      const activitySummary =
        typeof log.activity === "string" && log.activity.trim() ? log.activity.trim() : null;
      const remark = log.remark?.trim() || null;
      return {
        id: log.id,
        label: EVENT_LABELS[log.event_type] ?? log.event_type.replace(/_/g, " ").toLowerCase(),
        description: activitySummary ?? remark ?? undefined,
        at: log.created_at || null,
        source: "log" as const,
      };
    });

  if (fromLogs.length > 0) {
    return fromLogs.sort((a, b) => {
      const ta = a.at ? new Date(a.at).getTime() : 0;
      const tb = b.at ? new Date(b.at).getTime() : 0;
      return tb - ta;
    });
  }

  return statusFallbacks(application).sort((a, b) => {
    const ta = a.at ? new Date(a.at).getTime() : 0;
    const tb = b.at ? new Date(b.at).getTime() : 0;
    return tb - ta;
  });
}
