import type { NoteListItem } from "@cashsouk/types";
import {
  isIssuerApplicationActionable,
  type NormalizedApplication,
} from "@/app/(application-management)/applications/status";
import { dashboardNoteFromListItem } from "@/components/financing/financing-invoice-rows";
import { resolveIssuerInvoiceDashboardBadge } from "@/lib/issuer-dashboard-labels";
import type {
  IssuerDashboardContract,
  IssuerDashboardInvoice,
  IssuerDashboardNote,
} from "@/types/issuer-dashboard";

const CLOSED_APPLICATION_KEYS = new Set([
  "completed",
  "withdrawn",
  "declined",
  "rejected",
  "archived",
  "offer_expired",
]);

const REJECTED_FACILITY_STATUSES = new Set(["REJECTED", "WITHDRAWN", "CANCELLED"]);

export type InvoiceLaneKey =
  | "servicing"
  | "raisingNow"
  | "approvedNotListed"
  | "funded"
  | "inReview"
  | "repaid";

export type InvoiceLaneBreakdown = {
  total: number;
  servicing: number;
  raisingNow: number;
  approvedNotListed: number;
  funded: number;
  inReview: number;
  repaid: number;
};

export type IncomingApplicationsSnapshot = {
  openCount: number;
  needsYouCount: number;
  withCashSoukCount: number;
  draftCount: number;
};

export type FacilityBookSnapshot = {
  facilityCount: number;
  activeCount: number;
  closedCount: number;
  approvedAmount: number | null;
  availableAmount: number | null;
  utilizedAmount: number | null;
  pendingAmount: number | null;
  repaidAmount: number | null;
  invoices: InvoiceLaneBreakdown;
};

export type InvoiceBookSnapshot = {
  invoices: InvoiceLaneBreakdown;
};

export type RaisingNowSnapshot = {
  noteCount: number;
  fundedAmount: number;
  targetAmount: number;
  nearestDeadline: string | null;
};

export type IssuerBookSnapshot = {
  incoming: IncomingApplicationsSnapshot;
  facilityBook: FacilityBookSnapshot | null;
  invoiceBook: InvoiceBookSnapshot | null;
  raisingNow: RaisingNowSnapshot | null;
  isEmpty: boolean;
  draftsOnly: boolean;
};

export type BuildIssuerBookSnapshotInput = {
  applications: readonly NormalizedApplication[];
  contracts: readonly IssuerDashboardContract[];
  invoices: readonly IssuerDashboardInvoice[];
  notes: readonly NoteListItem[];
  now?: Date;
};

function applicationBadgeKey(app: NormalizedApplication): string {
  return (app.cardStatus.badgeKey ?? "").toLowerCase();
}

export function isOpenApplication(app: NormalizedApplication): boolean {
  return !CLOSED_APPLICATION_KEYS.has(applicationBadgeKey(app));
}

function emptyLanes(): InvoiceLaneBreakdown {
  return {
    total: 0,
    servicing: 0,
    raisingNow: 0,
    approvedNotListed: 0,
    funded: 0,
    inReview: 0,
    repaid: 0,
  };
}

function addLane(lanes: InvoiceLaneBreakdown, key: InvoiceLaneKey): void {
  if (key === "repaid") {
    lanes.repaid += 1;
    return;
  }
  lanes[key] += 1;
  lanes.total += 1;
}

function parseAmount(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function padDayPart(n: number): string {
  return String(n).padStart(2, "0");
}

function localDayKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${padDayPart(d.getMonth() + 1)}-${padDayPart(d.getDate())}`;
}

function localDayKeyFromString(raw: string | null | undefined): string | null {
  if (raw == null || !String(raw).trim()) return null;
  const s = String(raw).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return localDayKeyFromDate(new Date(t));
}

export function isFacilityExpired(endDate: string | null | undefined, now: Date): boolean {
  const endKey = localDayKeyFromString(endDate);
  if (!endKey) return false;
  return endKey < localDayKeyFromDate(now);
}

export function isNoteRaisingNow(note: {
  listingStatus?: string | null;
  fundingStatus?: string | null;
}): boolean {
  return (
    String(note.listingStatus ?? "").toUpperCase() === "PUBLISHED" &&
    String(note.fundingStatus ?? "").toUpperCase() === "OPEN"
  );
}

function isRealFacility(
  contract: IssuerDashboardContract,
  applications: readonly NormalizedApplication[]
): boolean {
  const linked = applications.filter((app) => app.contractId === contract.id);
  if (linked.some((app) => app.type === "Facility financing")) return true;
  const approved = parseAmount(contract.approvedFacilityAmount);
  return approved != null && approved > 0;
}

function isBookFacility(
  contract: IssuerDashboardContract,
  applications: readonly NormalizedApplication[]
): boolean {
  if (!isRealFacility(contract, applications)) return false;
  const status = String(contract.contractStatus ?? "").toUpperCase();
  if (REJECTED_FACILITY_STATUSES.has(status)) return false;
  if (status === "APPROVED") return true;
  return (
    status === "AMENDMENT_REQUESTED" && (parseAmount(contract.approvedFacilityAmount) ?? 0) > 0
  );
}

function noteForInvoice(
  invoice: IssuerDashboardInvoice,
  notesByInvoiceId: Map<string, NoteListItem>
): IssuerDashboardNote | null {
  if (invoice.note) return invoice.note;
  const listed = notesByInvoiceId.get(invoice.id);
  return listed ? dashboardNoteFromListItem(listed) : null;
}

export function classifyLiveInvoice(
  invoice: IssuerDashboardInvoice,
  note: IssuerDashboardNote | null
): InvoiceLaneKey | null {
  const badge = resolveIssuerInvoiceDashboardBadge(note, invoice.invoiceStatus);
  if (badge === "completed") return "repaid";
  if (badge === "unsuccessful" || badge === "draft") return null;
  if (note && isNoteRaisingNow(note)) return "raisingNow";
  if (badge === "active" || badge === "arrears") return "servicing";
  if (badge === "funded") return "funded";
  if (badge === "in_progress" && String(invoice.invoiceStatus).toUpperCase() === "APPROVED") {
    return "approvedNotListed";
  }
  return "inReview";
}

function buildIncoming(applications: readonly NormalizedApplication[]): IncomingApplicationsSnapshot {
  const open = applications.filter(isOpenApplication);
  let needsYouCount = 0;
  let draftCount = 0;
  let withCashSoukCount = 0;
  for (const app of open) {
    if (isIssuerApplicationActionable(app)) {
      needsYouCount += 1;
      continue;
    }
    if (applicationBadgeKey(app) === "draft") {
      draftCount += 1;
      continue;
    }
    withCashSoukCount += 1;
  }
  return {
    openCount: open.length,
    needsYouCount,
    withCashSoukCount,
    draftCount,
  };
}

function sumContractAmounts(
  contracts: readonly IssuerDashboardContract[],
  pick: (c: IssuerDashboardContract) => string | null
): number | null {
  const values = contracts.map((c) => parseAmount(pick(c))).filter((n): n is number => n != null);
  if (values.length === 0) return null;
  return values.reduce((sum, n) => sum + n, 0);
}

function buildFacilityBook(
  facilities: readonly IssuerDashboardContract[],
  invoices: InvoiceLaneBreakdown,
  now: Date
): FacilityBookSnapshot {
  let closedCount = 0;
  for (const facility of facilities) {
    if (isFacilityExpired(facility.contractEndDate, now)) closedCount += 1;
  }
  const approvedAmount = sumContractAmounts(facilities, (c) => c.approvedFacilityAmount);
  const utilizedAmount = sumContractAmounts(facilities, (c) => c.utilizedFacilityAmount);
  const pendingAmount = sumContractAmounts(facilities, (c) => c.pendingFacilityAmount ?? null);
  const repaidAmount = sumContractAmounts(facilities, (c) => c.repaidFacilityAmount ?? null);
  const availableListed = sumContractAmounts(facilities, (c) => c.availableFacilityAmount);
  const availableAmount =
    availableListed != null
      ? availableListed
      : approvedAmount != null && utilizedAmount != null
        ? approvedAmount - utilizedAmount
        : null;

  return {
    facilityCount: facilities.length,
    activeCount: facilities.length - closedCount,
    closedCount,
    approvedAmount,
    availableAmount,
    utilizedAmount,
    pendingAmount,
    repaidAmount,
    invoices,
  };
}

function buildRaisingNow(
  notes: readonly NoteListItem[],
  invoiceNotes: readonly IssuerDashboardNote[]
): RaisingNowSnapshot | null {
  const byId = new Map<string, { funded: number; target: number; deadline: string | null }>();

  const add = (id: string, funded: number, target: number, deadline: string | null) => {
    if (byId.has(id)) return;
    byId.set(id, { funded, target, deadline });
  };

  for (const note of notes) {
    if (!isNoteRaisingNow(note)) continue;
    add(
      note.id,
      parseAmount(note.fundedAmount) ?? 0,
      parseAmount(note.targetAmount) ?? 0,
      note.listingClosesAt
    );
  }
  for (const note of invoiceNotes) {
    if (!isNoteRaisingNow(note)) continue;
    add(
      note.id,
      parseAmount(note.fundedAmount) ?? 0,
      parseAmount(note.targetAmount) ?? 0,
      note.fundingDeadline
    );
  }

  if (byId.size === 0) return null;

  let fundedAmount = 0;
  let targetAmount = 0;
  let nearestDeadline: string | null = null;
  let nearestMs = Number.POSITIVE_INFINITY;
  for (const row of byId.values()) {
    fundedAmount += row.funded;
    targetAmount += row.target;
    if (!row.deadline) continue;
    const ms = Date.parse(row.deadline);
    if (Number.isNaN(ms) || ms >= nearestMs) continue;
    nearestMs = ms;
    nearestDeadline = row.deadline;
  }

  return {
    noteCount: byId.size,
    fundedAmount,
    targetAmount,
    nearestDeadline,
  };
}

export function formatRaisingDeadline(iso: string | null, now: Date = new Date()): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const label = date.toLocaleDateString("en-MY", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return date.getTime() < now.getTime() ? `closed ${label}` : `closes ${label}`;
}

export function buildIssuerBookSnapshot(input: BuildIssuerBookSnapshotInput): IssuerBookSnapshot {
  const now = input.now ?? new Date();
  const incoming = buildIncoming(input.applications);
  const facilities = input.contracts.filter((contract) => isBookFacility(contract, input.applications));
  const realFacilityIds = new Set(facilities.map((c) => c.id));

  const notesByInvoiceId = new Map<string, NoteListItem>();
  for (const note of input.notes) {
    if (note.sourceInvoiceId) notesByInvoiceId.set(note.sourceInvoiceId, note);
  }

  const facilityInvoices = emptyLanes();
  const standaloneInvoices = emptyLanes();
  const invoiceNotes: IssuerDashboardNote[] = [];

  for (const invoice of input.invoices) {
    const note = noteForInvoice(invoice, notesByInvoiceId);
    if (note) invoiceNotes.push(note);
    const lane = classifyLiveInvoice(invoice, note);
    if (!lane) continue;
    const underFacility = Boolean(invoice.contractId && realFacilityIds.has(invoice.contractId));
    addLane(underFacility ? facilityInvoices : standaloneInvoices, lane);
  }

  const facilityBook =
    facilities.length > 0 ? buildFacilityBook(facilities, facilityInvoices, now) : null;
  const invoiceBook =
    standaloneInvoices.total > 0 || standaloneInvoices.repaid > 0
      ? { invoices: standaloneInvoices }
      : null;
  const raisingNow = buildRaisingNow(input.notes, invoiceNotes);

  const hasIncoming = incoming.openCount > 0;
  const isEmpty = !hasIncoming && facilityBook == null && invoiceBook == null && raisingNow == null;
  const draftsOnly =
    hasIncoming &&
    incoming.draftCount === incoming.openCount &&
    facilityBook == null &&
    invoiceBook == null;

  return {
    incoming,
    facilityBook,
    invoiceBook,
    raisingNow,
    isEmpty,
    draftsOnly,
  };
}
