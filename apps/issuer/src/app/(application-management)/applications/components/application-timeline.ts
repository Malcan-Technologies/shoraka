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
  APPLICATION_REVIEW_STARTED: "CashSouk started reviewing this application",
  APPLICATION_RESUBMITTED: "You resubmitted after changes",
  APPLICATION_AMENDMENT_ACKNOWLEDGED: "You acknowledged requested changes",
  APPLICATION_AMENDMENTS_REQUESTED: "Changes requested",
  APPLICATION_REOPENED_FOR_REVIEW: "Back under review",
  APPLICATION_REJECTED: "Application was not approved",
  APPLICATION_WITHDRAWN: "You withdrew this application",
  APPLICATION_ARCHIVED: "Application archived",
  APPLICATION_COMPLETED: "Application completed",
  APPLICATION_SECTION_REVIEW_UPDATED: "A section review was updated",
  APPLICATION_ITEM_REVIEW_UPDATED: "An item review was updated",
  APPLICATION_DOCUMENT_UPLOADED: "A document was uploaded",
  APPLICATION_DOCUMENT_REMOVED: "A document was removed",
  APPLICATION_DOCUMENT_REPLACED: "A document was replaced",
  CONTRACT_ACCEPTANCE_SUBMITTED: "You submitted contract acceptance",
  CONTRACT_ACCEPTANCE_RESUBMITTED: "You resubmitted contract acceptance",
  CONTRACT_ACCEPTANCE_CHANGES_REQUESTED: "Contract acceptance changes requested",
  CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING: "Contract acceptance approved for signing",
  INVOICE_ACCEPTANCE_SUBMITTED: "You submitted invoice acceptance",
  INVOICE_ACCEPTANCE_RESUBMITTED: "You resubmitted invoice acceptance",
  INVOICE_ACCEPTANCE_CHANGES_REQUESTED: "Invoice acceptance changes requested",
  INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING: "Invoice acceptance approved for signing",
  CONTRACT_OFFER_SENT: "Contract financing offer sent",
  CONTRACT_OFFER_ACCEPTED: "You accepted the contract offer",
  CONTRACT_OFFER_REJECTED: "You declined the contract offer",
  CONTRACT_OFFER_RETRACTED: "Contract offer was withdrawn by CashSouk",
  CONTRACT_OFFER_EXPIRED: "Contract offer expired",
  CONTRACT_SIGNING_DEADLINE_EXTENDED: "Signing deadline extended",
  CONTRACT_WITHDRAWN: "Contract withdrawn",
  INVOICE_OFFER_SENT: "Invoice financing offer sent",
  INVOICE_OFFER_ACCEPTED: "You accepted an invoice offer",
  INVOICE_OFFER_REJECTED: "You declined an invoice offer",
  INVOICE_OFFER_RETRACTED: "Invoice offer was withdrawn by CashSouk",
  INVOICE_OFFER_EXPIRED: "Invoice offer expired",
  INVOICE_SIGNING_DEADLINE_EXTENDED: "Signing deadline extended",
  INVOICE_WITHDRAWN: "Invoice withdrawn",
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
