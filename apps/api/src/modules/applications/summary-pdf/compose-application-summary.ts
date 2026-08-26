import {
  getItemDisplayNameFromScopeKey,
  getOfferAcceptanceFromOfferDetails,
  parseFiniteNumber,
  readFinancingStructureType,
} from "@cashsouk/types";
import {
  buildContractOfferLetterTerms,
  buildInvoiceOfferLetterDto,
  buildInvoiceOfferLetterTerms,
  type ContractOfferDetails,
} from "../offer-letter-pdf";
import { extractDocumentDisplayNames } from "./extract-document-names";
import type {
  ApplicationSummaryLogInput,
  ApplicationSummaryPdfModel,
  ApplicationSummaryRemarkInput,
  ApplicationSummarySource,
  ComposeApplicationSummaryInput,
  SummaryField,
  SummaryInvoiceBlock,
  SummaryRemark,
  SummaryTimelineItem,
} from "./types";

const MALAYSIA_TZ = "Asia/Kuala_Lumpur";

const TITLE = "Application Summary";
const DISCLAIMER =
  "This is an issuer-facing summary of your financing application. It is not an offer letter and is not a legal agreement.";

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
  CONTRACT_OFFER_DECLINED: "Facility offer declined",
  INVOICE_OFFER_SENT: "Invoice financing offer sent",
  INVOICE_OFFER_ACCEPTED: "You accepted an invoice offer",
  INVOICE_OFFER_REJECTED: "You declined an invoice offer",
  INVOICE_OFFER_RETRACTED: "Invoice offer was withdrawn by CashSouk",
  INVOICE_WITHDRAWN: "Invoice withdrawn",
  OFFER_EXPIRED: "An offer expired",
  AMENDMENTS_SUBMITTED: "You submitted requested changes",
};

const ISSUER_VISIBLE_EVENTS = new Set(Object.keys(EVENT_LABELS));

const SECTION_LABELS: Record<string, string> = {
  financial: "Financial statements",
  company_details: "Company details",
  business_details: "Business details",
  supporting_documents: "Supporting documents",
  contract_details: "Facility details",
  acceptance_documents: "Acceptance documents",
  invoice_details: "Invoice details",
};

const ACTION_LABELS: Record<string, string> = {
  AMENDMENT_REQUESTED: "Amendment requested",
  REQUESTED_AMENDMENT: "Amendment requested",
  REJECT: "Not approved",
  REJECTED: "Not approved",
  APPROVE: "Approved",
  APPROVED: "Approved",
};

const STRUCTURE_LABELS: Record<string, string> = {
  invoice_only: "Invoice financing",
  existing_contract: "Facility financing (existing facility)",
  new_contract: "Facility financing (new facility)",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-MY", {
    timeZone: MALAYSIA_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(value);
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-MY", {
    timeZone: MALAYSIA_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}

function formatOptionalDate(value: Date | string | null | undefined): string | null {
  const date = toDate(value ?? null);
  return date ? formatDateTime(date) : null;
}

function formatMoney(value: unknown): string | null {
  const amount = parseFiniteNumber(value);
  if (amount == null) return null;
  return `RM ${amount.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function humanizeToken(value: string): string {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function statusLabel(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return humanizeToken(value.trim());
}

function field(label: string, value: string | null | undefined): SummaryField | null {
  if (!value) return null;
  return { label, value };
}

function fieldsOf(...items: Array<SummaryField | null>): SummaryField[] {
  return items.filter((item): item is SummaryField => item != null);
}

function authorNameFrom(
  map: ComposeApplicationSummaryInput["authorNames"],
  userId: string | null | undefined
): string | null {
  if (!userId?.trim()) return null;
  if (map instanceof Map) return map.get(userId) ?? null;
  return map[userId] ?? null;
}

export function buildSafeSummaryFilename(displayReference: string | null | undefined): string {
  const cleaned = (displayReference ?? "")
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned ? `application-summary-${cleaned}.pdf` : "application-summary.pdf";
}

function financingTypeLabel(financingType: unknown): string | null {
  const record = asRecord(financingType);
  return readString(record?.product_code) ?? readString(record?.product_name);
}

function financingStructureLabel(structure: unknown, hasContract: boolean): string | null {
  const type = readFinancingStructureType(structure);
  if (type) return STRUCTURE_LABELS[type] ?? null;
  if (hasContract) return "Facility financing";
  return null;
}

function composeIdentity(app: ApplicationSummarySource, generatedAt: Date): SummaryField[] {
  return fieldsOf(
    field("Application reference", readString(app.display_reference)),
    field("Status", statusLabel(app.status)),
    field("Created", formatOptionalDate(app.created_at)),
    field("Submitted", formatOptionalDate(app.submitted_at)),
    field("Last updated", formatOptionalDate(app.updated_at)),
    field("Generated", formatDateTime(generatedAt))
  );
}

function composeFacility(app: ApplicationSummarySource): SummaryField[] {
  const contract = app.contract;
  if (!contract) return [];
  const details = asRecord(contract.contract_details);
  const offer = asRecord(contract.offer_details);
  const title =
    readString(details?.title) ??
    readString(details?.contract_title) ??
    null;
  const terms = offer
    ? buildContractOfferLetterTerms("unused", {
        requested_facility: parseFiniteNumber(offer.requested_facility),
        offered_facility: parseFiniteNumber(offer.offered_facility),
        facility_fee_rate_percent: parseFiniteNumber(offer.facility_fee_rate_percent),
        facility_fee_upfront_collect_amount: parseFiniteNumber(
          offer.facility_fee_upfront_collect_amount
        ),
      } satisfies ContractOfferDetails).filter((term) => term.label !== "Our reference (contract ID)")
    : [];
  return [
    ...fieldsOf(
      field("Facility reference", readString(contract.display_reference)),
      field("Facility status", statusLabel(contract.status)),
      field("Facility title", title),
      field("Approved facility", formatMoney(contract.approved_facility)),
      field("Available facility", formatMoney(contract.available_facility))
    ),
    ...terms,
  ];
}

function composeCompany(app: ApplicationSummarySource): SummaryField[] {
  const org = app.issuer_organization;
  const company = asRecord(app.company_details);
  const contact = asRecord(company?.contact_person);
  const customer = asRecord(app.contract?.customer_details);
  const business = asRecord(app.business_details);
  const about = asRecord(business?.about_your_business);
  const why = asRecord(business?.why_raising_funds);
  return fieldsOf(
    field("Company name", readString(org?.name) ?? readString(company?.company_name)),
    field("Company registration", readString(org?.registration_number)),
    field("Contact person", readString(contact?.name)),
    field("Contact position", readString(contact?.position)),
    field("Contact email", readString(contact?.email)),
    field("Customer name", readString(customer?.customer_name) ?? readString(customer?.name)),
    field("Customer registration", readString(customer?.ssm_number)),
    field("What the company does", readString(about?.what_does_company_do)),
    field("Main customers", readString(about?.main_customers)),
    field("Financing purpose", readString(why?.financing_for)),
    field("How funds will be used", readString(why?.how_funds_used))
  );
}

function composeFinancing(app: ApplicationSummarySource): SummaryField[] {
  return fieldsOf(
    field("Financing structure", financingStructureLabel(app.financing_structure, Boolean(app.contract))),
    field("Product", financingTypeLabel(app.financing_type))
  );
}

function invoiceHeading(invoice: NonNullable<ApplicationSummarySource["invoices"]>[number], index: number): string {
  const details = asRecord(invoice.details);
  const number = readString(details?.invoice_number) ?? readString(details?.number);
  const reference = readString(invoice.display_reference);
  if (reference && number) return `${reference} · Invoice ${number}`;
  if (reference) return reference;
  if (number) return `Invoice ${number}`;
  return `Invoice ${index + 1}`;
}

function composeInvoiceOfferTerms(
  invoice: NonNullable<ApplicationSummarySource["invoices"]>[number],
  contractDetails: Record<string, unknown> | null
): SummaryField[] {
  const offer = asRecord(invoice.offer_details);
  if (!offer) return [];
  const dto = buildInvoiceOfferLetterDto(offer, contractDetails);
  const hasCommercial =
    dto.offered_amount != null ||
    dto.requested_amount != null ||
    dto.offered_profit_rate_percent != null ||
    dto.platform_fee_rate_percent != null;
  if (!hasCommercial) return [];
  return buildInvoiceOfferLetterTerms("unused", dto).filter(
    (term) => term.label !== "Our reference (invoice ID)"
  );
}

function composeInvoices(app: ApplicationSummarySource): SummaryInvoiceBlock[] {
  const invoices = app.invoices ?? [];
  const contractDetails = asRecord(app.contract?.contract_details);
  return invoices.map((invoice, index) => {
    const details = asRecord(invoice.details);
    const maturityRaw = readString(details?.maturity_date);
    const maturityDate = maturityRaw ? toDate(maturityRaw) : null;
    const tenure = parseFiniteNumber(details?.financing_tenure_days);
    return {
      heading: invoiceHeading(invoice, index),
      fields: fieldsOf(
        field("Invoice reference", readString(invoice.display_reference)),
        field("Invoice number", readString(details?.invoice_number) ?? readString(details?.number)),
        field("Status", statusLabel(invoice.status)),
        field("Invoice value", formatMoney(details?.value ?? details?.invoice_value)),
        field("Requested financing", formatMoney(details?.requested_amount ?? details?.applied_financing)),
        field("Due date", maturityDate ? formatDate(maturityDate) : maturityRaw),
        field("Requested tenure", tenure != null ? `${tenure} days` : null)
      ),
      offerTerms: composeInvoiceOfferTerms(invoice, contractDetails),
    };
  });
}

function remarkSubject(remark: ApplicationSummaryRemarkInput): string {
  if (remark.scope === "section") {
    return SECTION_LABELS[remark.scope_key] ?? humanizeToken(remark.scope_key || "Section");
  }
  if (remark.scope === "item" && remark.scope_key) {
    const itemName = getItemDisplayNameFromScopeKey(remark.scope_key);
    const sectionKey = remark.scope_key.split(":")[0] ?? "";
    const section = SECTION_LABELS[sectionKey] ?? humanizeToken(sectionKey);
    return itemName && itemName !== "Item" ? `${section} · ${itemName}` : section;
  }
  return SECTION_LABELS[remark.scope_key] ?? humanizeToken(remark.scope || remark.scope_key || "Review remark");
}

function composeRemarks(
  remarks: ApplicationSummaryRemarkInput[] | undefined,
  authorNames: ComposeApplicationSummaryInput["authorNames"]
): SummaryRemark[] {
  if (!remarks?.length) return [];
  return remarks
    .map((row) => {
      const text = readString(row.remark);
      if (!text) return null;
      return {
        subject: remarkSubject(row),
        action: ACTION_LABELS[row.action_type] ?? humanizeToken(row.action_type || "Remark"),
        remark: text,
        authorName: authorNameFrom(authorNames, row.author_user_id),
        at: formatOptionalDate(row.submitted_at ?? row.created_at ?? null),
      };
    })
    .filter((row): row is SummaryRemark => row != null);
}

function sortNewest(items: SummaryTimelineItem[]): SummaryTimelineItem[] {
  return [...items].sort((a, b) => {
    const ta = a.at ? new Date(a.at).getTime() : 0;
    const tb = b.at ? new Date(b.at).getTime() : 0;
    return tb - ta;
  });
}

function offerExpiresAt(app: ApplicationSummarySource): Date | null {
  const contractOffer = asRecord(app.contract?.offer_details);
  const contractDeadline = getOfferAcceptanceFromOfferDetails(contractOffer)?.acceptance_expires_at;
  if (typeof contractDeadline === "string") return toDate(contractDeadline);
  for (const invoice of app.invoices ?? []) {
    const deadline = getOfferAcceptanceFromOfferDetails(asRecord(invoice.offer_details))
      ?.acceptance_expires_at;
    if (typeof deadline === "string") return toDate(deadline);
  }
  return null;
}

function hasPendingOffer(app: ApplicationSummarySource): boolean {
  if (app.contract?.status === "OFFER_SENT") return true;
  return (app.invoices ?? []).some((invoice) => invoice.status === "OFFER_SENT");
}

function statusFallbackTimeline(app: ApplicationSummarySource): SummaryTimelineItem[] {
  const items: SummaryTimelineItem[] = [
    {
      label: "Application started",
      description: null,
      at: formatOptionalDate(app.created_at),
    },
  ];
  if (app.submitted_at) {
    items.push({
      label: "You submitted this application",
      description: null,
      at: formatOptionalDate(app.submitted_at),
    });
  }
  const status = app.status.toUpperCase();
  if (status === "AMENDMENT_REQUESTED") {
    items.push({
      label: "Needs changes from you",
      description: null,
      at: formatOptionalDate(app.updated_at),
    });
  }
  if (hasPendingOffer(app) || status === "CONTRACT_SENT" || status === "INVOICES_SENT") {
    const expires = offerExpiresAt(app);
    items.push({
      label: "Offer waiting for your response",
      description: expires ? `Respond by ${formatDate(expires)}` : null,
      at: formatOptionalDate(expires ?? app.updated_at),
    });
  }
  if (status === "CONTRACT_ACCEPTED" || status === "INVOICE_ACCEPTED") {
    items.push({
      label: "Offer accepted / approved",
      description: null,
      at: formatOptionalDate(app.updated_at),
    });
  }
  if (status === "COMPLETED") {
    items.push({
      label: "Financing completed",
      description: null,
      at: formatOptionalDate(app.updated_at),
    });
  }
  if (status === "WITHDRAWN") {
    items.push({
      label: "Application withdrawn",
      description: null,
      at: formatOptionalDate(app.updated_at),
    });
  }
  if (status === "OFFER_EXPIRED") {
    items.push({
      label: "Offer expired",
      description: null,
      at: formatOptionalDate(app.updated_at),
    });
  }
  if (status === "REJECTED") {
    items.push({
      label: "Application was not approved",
      description: null,
      at: formatOptionalDate(app.updated_at),
    });
  }
  return sortNewest(items);
}

function composeTimeline(
  logs: ApplicationSummaryLogInput[],
  app: ApplicationSummarySource
): SummaryTimelineItem[] {
  const fromLogs = logs
    .filter((log) => ISSUER_VISIBLE_EVENTS.has(log.event_type))
    .map((log) => {
      const activity = readString(log.activity);
      const remark = readString(log.remark);
      return {
        label: EVENT_LABELS[log.event_type] ?? humanizeToken(log.event_type),
        description: activity ?? remark,
        at: formatOptionalDate(log.created_at),
      };
    });
  if (fromLogs.length > 0) return sortNewest(fromLogs);
  return statusFallbackTimeline(app);
}

export function composeApplicationSummary(
  input: ComposeApplicationSummaryInput
): ApplicationSummaryPdfModel {
  const { application, logs, authorNames, generatedAt } = input;
  return {
    title: TITLE,
    disclaimer: DISCLAIMER,
    generatedAtLabel: formatDateTime(generatedAt),
    filename: buildSafeSummaryFilename(application.display_reference),
    identityFields: composeIdentity(application, generatedAt),
    facilityFields: composeFacility(application),
    companyFields: composeCompany(application),
    financingFields: composeFinancing(application),
    invoices: composeInvoices(application),
    remarks: composeRemarks(application.application_review_remarks, authorNames),
    timeline: composeTimeline(logs, application),
    documentNames: extractDocumentDisplayNames(application),
  };
}
