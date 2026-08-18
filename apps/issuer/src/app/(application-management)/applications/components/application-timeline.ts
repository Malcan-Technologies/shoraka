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
  APPLICATION_CREATED: "Application started",
  APPLICATION_SUBMITTED: "You submitted this application",
  APPLICATION_RESUBMITTED: "You resubmitted after changes",
  APPLICATION_APPROVED: "Application approved",
  APPLICATION_REJECTED: "Application was not approved",
  APPLICATION_WITHDRAWN: "You withdrew this application",
  APPLICATION_COMPLETED: "Application completed",
  APPLICATION_RESET_TO_UNDER_REVIEW: "Back under review",
  SECTION_REVIEWED_AMENDMENT_REQUESTED: "Changes requested on a section",
  ITEM_REVIEWED_AMENDMENT_REQUESTED: "Changes requested on an item",
  SECTION_REVIEWED_REJECTED: "A section was not approved",
  ITEM_REVIEWED_REJECTED: "An item was not approved",
  CONTRACT_OFFER_SENT: "Facility financing offer sent",
  CONTRACT_OFFER_ACCEPTED: "You accepted the facility offer",
  CONTRACT_OFFER_REJECTED: "You declined the facility offer",
  CONTRACT_OFFER_RETRACTED: "Facility offer was withdrawn by CashSouk",
  CONTRACT_WITHDRAWN: "Facility withdrawn",
  INVOICE_OFFER_SENT: "Invoice financing offer sent",
  INVOICE_OFFER_ACCEPTED: "You accepted an invoice offer",
  INVOICE_OFFER_REJECTED: "You declined an invoice offer",
  INVOICE_OFFER_RETRACTED: "Invoice offer was withdrawn by CashSouk",
  INVOICE_WITHDRAWN: "Invoice withdrawn",
  OFFER_EXPIRED: "An offer expired",
  AMENDMENTS_SUBMITTED: "You submitted requested changes",
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
