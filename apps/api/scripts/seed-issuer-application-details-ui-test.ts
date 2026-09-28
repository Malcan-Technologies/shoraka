#!/usr/bin/env tsx
/**
 * Dev-only seed: UI coverage for issuer Application Details → Invoices tab.
 *
 * What this script does:
 * - Deletes and recreates only `application.display_reference` values prefixed with `UI TEST -`.
 * - Creates a dedicated issuer user + issuer organization for manual/visual testing.
 * - Seeds issuer applications/invoices covering meaningful ApplicationStatus + InvoiceStatus + offer/fee/signed-letter UX states.
 *
 * IMPORTANT:
 * - Does NOT change production logic. It only inserts test data.
 * - Idempotent: re-running will update the same UI test records (no duplicate spam).
 *
 * Usage (from repo root):
 *   pnpm -C apps/api tsx scripts/seed-issuer-application-details-ui-test.ts
 */

import { createHash } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import type { ApplicationStatus, InvoiceStatus, WithdrawReason } from "@prisma/client";
import type { OfferAcceptanceStatus } from "@cashsouk/types";
import {
  buildBusinessDetails,
  buildCompanyDetails,
  buildDeclarations,
  buildFinancialStatements,
  buildReviewAndSubmit,
  buildSupportingDocuments,
  buildCustomerDetails,
  buildInvoiceDetails,
} from "./seed-application-helpers";

const prisma = new PrismaClient();

const APP_DISPLAY_PREFIX = "UI TEST -";
const TEST_USER_EMAIL = "ui-test-issuer@example.com";
const TEST_USER_COGNITO_SUB = process.env.UI_TEST_ISSUER_COGNITO_SUB ?? "ui-test-issuer-cognito-sub";
const TEST_USER_COGNITO_USERNAME =
  process.env.UI_TEST_ISSUER_COGNITO_USERNAME ?? TEST_USER_EMAIL;
const TEST_ISSUER_ORG_NAME = "UI Test Issuer Org (Application Details)";
const TEST_ISSUER_ORG_REG_NO = "202401055555";
const TEST_ISSUER_ORG_ID = seedCuid("issuerOrg", "ui-test-issuer-app-details");

// IDs must be deterministic so deleting/recreating is stable.
function seedCuid(kind: string, key: string, index = 0): string {
  const digest = createHash("sha256").update(`ui-test|${kind}|${key}|${index}`).digest("hex");
  return `c${digest.slice(0, 24)}`;
}

function plusDaysIso(now: Date, days: number): string {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function minusDaysIso(now: Date, days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function stableDateIso(yyyyMmDd: string): string {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`).toISOString();
}

function seededNumberFromKey(key: string, min: number, max: number): number {
  const digest = createHash("sha256").update(key).digest("hex");
  const n = Number.parseInt(digest.slice(0, 8), 16);
  const span = max - min + 1;
  return min + (n % span);
}

function buildAuthorizedPartiesSnapshot(params: { submittedByUserId: string; submittedAtIso: string }) {
  return {
    submitted_by_user_id: params.submittedByUserId,
    submitted_at: params.submittedAtIso,
    parties: [
      {
        // parseParty ignores this key for entity_kind=ISSUER, but it doesn't hurt.
        key: "authorized-party-issuer-1",
        entity_kind: "ISSUER",
        representatives: [
          {
            name: "Ahmad Hassan",
            email: "ahmad.hassan@example.com",
            ic_number: "850315101234",
            capacity: "director",
          },
        ],
      },
    ],
  };
}

function buildOfferAcceptance(params: {
  status: OfferAcceptanceStatus;
  now: Date;
  submittedByUserId: string;
  acceptanceExpiresAtIso?: string | null;
  signingExpiresAtIso?: string | null;
}) {
  const acceptanceEx = params.acceptanceExpiresAtIso ?? null;
  const signingEx = params.signingExpiresAtIso ?? null;
  const authorized = buildAuthorizedPartiesSnapshot({
    submittedByUserId: params.submittedByUserId,
    submittedAtIso: params.now.toISOString(),
  });

  return {
    status: params.status,
    acceptance_expires_at:
      typeof acceptanceEx === "string" && acceptanceEx.trim().length > 0 ? acceptanceEx : null,
    signing_expires_at:
      typeof signingEx === "string" && signingEx.trim().length > 0 ? signingEx : null,
    authorized_parties: authorized,
    authorized_parties_draft: authorized,
  } satisfies Record<string, unknown> as Prisma.InputJsonValue;
}

type InvoiceOfferFeeSchedule =
  | {
      mode: "v1";
      /**
       * When null/undefined, we omit `platform_fee_rate_percent` from offer_details
       * so the UI suppresses the “Drawdown fee” line.
       */
      platformFeeRatePercent: number | null | undefined;
      facilityFeeCollectAmount: number;
      additionalFees?: Array<{
        name: string;
        kind: "amount" | "percent_of_funded";
        value: number;
      }>;
    }
  | { mode: "grandfather"; platformFeeRatePercent: number };

function buildInvoiceOfferDetails(params: {
  offeredAmount: number;
  acceptance: ReturnType<typeof buildOfferAcceptance>;
  // Optional rejection reason for REJECTED/DECLINED invoices.
  rejectionReason?: string | null;
  // Optional fee/schedule content used by the Invoices fee cell.
  feeSchedule?: InvoiceOfferFeeSchedule;
  // Optional: when present, stamped sent_at for “offer sent” UX.
  sentAtIso?: string | null;
}) {
  const base: Record<string, unknown> = {
    offered_amount: params.offeredAmount,
    offered_profit_rate_percent: 12,
    version: 1,
    risk_rating: "B",
    sent_at: params.sentAtIso ?? null,
    responded_at: null,
    offer_acceptance: params.acceptance,
  };

  if (params.rejectionReason && params.rejectionReason.trim()) {
    base.rejection_reason = params.rejectionReason.trim();
  }

  if (params.feeSchedule?.mode === "v1") {
    base.fee_schedule_version = 1;
    if (params.feeSchedule.platformFeeRatePercent != null) {
      base.platform_fee_rate_percent = params.feeSchedule.platformFeeRatePercent;
    }
    base.facility_fee_collect_amount = params.feeSchedule.facilityFeeCollectAmount;
    base.additional_fees = (params.feeSchedule.additionalFees ?? []).map((l) => ({
      name: l.name,
      kind: l.kind,
      value: l.value,
    }));
  } else if (params.feeSchedule?.mode === "grandfather") {
    base.platform_fee_rate_percent = params.feeSchedule.platformFeeRatePercent;
  }

  return base satisfies Record<string, unknown> as Prisma.InputJsonValue;
}

function buildInvoiceDetailsNoDocument(params: {
  number: string;
  value: number;
  financingRatioPercent: number;
  maturityDateYmd: string;
}) {
  return {
    number: params.number,
    value: params.value,
    financing_ratio_percent: params.financingRatioPercent,
    maturity_date: params.maturityDateYmd,
    due_date: params.maturityDateYmd,
  } satisfies Record<string, unknown> as Prisma.InputJsonValue;
}

function buildOfferExpiryAcceptance(params: {
  now: Date;
  status: OfferAcceptanceStatus;
  submittedByUserId: string;
  acceptanceExpiresAtIso: string;
}) {
  return buildOfferAcceptance({
    status: params.status,
    now: params.now,
    submittedByUserId: params.submittedByUserId,
    acceptanceExpiresAtIso: params.acceptanceExpiresAtIso,
    signingExpiresAtIso: null,
  });
}

async function ensureTestIssuerUserAndOrg() {
  const existingUser = await prisma.user.findUnique({ where: { email: TEST_USER_EMAIL } });
  const user =
    existingUser ??
    (await prisma.user.create({
      data: {
        user_id: seedCuid("user", TEST_USER_EMAIL),
        email: TEST_USER_EMAIL,
        cognito_sub: TEST_USER_COGNITO_SUB,
        cognito_username: TEST_USER_COGNITO_USERNAME,
        roles: ["ISSUER"],
        first_name: "UI",
        last_name: "Test Issuer",
        phone: null,
        investor_account: [],
        issuer_account: [],
      },
    }));

  // Ensure the role + issuer_account link, but don't overwrite cognito_sub once established.
  if (existingUser) {
    await prisma.user.update({
      where: { user_id: existingUser.user_id },
      data: {
        roles: { set: ["ISSUER"] },
        issuer_account: { set: [] },
      },
    });
  }

  // Ensure issuer org exists and is linked to the user.
  const org = await prisma.issuerOrganization.upsert({
    where: { id: TEST_ISSUER_ORG_ID },
    create: {
      id: TEST_ISSUER_ORG_ID,
      owner_user_id: user.user_id,
      type: "COMPANY",
      name: TEST_ISSUER_ORG_NAME,
      registration_number: TEST_ISSUER_ORG_REG_NO,
      onboarding_status: "COMPLETED",
      onboarded_at: new Date(),
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      ssm_checked: true,
      admin_approved_at: new Date(),
      first_name: "UI",
      last_name: "Test Issuer",
      nationality: "MY",
      country: "MY",
      corporate_onboarding_data: Prisma.JsonNull,
      bank_account_details: Prisma.JsonNull,
      wealth_declaration: Prisma.JsonNull,
      compliance_declaration: Prisma.JsonNull,
      director_kyc_status: Prisma.JsonNull,
      director_aml_status: Prisma.JsonNull,
      kyc_response: Prisma.JsonNull,
    },
    update: {
      owner_user_id: user.user_id,
      onboarding_status: "COMPLETED",
      onboarded_at: new Date(),
      onboarding_approved: true,
      aml_approved: true,
      tnc_accepted: true,
      ssm_checked: true,
      admin_approved_at: new Date(),
    },
  });

  // Link user → org for issuer portal (issuer_account).
  await prisma.user.update({
    where: { user_id: user.user_id },
    data: {
      issuer_account: { set: Array.from(new Set([...(user.issuer_account ?? []), org.id])) },
    },
  });

  return { user, org };
}

async function deleteExistingUiTestApps({ displayPrefix }: { displayPrefix: string }) {
  const existingApps = await prisma.application.findMany({
    where: { display_reference: { startsWith: displayPrefix } },
    select: { id: true, contract_id: true },
  });

  if (existingApps.length === 0) return { deletedAppCount: 0, deletedContractCount: 0 };

  const appIds = existingApps.map((a) => a.id);
  const contractIds = existingApps.map((a) => a.contract_id).filter(Boolean) as string[];

  await prisma.application.deleteMany({ where: { id: { in: appIds } } });

  if (contractIds.length > 0) {
    await prisma.contract.deleteMany({ where: { id: { in: contractIds } } });
  }

  return { deletedAppCount: appIds.length, deletedContractCount: contractIds.length };
}

type ScenarioInvoice = {
  index: number;
  invoiceNumber: string;
  valueRm: number;
  financingRatioPercent: number;
  maturityDateYmd: string;
  detailsMode: "withDocument" | "withoutDocument";
  status: InvoiceStatus;
  withdrawReason?: WithdrawReason;
  // When present, sets invoice.offer_details.
  offerDetails:
    | {
        kind: "offer";
        acceptanceStatus: OfferAcceptanceStatus;
        acceptanceExpiresAtIso?: string | null;
        offeredAmount: number;
        feeSchedule?: InvoiceOfferFeeSchedule;
        rejectionReason?: string | null;
        sentAtIso?: string | null;
      }
    | {
        kind: "rejectionReasonOnly";
        rejectionReason?: string | null;
      }
    | { kind: "none" };
};

type Scenario = {
  key: string;
  name: string; // display_reference
  applicationStatus: ApplicationStatus;
  invoiceCount: number;
  invoices: ScenarioInvoice[];
  // Optional signing envelope for “View Signed Offer” dropdown.
  signedInvoiceEnvelopeForInvoiceIndex?: number;
};

function invoiceDetailsForScenario(inv: ScenarioInvoice) {
  const maturityDateYmd = inv.maturityDateYmd;
  const invoiceValue = inv.valueRm;
  const ratio = inv.financingRatioPercent;
  const invoiceNumber = inv.invoiceNumber;

  if (inv.detailsMode === "withoutDocument") {
    return buildInvoiceDetailsNoDocument({
      number: invoiceNumber,
      value: invoiceValue,
      financingRatioPercent: ratio,
      maturityDateYmd,
    });
  }

  // buildInvoiceDetails includes document by default; we keep it.
  return buildInvoiceDetails({
    number: invoiceNumber,
    value: invoiceValue,
    financing_ratio_percent: ratio,
    maturity_date: maturityDateYmd,
  });
}

function computeOfferAcceptanceEx({
  now,
  scenarioKey,
  acceptanceStatus,
}: {
  now: Date;
  scenarioKey: string;
  acceptanceStatus: OfferAcceptanceStatus;
}) {
  if (acceptanceStatus === "PENDING_ADMIN_REVIEW") return null;
  if (acceptanceStatus === "SIGNING_IN_PROGRESS") return plusDaysIso(now, 5);
  if (acceptanceStatus === "CHANGES_REQUESTED") return plusDaysIso(now, 7);
  if (acceptanceStatus === "COMPLETED") return null;
  if (acceptanceStatus === "REJECTED" || acceptanceStatus === "DECLINED") return null;
  // PENDING_ISSUER default.
  // Use a deterministic sign to avoid “near now” edge cases.
  return seededNumberFromKey(scenarioKey, 10, 16) > 10 ? plusDaysIso(now, 14) : plusDaysIso(now, 12);
}

async function main() {
  const now = new Date();
  const targetIssuerOrgId = process.env.UI_TEST_TARGET_ISSUER_ORG_ID?.trim() || null;
  const targetIssuerOrgName =
    process.env.UI_TEST_TARGET_ISSUER_ORG_NAME?.trim() || null;

  // When targeting an existing issuer org (e.g. "Test1" in the UI), we skip creating a new org/user.
  // Applications are inserted under that org id so they show up immediately for the logged-in issuer.
  const targetOrg =
    targetIssuerOrgId
      ? await prisma.issuerOrganization.findUnique({ where: { id: targetIssuerOrgId } })
      : targetIssuerOrgName
        ? await prisma.issuerOrganization.findFirst({
            where: { name: { equals: targetIssuerOrgName, mode: "insensitive" } },
          })
        : null;

  const org = targetOrg ?? (await ensureTestIssuerUserAndOrg()).org;

  // Use a stable active product if possible, otherwise fall back to the first active product.
  const preferredProductId = "cmojlzg0g0001h6rsp3mlcyba";
  const product =
    (await prisma.product.findUnique({ where: { id: preferredProductId } })) ??
    (await prisma.product.findFirst({ where: { status: "ACTIVE" } }));

  if (!product) {
    throw new Error("No ACTIVE product found. Seed a product or run an existing seed script first.");
  }

  const cleanup = await deleteExistingUiTestApps({ displayPrefix: APP_DISPLAY_PREFIX });
  console.log(
    `UI test cleanup: deleted ${cleanup.deletedAppCount} application(s), ${cleanup.deletedContractCount} contract(s).`
  );

  // One contract per application (invoice_only structure).
  const submittedAt = now;

  const maturityFuture = "2026-12-31";

  const acceptanceExpiresFuture = plusDaysIso(now, 14);
  const acceptanceExpiresNearPast = minusDaysIso(now, 2);

  const rejectedReason = "UI TEST - Issuance terminated (fake reason for UI testing).";
  const rejectionReasonNoDetails = null;

  const scenarios: Scenario[] = [
    {
      key: "draft_application",
      name: "UI TEST - Draft application",
      applicationStatus: "DRAFT",
      invoiceCount: 1,
      invoices: [
        {
          index: 0,
          invoiceNumber: "INV-2026-1001",
          valueRm: 25_000,
          financingRatioPercent: 80,
          maturityDateYmd: maturityFuture,
          detailsMode: "withDocument",
          status: "DRAFT",
          offerDetails: { kind: "none" },
        },
      ],
    },
    {
      key: "submitted_pending_admin_review",
      name: "UI TEST - Submitted (pending admin review)",
      applicationStatus: "SUBMITTED",
      invoiceCount: 1,
      invoices: [
        {
          index: 0,
          invoiceNumber: "INV-2026-1002",
          valueRm: 30_000,
          financingRatioPercent: 78,
          maturityDateYmd: maturityFuture,
          detailsMode: "withDocument",
          status: "OFFER_SENT",
          offerDetails: {
            kind: "offer",
            acceptanceStatus: "PENDING_ADMIN_REVIEW",
            acceptanceExpiresAtIso: acceptanceExpiresFuture,
            offeredAmount: 24_000,
            feeSchedule: { mode: "v1", platformFeeRatePercent: 1, facilityFeeCollectAmount: 0, additionalFees: [] },
            sentAtIso: plusDaysIso(now, -1),
          },
        },
      ],
    },
    {
      key: "amendment_requested_application",
      name: "UI TEST - Amendment Requested",
      applicationStatus: "AMENDMENT_REQUESTED",
      invoiceCount: 1,
      invoices: [
        {
          index: 0,
          invoiceNumber: "INV-2026-1003",
          valueRm: 35_000,
          financingRatioPercent: 76,
          maturityDateYmd: maturityFuture,
          detailsMode: "withDocument",
          status: "AMENDMENT_REQUESTED",
          offerDetails: { kind: "none" },
        },
      ],
    },
    {
      key: "approved_application",
      name: "UI TEST - Approved",
      applicationStatus: "COMPLETED",
      invoiceCount: 1,
      invoices: [
        {
          index: 0,
          invoiceNumber: "INV-2026-1004",
          valueRm: 40_000,
          financingRatioPercent: 82,
          maturityDateYmd: maturityFuture,
          detailsMode: "withDocument",
          status: "APPROVED",
          offerDetails: { kind: "none" },
        },
      ],
    },
    {
      key: "rejected_application",
      name: "UI TEST - Rejected",
      applicationStatus: "REJECTED",
      invoiceCount: 1,
      invoices: [
        {
          index: 0,
          invoiceNumber: "INV-2026-1005",
          valueRm: 45_000,
          financingRatioPercent: 74,
          maturityDateYmd: maturityFuture,
          detailsMode: "withDocument",
          status: "REJECTED",
          offerDetails: { kind: "rejectionReasonOnly", rejectionReason: rejectedReason },
        },
      ],
    },
    {
      key: "withdrawn_application",
      name: "UI TEST - Withdrawn",
      applicationStatus: "WITHDRAWN",
      invoiceCount: 1,
      invoices: [
        {
          index: 0,
          invoiceNumber: "INV-2026-1006",
          valueRm: 50_000,
          financingRatioPercent: 80,
          maturityDateYmd: maturityFuture,
          detailsMode: "withDocument",
          status: "WITHDRAWN",
          withdrawReason: "USER_CANCELLED",
          offerDetails: { kind: "none" },
        },
      ],
    },

    // Invoice-focused cases (separate apps so you can click around easily from the list)
    {
      key: "invoice_pending_review_state",
      name: "UI TEST - Invoice pending/review state",
      applicationStatus: "SUBMITTED",
      invoiceCount: 1,
      invoices: [
        {
          index: 0,
          invoiceNumber: "INV-2026-2001",
          valueRm: 26_000,
          financingRatioPercent: 79,
          maturityDateYmd: maturityFuture,
          detailsMode: "withDocument",
          status: "OFFER_SENT",
          offerDetails: {
            kind: "offer",
            acceptanceStatus: "PENDING_ADMIN_REVIEW",
            acceptanceExpiresAtIso: acceptanceExpiresFuture,
            offeredAmount: 20_000,
            feeSchedule: { mode: "v1", platformFeeRatePercent: 1, facilityFeeCollectAmount: 0, additionalFees: [] },
            sentAtIso: plusDaysIso(now, -1),
          },
        },
      ],
    },
    {
      key: "invoice_offer_sent",
      name: "UI TEST - Offer Sent",
      applicationStatus: "SUBMITTED",
      invoiceCount: 1,
      invoices: [
        {
          index: 0,
          invoiceNumber: "INV-2026-2002",
          valueRm: 27_000,
          financingRatioPercent: 81,
          maturityDateYmd: maturityFuture,
          detailsMode: "withDocument",
          status: "OFFER_SENT",
          offerDetails: {
            kind: "offer",
            acceptanceStatus: "PENDING_ISSUER",
            acceptanceExpiresAtIso: acceptanceExpiresFuture,
            offeredAmount: 22_000,
            feeSchedule: { mode: "v1", platformFeeRatePercent: 1, facilityFeeCollectAmount: 0, additionalFees: [{ name: "Admin processing fee", kind: "amount", value: 500 }] },
            sentAtIso: plusDaysIso(now, -1),
          },
        },
      ],
    },
    {
      key: "invoice_offer_expired",
      name: "UI TEST - Offer Expired",
      applicationStatus: "SUBMITTED",
      invoiceCount: 1,
      invoices: [
        {
          index: 0,
          invoiceNumber: "INV-2026-2003",
          valueRm: 28_000,
          financingRatioPercent: 77,
          maturityDateYmd: maturityFuture,
          detailsMode: "withDocument",
          status: "OFFER_EXPIRED",
          offerDetails: {
            kind: "offer",
            acceptanceStatus: "PENDING_ISSUER",
            acceptanceExpiresAtIso: acceptanceExpiresNearPast,
            offeredAmount: 21_000,
            feeSchedule: { mode: "v1", platformFeeRatePercent: 1, facilityFeeCollectAmount: 0, additionalFees: [] },
            sentAtIso: plusDaysIso(now, -3),
          },
        },
      ],
    },
    {
      key: "invoice_amendment_requested",
      name: "UI TEST - Invoice AMENDMENT_REQUESTED",
      applicationStatus: "AMENDMENT_REQUESTED",
      invoiceCount: 1,
      invoices: [
        {
          index: 0,
          invoiceNumber: "INV-2026-2004",
          valueRm: 29_000,
          financingRatioPercent: 75,
          maturityDateYmd: maturityFuture,
          detailsMode: "withDocument",
          status: "AMENDMENT_REQUESTED",
          offerDetails: { kind: "none" },
        },
      ],
    },
    {
      key: "invoice_approved",
      name: "UI TEST - Invoice APPROVED",
      applicationStatus: "INVOICE_ACCEPTED",
      invoiceCount: 1,
      invoices: [
        {
          index: 0,
          invoiceNumber: "INV-2026-2005",
          valueRm: 30_000,
          financingRatioPercent: 80,
          maturityDateYmd: maturityFuture,
          detailsMode: "withDocument",
          status: "APPROVED",
          offerDetails: { kind: "none" },
        },
      ],
    },
    {
      key: "invoice_rejected_with_reason",
      name: "UI TEST - Invoice REJECTED (reason present)",
      applicationStatus: "SUBMITTED",
      invoiceCount: 1,
      invoices: [
        {
          index: 0,
          invoiceNumber: "INV-2026-2006",
          valueRm: 31_000,
          financingRatioPercent: 82,
          maturityDateYmd: maturityFuture,
          detailsMode: "withDocument",
          status: "REJECTED",
          offerDetails: { kind: "rejectionReasonOnly", rejectionReason: rejectedReason },
        },
      ],
    },
    {
      key: "invoice_rejected_without_reason",
      name: "UI TEST - Invoice REJECTED (no reason)",
      applicationStatus: "SUBMITTED",
      invoiceCount: 1,
      invoices: [
        {
          index: 0,
          invoiceNumber: "INV-2026-2007",
          valueRm: 32_000,
          financingRatioPercent: 83,
          maturityDateYmd: maturityFuture,
          detailsMode: "withDocument",
          status: "REJECTED",
          offerDetails: { kind: "rejectionReasonOnly", rejectionReason: rejectionReasonNoDetails },
        },
      ],
    },
    {
      key: "invoice_withdrawn",
      name: "UI TEST - Invoice WITHDRAWN",
      applicationStatus: "SUBMITTED",
      invoiceCount: 1,
      invoices: [
        {
          index: 0,
          invoiceNumber: "INV-2026-2008",
          valueRm: 33_000,
          financingRatioPercent: 84,
          maturityDateYmd: maturityFuture,
          detailsMode: "withDocument",
          status: "WITHDRAWN",
          withdrawReason: "USER_CANCELLED",
          offerDetails: { kind: "none" },
        },
      ],
    },
    {
      key: "signed_offer_available",
      name: "UI TEST - Signed offer available",
      applicationStatus: "SUBMITTED",
      invoiceCount: 1,
      invoices: [
        {
          index: 0,
          invoiceNumber: "INV-2026-3001",
          valueRm: 34_000,
          financingRatioPercent: 80,
          maturityDateYmd: maturityFuture,
          detailsMode: "withDocument",
          status: "SUBMITTED",
          offerDetails: { kind: "none" },
        },
      ],
      signedInvoiceEnvelopeForInvoiceIndex: 0,
    },
    {
      key: "offer_sent_cannot_review_yet",
      name: "UI TEST - Offer sent (issuer cannot review yet)",
      applicationStatus: "SUBMITTED",
      invoiceCount: 1,
      invoices: [
        {
          index: 0,
          invoiceNumber: "INV-2026-3002",
          valueRm: 35_000,
          financingRatioPercent: 80,
          maturityDateYmd: maturityFuture,
          detailsMode: "withDocument",
          status: "OFFER_SENT",
          offerDetails: {
            kind: "offer",
            acceptanceStatus: "PENDING_ADMIN_REVIEW",
            acceptanceExpiresAtIso: acceptanceExpiresFuture,
            offeredAmount: 28_000,
            feeSchedule: { mode: "v1", platformFeeRatePercent: 1, facilityFeeCollectAmount: 0, additionalFees: [] },
            sentAtIso: plusDaysIso(now, -1),
          },
        },
      ],
    },
    {
      key: "withdrawal_pending_representation",
      name: "UI TEST - Withdrawal ready (click to see pending)",
      applicationStatus: "SUBMITTED",
      invoiceCount: 1,
      invoices: [
        {
          index: 0,
          invoiceNumber: "INV-2026-3003",
          valueRm: 36_000,
          financingRatioPercent: 80,
          maturityDateYmd: maturityFuture,
          detailsMode: "withDocument",
          status: "SUBMITTED",
          offerDetails: { kind: "none" },
        },
      ],
    },
    {
      key: "invoice_with_document",
      name: "UI TEST - Invoice with document",
      applicationStatus: "SUBMITTED",
      invoiceCount: 1,
      invoices: [
        {
          index: 0,
          invoiceNumber: "INV-2026-4001",
          valueRm: 37_000,
          financingRatioPercent: 80,
          maturityDateYmd: maturityFuture,
          detailsMode: "withDocument",
          status: "DRAFT",
          offerDetails: { kind: "none" },
        },
      ],
    },
    {
      key: "invoice_without_document",
      name: "UI TEST - Invoice without document",
      applicationStatus: "SUBMITTED",
      invoiceCount: 1,
      invoices: [
        {
          index: 0,
          invoiceNumber: "INV-2026-4002",
          valueRm: 38_000,
          financingRatioPercent: 80,
          maturityDateYmd: maturityFuture,
          detailsMode: "withoutDocument",
          status: "DRAFT",
          offerDetails: { kind: "none" },
        },
      ],
    },
    {
      key: "invoice_with_fees",
      name: "UI TEST - Invoice with fees",
      applicationStatus: "SUBMITTED",
      invoiceCount: 1,
      invoices: [
        {
          index: 0,
          invoiceNumber: "INV-2026-5001",
          valueRm: 39_000,
          financingRatioPercent: 80,
          maturityDateYmd: maturityFuture,
          detailsMode: "withDocument",
          status: "APPROVED",
          offerDetails: {
            kind: "offer",
            acceptanceStatus: "COMPLETED",
            offeredAmount: 32_000,
            feeSchedule: {
              mode: "v1",
              platformFeeRatePercent: 1.25,
              facilityFeeCollectAmount: 0,
              additionalFees: [{ name: "Extra administrative fee", kind: "amount", value: 750 }],
            },
            sentAtIso: stableDateIso("2025-12-15"),
          },
        },
      ],
    },
    {
      key: "invoice_no_fees_waived",
      name: "UI TEST - Invoice no fees (fee lines suppressed)",
      applicationStatus: "SUBMITTED",
      invoiceCount: 1,
      invoices: [
        {
          index: 0,
          invoiceNumber: "INV-2026-5002",
          valueRm: 40_000,
          financingRatioPercent: 80,
          maturityDateYmd: maturityFuture,
          detailsMode: "withDocument",
          status: "APPROVED",
          offerDetails: {
            kind: "offer",
            acceptanceStatus: "COMPLETED",
            offeredAmount: 0,
            feeSchedule: {
              mode: "v1",
              platformFeeRatePercent: null,
              facilityFeeCollectAmount: 0,
              additionalFees: [],
            },
            sentAtIso: stableDateIso("2025-12-15"),
          },
        },
      ],
    },

    // Exactly 1 invoice (explicitly requested)
    {
      key: "normal_single_invoice",
      name: "UI TEST - Normal Single Invoice (InvoiceSingleDetail)",
      applicationStatus: "SUBMITTED",
      invoiceCount: 1,
      invoices: [
        {
          index: 0,
          invoiceNumber: "INV-2026-6001",
          valueRm: 41_000,
          financingRatioPercent: 80,
          maturityDateYmd: maturityFuture,
          detailsMode: "withDocument",
          status: "SUBMITTED",
          offerDetails: { kind: "none" },
        },
      ],
    },

    // Legacy/grandfathered multi-invoice (explicitly requested)
    {
      key: "legacy_multi_invoice",
      name: "UI TEST - Legacy Multi Invoice (ScrollableInvoiceTable)",
      applicationStatus: "SUBMITTED",
      invoiceCount: 2,
      invoices: [
        {
          index: 0,
          invoiceNumber: "INV-2026-7001",
          valueRm: 42_000,
          financingRatioPercent: 80,
          maturityDateYmd: maturityFuture,
          detailsMode: "withDocument",
          status: "DRAFT",
          offerDetails: { kind: "none" },
        },
        {
          index: 1,
          invoiceNumber: "INV-2026-7002",
          valueRm: 43_000,
          financingRatioPercent: 80,
          maturityDateYmd: maturityFuture,
          detailsMode: "withDocument",
          status: "APPROVED",
          offerDetails: {
            kind: "offer",
            acceptanceStatus: "COMPLETED",
            offeredAmount: 36_000,
            feeSchedule: { mode: "grandfather", platformFeeRatePercent: 1.0 },
            sentAtIso: stableDateIso("2025-12-15"),
          },
        },
      ],
    },
  ];

  // Sanity check: requested counts.
  for (const s of scenarios) {
    if (s.invoices.length !== s.invoiceCount) {
      throw new Error(`Scenario ${s.key}: invoiceCount=${s.invoiceCount} but invoices.length=${s.invoices.length}`);
    }
  }

  // Seed each scenario.
  const createdScenarioNames: string[] = [];
  for (const scenario of scenarios) {
    const appId = seedCuid("app", scenario.key);
    const contractId = seedCuid("con", scenario.key);
    const createdAt = now;
    const submittedAtValue = scenario.applicationStatus === "DRAFT" ? null : submittedAt;

    const contractCustomerDetails = buildCustomerDetails();
    await prisma.contract.create({
      data: {
        id: contractId,
        issuer_organization_id: org.id,
        status: "SUBMITTED",
        contract_details: Prisma.JsonNull,
        customer_details: contractCustomerDetails as Prisma.InputJsonValue,
        created_at: createdAt,
      },
    });

    const application = await prisma.application.create({
      data: {
        id: appId,
        issuer_organization_id: org.id,
        product_version: product.version,
        review_cycle: 1,
        status: scenario.applicationStatus,
        last_completed_step: 9,
        submitted_at: submittedAtValue,
        created_at: createdAt,
        financing_type: { product_id: product.id } as Prisma.InputJsonValue,
        financing_structure: {
          structure_type: "invoice_only",
          existing_contract_id: null,
        } as Prisma.InputJsonValue,
        contract_id: contractId,
        display_reference: scenario.name,
        company_details: buildCompanyDetails(org.id) as Prisma.InputJsonValue,
        business_details: buildBusinessDetails() as Prisma.InputJsonValue,
        financial_statements: buildFinancialStatements() as Prisma.InputJsonValue,
        supporting_documents: buildSupportingDocuments() as Prisma.InputJsonValue,
        declarations: buildDeclarations() as Prisma.InputJsonValue,
        review_and_submit: buildReviewAndSubmit() as Prisma.InputJsonValue,
      },
    });

    for (const inv of scenario.invoices) {
      const invoiceId = seedCuid("inv", scenario.key, inv.index + 1);
      const details = invoiceDetailsForScenario(inv);

      let offerDetailsJson: Prisma.InputJsonValue | null = null;
      if (inv.offerDetails.kind === "offer") {
        const acceptanceExIso =
          inv.offerDetails.acceptanceExpiresAtIso === undefined
            ? computeOfferAcceptanceEx({ now, scenarioKey: scenario.key, acceptanceStatus: inv.offerDetails.acceptanceStatus })
            : inv.offerDetails.acceptanceExpiresAtIso;

        const acceptance = buildOfferAcceptance({
          status: inv.offerDetails.acceptanceStatus,
          now,
          submittedByUserId: "SYS",
          acceptanceExpiresAtIso: acceptanceExIso,
          signingExpiresAtIso: inv.offerDetails.acceptanceStatus === "SIGNING_IN_PROGRESS" ? plusDaysIso(now, 5) : null,
        });

        offerDetailsJson = buildInvoiceOfferDetails({
          offeredAmount: inv.offerDetails.offeredAmount,
          acceptance,
          rejectionReason: inv.offerDetails.rejectionReason ?? null,
          feeSchedule: inv.offerDetails.feeSchedule,
          sentAtIso: inv.offerDetails.sentAtIso ?? null,
        });
      } else if (inv.offerDetails.kind === "rejectionReasonOnly") {
        // Offer details are optional for the REJECTED badge, but including rejection_reason
        // lets issuer UI show “reason / remarks” modal content.
        if (inv.offerDetails.rejectionReason && inv.offerDetails.rejectionReason.trim()) {
          offerDetailsJson = buildInvoiceOfferDetails({
            offeredAmount: 0,
            acceptance: buildOfferAcceptance({
              status: "COMPLETED",
              now,
              submittedByUserId: "SYS",
              acceptanceExpiresAtIso: null,
              signingExpiresAtIso: null,
            }),
            rejectionReason: inv.offerDetails.rejectionReason,
            feeSchedule: undefined,
            sentAtIso: null,
          });
        } else {
          offerDetailsJson = Prisma.JsonNull;
        }
      } else {
        offerDetailsJson = Prisma.JsonNull;
      }

      await prisma.invoice.create({
        data: {
          id: invoiceId,
          application_id: application.id,
          contract_id: null,
          display_reference: `INV-UI-${scenario.key.toUpperCase().replace(/[^A-Z0-9]/g, "")}-${inv.index + 1}`,
          status: inv.status,
          withdraw_reason: inv.withdrawReason ?? null,
          details: details as Prisma.InputJsonValue,
          offer_details: offerDetailsJson ?? Prisma.JsonNull,
          created_at: createdAt,
        },
      });

      if (scenario.signedInvoiceEnvelopeForInvoiceIndex === inv.index) {
        const invoiceIdForEnvelope = invoiceId;
        const envelopeId = seedCuid("env", scenario.key, inv.index + 1);
        const envelopeNow = now;

        await prisma.signingEnvelope.create({
          data: {
            id: envelopeId,
            application_id: application.id,
            contract_id: null,
            invoice_id: invoiceIdForEnvelope,
            product_version: product.version,
            title: "UI Test — Signed Offer",
            status: "COMPLETED",
            created_by_user_id: "SYS",
            sent_at: envelopeNow,
            completed_at: envelopeNow,
            provider: "signingcloud",
            send_phase: "IDLE",
            metadata: { seed: "seed-issuer-application-details-ui-test" } as Prisma.InputJsonValue,
          },
        });

        const docId = seedCuid("envdoc", scenario.key, inv.index + 1);
        await prisma.signingDocument.create({
          data: {
            id: docId,
            envelope_id: envelopeId,
            name: "Letter of Offer",
            description: "UI Test signed offer letter",
            source: "GENERATED_OFFER_LETTER",
            order: 0,
            required: true,
            unsigned_s3_key: "applications/seed/ui-test/letter-of-offer.pdf",
            signed_s3_key: "applications/seed/ui-test/signed-letter-of-offer.pdf",
            signed_file_sha256: "deadbeef",
            template_ref: "facility_agreement",
            status: "COMPLETED",
          },
        });

        // Recipients + assignments make the envelope realistic, but the UI only needs
        // “COMPLETED + signed doc” for invoice download menu.
        const recipientId = seedCuid("envrcp", scenario.key, inv.index + 1);
        await prisma.signingRecipient.create({
          data: {
            id: recipientId,
            envelope_id: envelopeId,
            role_key: "issuer_director",
            role_label: "Issuer director",
            name: "Ahmad Hassan",
            email: "ahmad.hassan@example.com",
            ic_number: "850315101234",
            routing_order: 0,
            kyc_required: true,
            execution_mode: "MANUAL",
            delivery_mode: "EMAIL",
            status: "SIGNED",
            sent_at: envelopeNow,
            completed_at: envelopeNow,
          },
        });

        await prisma.signingAssignment.create({
          data: {
            id: seedCuid("envasg", scenario.key, inv.index + 1),
            envelope_id: envelopeId,
            document_id: docId,
            recipient_id: recipientId,
            required: true,
            action: "SIGN",
            status: "SIGNED",
            signed_at: envelopeNow,
          },
        });
      }
    }

    createdScenarioNames.push(scenario.name);
  }

  console.log(`\n✅ Seeded ${createdScenarioNames.length} UI test application(s):`);
  for (const name of createdScenarioNames) console.log(`  - ${name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

