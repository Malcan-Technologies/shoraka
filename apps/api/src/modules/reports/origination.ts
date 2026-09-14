import { ApplicationStatus, NoteFundingStatus } from "@prisma/client";
import type { ReportQuery, ReportResult, ReportSummaryRow } from "@cashsouk/types";
import { prisma } from "../../lib/prisma";
import { calendarDaysBetween } from "../notes/servicing-classifier";
import { issuerName, postedAtRange, percentOf, reportDefinition, toNumber } from "./report-shared";

export const ORIGINATION_FUNNEL_LABELS = [
  "In review",
  "Awaiting issuer",
  "Completed",
  "Unsuccessful",
] as const;

export type OriginationFunnelLabel = (typeof ORIGINATION_FUNNEL_LABELS)[number];

const IN_REVIEW = new Set<ApplicationStatus>([
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.UNDER_REVIEW,
  ApplicationStatus.CONTRACT_PENDING,
  ApplicationStatus.CONTRACT_ACCEPTED,
  ApplicationStatus.INVOICE_ACCEPTED,
  ApplicationStatus.SIGNING_PENDING,
  ApplicationStatus.INVOICE_PENDING,
  ApplicationStatus.RESUBMITTED,
]);

const AWAITING_ISSUER = new Set<ApplicationStatus>([
  ApplicationStatus.CONTRACT_SENT,
  ApplicationStatus.INVOICES_SENT,
  ApplicationStatus.AMENDMENT_REQUESTED,
]);

const UNSUCCESSFUL = new Set<ApplicationStatus>([
  ApplicationStatus.OFFER_EXPIRED,
  ApplicationStatus.REJECTED,
  ApplicationStatus.WITHDRAWN,
]);

export function originationFunnelLabel(
  status: ApplicationStatus
): OriginationFunnelLabel | null {
  if (status === ApplicationStatus.DRAFT || status === ApplicationStatus.ARCHIVED) return null;
  if (IN_REVIEW.has(status)) return "In review";
  if (AWAITING_ISSUER.has(status)) return "Awaiting issuer";
  if (status === ApplicationStatus.COMPLETED) return "Completed";
  if (UNSUCCESSFUL.has(status)) return "Unsuccessful";
  return null;
}

export function originationOutcome(status: NoteFundingStatus): string {
  if (status === NoteFundingStatus.FUNDED) return "Funded";
  if (status === NoteFundingStatus.FAILED) return "Failed";
  if (status === NoteFundingStatus.OPEN) return "Open";
  if (status === NoteFundingStatus.CLOSED) return "Closed";
  return "Not listed";
}

export function originationDaysOpen(input: {
  publishedAt: Date | null;
  fundingClosedAt: Date | null;
  fundingStatus: NoteFundingStatus;
  toDate: Date;
}): number | null {
  if (!input.publishedAt) return null;
  if (input.fundingStatus === NoteFundingStatus.NOT_OPEN) return null;
  const end = input.fundingClosedAt ?? input.toDate;
  return calendarDaysBetween(input.publishedAt, end);
}

function inRange(value: Date | null, range?: { gte: Date; lt: Date }): boolean {
  if (!value || !range) return false;
  return value >= range.gte && value < range.lt;
}

export async function runOrigination(query: ReportQuery): Promise<ReportResult> {
  const report = reportDefinition("origination");
  const range = postedAtRange(query);
  const toDate = query.to ? new Date(`${query.to}T00:00:00.000Z`) : new Date();
  const notes = await prisma.note.findMany({
    where: range
      ? {
          OR: [
            { published_at: { gte: range.gte, lt: range.lt } },
            { funding_closed_at: { gte: range.gte, lt: range.lt } },
          ],
        }
      : undefined,
    select: {
      id: true,
      note_reference: true,
      issuer_snapshot: true,
      listing_status: true,
      funding_status: true,
      target_amount: true,
      funded_amount: true,
      published_at: true,
      funding_closed_at: true,
    },
    orderBy: { published_at: "desc" },
  });

  const rows = notes.map((note) => {
    const target = toNumber(note.target_amount);
    const funded = toNumber(note.funded_amount);
    return {
      noteId: note.id,
      noteReference: note.note_reference,
      issuerName: issuerName(note.issuer_snapshot),
      listingStatus: note.listing_status,
      fundingStatus: note.funding_status,
      targetAmount: target,
      fundedAmount: funded,
      fundedPercent: percentOf(funded, target),
      publishedAt: note.published_at?.toISOString() ?? null,
      fundingClosedAt: note.funding_closed_at?.toISOString() ?? null,
      daysOpen: originationDaysOpen({
        publishedAt: note.published_at,
        fundingClosedAt: note.funding_closed_at,
        fundingStatus: note.funding_status,
        toDate,
      }),
      outcome: originationOutcome(note.funding_status),
    };
  });

  const applications = await prisma.application.findMany({
    where: range ? { submitted_at: { gte: range.gte, lt: range.lt } } : { submitted_at: { not: null } },
    select: { status: true },
  });
  const funnelCounts = new Map<OriginationFunnelLabel, number>(
    ORIGINATION_FUNNEL_LABELS.map((label) => [label, 0])
  );
  for (const application of applications) {
    const label = originationFunnelLabel(application.status);
    if (!label) continue;
    funnelCounts.set(label, (funnelCounts.get(label) ?? 0) + 1);
  }

  const published = notes.filter((note) => inRange(note.published_at, range) || (!range && note.published_at));
  const closedFunded = notes.filter(
    (note) =>
      note.funding_status === NoteFundingStatus.FUNDED &&
      (range ? inRange(note.funding_closed_at, range) : Boolean(note.funding_closed_at))
  );
  const closedFailed = notes.filter(
    (note) =>
      note.funding_status === NoteFundingStatus.FAILED &&
      (range ? inRange(note.funding_closed_at, range) : Boolean(note.funding_closed_at))
  );
  const closedCount = closedFunded.length + closedFailed.length;
  const closedTarget = [...closedFunded, ...closedFailed].reduce(
    (sum, note) => sum + toNumber(note.target_amount),
    0
  );
  const closedFundedAmount = closedFunded.reduce((sum, note) => sum + toNumber(note.funded_amount), 0);

  const summaries: ReportSummaryRow[] = [
    ...ORIGINATION_FUNNEL_LABELS.map((label) => ({
      label,
      count: funnelCounts.get(label) ?? 0,
    })),
    { label: "Notes published", count: published.length },
    { label: "Funded", count: closedFunded.length, amount: closedFundedAmount },
    { label: "Failed", count: closedFailed.length },
    {
      label: "Success rate",
      percent: percentOf(closedFunded.length, closedCount),
    },
    { label: "Closed target", amount: closedTarget },
  ];

  return {
    key: "origination",
    title: report.title,
    from: query.from ?? null,
    to: query.to ?? null,
    generatedAt: new Date().toISOString(),
    columns: report.columns,
    rows,
    summaries,
  };
}
