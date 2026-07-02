#!/usr/bin/env tsx
/**
 * Dev-only seed for Admin Note Detail late-payment / arrears / default workflows.
 *
 * Usage (repo root):
 *   pnpm --filter @cashsouk/api seed-late-payment
 *     → fresh note references each run (default), e.g.
 *       LATE_TEST_20260701_153012_AB12_TAWIDH
 *   pnpm --filter @cashsouk/api seed-late-payment -- --fixed
 *     → idempotent LATE_TEST_* references; resets children on re-run
 *   SEED_LATE_PAYMENT_FIXED=1 pnpm --filter @cashsouk/api seed-late-payment
 */
import { randomBytes } from "node:crypto";
import {
  NoteFundingStatus,
  NoteInvestmentStatus,
  NoteListingStatus,
  NotePaymentSource,
  NotePaymentStatus,
  NoteServicingStatus,
  NoteSettlementStatus,
  NoteSettlementType,
  NoteStatus,
  Prisma,
  PrismaClient,
  UserRole,
  WithdrawalStatus,
  WithdrawalType,
} from "@prisma/client";
import { calculateSettlementWaterfall } from "../src/modules/notes/calculators";

const prisma = new PrismaClient();

const TEST_REFERENCE_PREFIX = "LATE_TEST_";
const INVOICE_VALUE = 25_000;
const GRACE_DAYS = 7;
const ARREARS_THRESHOLD_DAYS = 14;
const TAWIDH_CAP_PERCENT = 1;
const GHARAMAH_CAP_PERCENT = 9;

/** Obvious amounts for manual UI verification (Late Payment + settlement waterfall). */
const SEED_TAWIDH_AMOUNT = 123.45;
const SEED_GHARAMAH_AMOUNT = 67.89;

type LateFeeMode = "none" | "tawidh-only" | "gharamah-only" | "both";

type ScenarioKey =
  | "NORMAL_SERVICING"
  | "GRACE_PERIOD"
  | "TAWIDH"
  | "GHARAMAH_ONLY"
  | "TAWIDH_GHARAMAH"
  | "ARREARS_LETTER"
  | "DEFAULT_LETTER"
  | "DEFAULTED"
  | "LATE_SETTLEMENT_READY"
  | "LATE_SETTLEMENT_POSTED";

type ScenarioConfig = {
  key: ScenarioKey;
  reference: string;
  label: string;
  daysUntilDue: number;
  noteStatus: NoteStatus;
  servicingStatus: NoteServicingStatus;
  arrearsStartedAt: Date | null;
  defaultReason: string | null;
  defaultMarkedAt: Date | null;
  repaidAt: Date | null;
  previewLateFees: LateFeeMode;
  settlementStatus: NoteSettlementStatus | null;
  arrearsLetter: boolean;
  defaultLetter: boolean;
};

function money(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(6));
}

function utcStartOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return utcStartOfDay(next);
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function createRunSuffix(now: Date): string {
  const date = `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}`;
  const time = `${pad2(now.getUTCHours())}${pad2(now.getUTCMinutes())}${pad2(now.getUTCSeconds())}`;
  const rand = randomBytes(2).toString("hex").toUpperCase();
  return `${date}_${time}_${rand}`;
}

function scenarioReference(runSuffix: string | null, key: ScenarioKey): string {
  return runSuffix
    ? `${TEST_REFERENCE_PREFIX}${runSuffix}_${key}`
    : `${TEST_REFERENCE_PREFIX}${key}`;
}

function resolveFixedSeedMode(): boolean {
  if (process.env.SEED_LATE_PAYMENT_FIXED === "1") return true;
  return process.argv.includes("--fixed");
}

function resolveSeedLateFees(mode: LateFeeMode): { tawidhAmount: number; gharamahAmount: number } {
  switch (mode) {
    case "none":
      return { tawidhAmount: 0, gharamahAmount: 0 };
    case "tawidh-only":
      return { tawidhAmount: SEED_TAWIDH_AMOUNT, gharamahAmount: 0 };
    case "gharamah-only":
      return { tawidhAmount: 0, gharamahAmount: SEED_GHARAMAH_AMOUNT };
    case "both":
      return { tawidhAmount: SEED_TAWIDH_AMOUNT, gharamahAmount: SEED_GHARAMAH_AMOUNT };
  }
}

function resolveServicingFromOverdue(daysPastDue: number): {
  noteStatus: NoteStatus;
  servicingStatus: NoteServicingStatus;
  arrearsStartedAt: Date | null;
} {
  const daysAfterGrace = Math.max(0, daysPastDue - GRACE_DAYS);
  if (daysAfterGrace >= ARREARS_THRESHOLD_DAYS) {
    return {
      noteStatus: NoteStatus.ARREARS,
      servicingStatus: NoteServicingStatus.ARREARS,
      arrearsStartedAt: addDays(new Date(), -(daysAfterGrace - ARREARS_THRESHOLD_DAYS + 1)),
    };
  }
  if (daysPastDue > GRACE_DAYS) {
    return {
      noteStatus: NoteStatus.ACTIVE,
      servicingStatus: NoteServicingStatus.LATE,
      arrearsStartedAt: null,
    };
  }
  return {
    noteStatus: NoteStatus.ACTIVE,
    servicingStatus: NoteServicingStatus.CURRENT,
    arrearsStartedAt: null,
  };
}

function buildScenarios(now: Date, runSuffix: string | null): ScenarioConfig[] {
  const ref = (key: ScenarioKey) => scenarioReference(runSuffix, key);
  const overdue20 = resolveServicingFromOverdue(20);
  const overdue45 = resolveServicingFromOverdue(45);
  const overdue25 = resolveServicingFromOverdue(25);

  return [
    {
      key: "NORMAL_SERVICING",
      reference: ref("NORMAL_SERVICING"),
      label: "Normal servicing (not late)",
      daysUntilDue: 60,
      noteStatus: NoteStatus.ACTIVE,
      servicingStatus: NoteServicingStatus.CURRENT,
      arrearsStartedAt: null,
      defaultReason: null,
      defaultMarkedAt: null,
      repaidAt: null,
      previewLateFees: "none",
      settlementStatus: null,
      arrearsLetter: false,
      defaultLetter: false,
    },
    {
      key: "GRACE_PERIOD",
      reference: ref("GRACE_PERIOD"),
      label: "Overdue inside grace period",
      daysUntilDue: -3,
      noteStatus: NoteStatus.ACTIVE,
      servicingStatus: NoteServicingStatus.CURRENT,
      arrearsStartedAt: null,
      defaultReason: null,
      defaultMarkedAt: null,
      repaidAt: null,
      previewLateFees: "none",
      settlementStatus: null,
      arrearsLetter: false,
      defaultLetter: false,
    },
    {
      key: "TAWIDH",
      reference: ref("TAWIDH"),
      label: "Overdue — Ta'widh only (RM 123.45)",
      daysUntilDue: -20,
      noteStatus: overdue20.noteStatus,
      servicingStatus: overdue20.servicingStatus,
      arrearsStartedAt: overdue20.arrearsStartedAt,
      defaultReason: null,
      defaultMarkedAt: null,
      repaidAt: null,
      previewLateFees: "tawidh-only",
      settlementStatus: null,
      arrearsLetter: false,
      defaultLetter: false,
    },
    {
      key: "GHARAMAH_ONLY",
      reference: ref("GHARAMAH_ONLY"),
      label: "Overdue — Gharamah only (RM 67.89)",
      daysUntilDue: -45,
      noteStatus: overdue45.noteStatus,
      servicingStatus: overdue45.servicingStatus,
      arrearsStartedAt: overdue45.arrearsStartedAt,
      defaultReason: null,
      defaultMarkedAt: null,
      repaidAt: null,
      previewLateFees: "gharamah-only",
      settlementStatus: null,
      arrearsLetter: false,
      defaultLetter: false,
    },
    {
      key: "TAWIDH_GHARAMAH",
      reference: ref("TAWIDH_GHARAMAH"),
      label: "Overdue — Ta'widh + Gharamah (RM 123.45 + RM 67.89)",
      daysUntilDue: -45,
      noteStatus: overdue45.noteStatus,
      servicingStatus: overdue45.servicingStatus,
      arrearsStartedAt: overdue45.arrearsStartedAt,
      defaultReason: null,
      defaultMarkedAt: null,
      repaidAt: null,
      previewLateFees: "both",
      settlementStatus: null,
      arrearsLetter: false,
      defaultLetter: false,
    },
    {
      key: "ARREARS_LETTER",
      reference: ref("ARREARS_LETTER"),
      label: "Arrears letter generated",
      daysUntilDue: -25,
      noteStatus: overdue25.noteStatus,
      servicingStatus: overdue25.servicingStatus,
      arrearsStartedAt: overdue25.arrearsStartedAt,
      defaultReason: null,
      defaultMarkedAt: null,
      repaidAt: null,
      previewLateFees: "both",
      settlementStatus: null,
      arrearsLetter: true,
      defaultLetter: false,
    },
    {
      key: "DEFAULT_LETTER",
      reference: ref("DEFAULT_LETTER"),
      label: "Default letter generated",
      daysUntilDue: -30,
      noteStatus: NoteStatus.ARREARS,
      servicingStatus: NoteServicingStatus.ARREARS,
      arrearsStartedAt: addDays(now, -20),
      defaultReason: null,
      defaultMarkedAt: null,
      repaidAt: null,
      previewLateFees: "both",
      settlementStatus: null,
      arrearsLetter: false,
      defaultLetter: true,
    },
    {
      key: "DEFAULTED",
      reference: ref("DEFAULTED"),
      label: "Marked default",
      daysUntilDue: -35,
      noteStatus: NoteStatus.DEFAULTED,
      servicingStatus: NoteServicingStatus.DEFAULTED,
      arrearsStartedAt: addDays(now, -25),
      defaultReason: "Issuer failed to cure arrears after notice (dev seed).",
      defaultMarkedAt: addDays(now, -2),
      repaidAt: null,
      previewLateFees: "both",
      settlementStatus: null,
      arrearsLetter: false,
      defaultLetter: true,
    },
    {
      key: "LATE_SETTLEMENT_READY",
      reference: ref("LATE_SETTLEMENT_READY"),
      label: "Late settlement preview ready (both fees)",
      daysUntilDue: -40,
      noteStatus: NoteStatus.ARREARS,
      servicingStatus: NoteServicingStatus.ARREARS,
      arrearsStartedAt: addDays(now, -22),
      defaultReason: null,
      defaultMarkedAt: null,
      repaidAt: null,
      previewLateFees: "both",
      settlementStatus: NoteSettlementStatus.PREVIEW,
      arrearsLetter: false,
      defaultLetter: false,
    },
    {
      key: "LATE_SETTLEMENT_POSTED",
      reference: ref("LATE_SETTLEMENT_POSTED"),
      label: "Posted settlement with both late fees",
      daysUntilDue: -50,
      noteStatus: NoteStatus.REPAID,
      servicingStatus: NoteServicingStatus.SETTLED,
      arrearsStartedAt: addDays(now, -30),
      defaultReason: null,
      defaultMarkedAt: null,
      repaidAt: addDays(now, -1),
      previewLateFees: "both",
      settlementStatus: NoteSettlementStatus.POSTED,
      arrearsLetter: false,
      defaultLetter: false,
    },
  ];
}

function buildWaterfall(input: {
  grossReceiptAmount: number;
  fundedPrincipal: number;
  profitRatePercent: number;
  activatedAt: Date;
  maturityDate: Date;
  serviceFeeRatePercent: number;
  tawidhAmount: number;
  gharamahAmount: number;
}) {
  return calculateSettlementWaterfall({
    grossReceiptAmount: input.grossReceiptAmount,
    fundedPrincipal: input.fundedPrincipal,
    profitRatePercent: input.profitRatePercent,
    profitStartDate: input.activatedAt,
    profitMaturityDate: input.maturityDate,
    serviceFeeRatePercent: input.serviceFeeRatePercent,
    tawidhAmount: input.tawidhAmount,
    gharamahAmount: input.gharamahAmount,
    tawidhInvestorSharePercent: 0,
  });
}

function shouldCreatePreviewSettlement(previewLateFees: LateFeeMode): boolean {
  return (
    previewLateFees === "tawidh-only" ||
    previewLateFees === "gharamah-only" ||
    previewLateFees === "both"
  );
}

async function resetScenarioChildren(tx: Prisma.TransactionClient, noteId: string) {
  await tx.notePayment.deleteMany({ where: { note_id: noteId } });
  await tx.noteSettlement.deleteMany({ where: { note_id: noteId } });
  await tx.noteEvent.deleteMany({ where: { note_id: noteId } });
  await tx.withdrawalInstruction.deleteMany({ where: { note_id: noteId } });
}

async function createSettlementRecord(
  tx: Prisma.TransactionClient,
  input: {
    noteId: string;
    paymentId: string | null;
    status: NoteSettlementStatus;
    waterfall: ReturnType<typeof buildWaterfall>;
    tawidhAmount: number;
    gharamahAmount: number;
    adminUserId: string;
    approvedAt: Date | null;
    postedAt: Date | null;
    includedPaymentIds: string[];
  }
) {
  const snapshot = {
    ...input.waterfall,
    profitStartDate: input.waterfall.profitStartDate.toISOString(),
    profitMaturityDate: input.waterfall.profitMaturityDate.toISOString(),
    includedPaymentIds: input.includedPaymentIds,
    allocations: [],
  };

  await tx.noteSettlement.create({
    data: {
      note_id: input.noteId,
      payment_id: input.paymentId,
      status: input.status,
      settlement_type:
        input.tawidhAmount > 0 || input.gharamahAmount > 0
          ? NoteSettlementType.LATE
          : NoteSettlementType.STANDARD,
      gross_receipt_amount: money(input.waterfall.grossReceiptAmount),
      investor_principal: money(input.waterfall.investorPrincipal),
      profit_start_date: input.waterfall.profitStartDate,
      profit_maturity_date: input.waterfall.profitMaturityDate,
      profit_days: input.waterfall.profitDays,
      annual_profit_rate_percent: money(input.waterfall.annualProfitRatePercent),
      investor_profit_gross: money(input.waterfall.investorProfitGross),
      service_fee_amount: money(input.waterfall.serviceFeeAmount),
      investor_profit_net: money(input.waterfall.investorProfitNet),
      tawidh_amount: money(input.waterfall.tawidhAmount),
      tawidh_investor_share_percent: money(input.waterfall.tawidhInvestorSharePercent),
      tawidh_investor_amount: money(input.waterfall.tawidhInvestorAmount),
      tawidh_account_amount: money(input.waterfall.tawidhAccountAmount),
      gharamah_amount: money(input.waterfall.gharamahAmount),
      issuer_residual_amount: money(input.waterfall.issuerResidualAmount),
      unapplied_amount: money(input.waterfall.unappliedAmount),
      preview_snapshot: snapshot,
      approved_by_user_id: input.approvedAt || input.postedAt ? input.adminUserId : null,
      approved_at: input.approvedAt,
      posted_at: input.postedAt,
    },
  });
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run late-payment seed in production.");
  }

  const fixedMode = resolveFixedSeedMode();
  const adminUser = await prisma.user.findFirst({
    where: { roles: { has: UserRole.ADMIN } },
    select: { user_id: true },
  });
  if (!adminUser) {
    throw new Error(
      "No ADMIN user found. Create one first (pnpm --filter @cashsouk/api create-admin)."
    );
  }

  const template = await prisma.note.findFirst({
    where: {
      funding_status: NoteFundingStatus.FUNDED,
      investments: { some: { status: NoteInvestmentStatus.CONFIRMED } },
      payment_schedules: { some: {} },
    },
    include: {
      investments: { where: { status: NoteInvestmentStatus.CONFIRMED } },
      listing: true,
      payment_schedules: { orderBy: { sequence: "asc" } },
    },
    orderBy: { updated_at: "desc" },
  });
  if (!template) {
    throw new Error(
      "No funded template note with confirmed investments found. Seed or fund a note first."
    );
  }

  const scheduleTemplate = template.payment_schedules[0];
  if (!scheduleTemplate) {
    throw new Error("Template note has no payment schedule.");
  }

  const fundedAmount = template.funded_amount.toNumber();
  const profitRatePercent = template.profit_rate_percent?.toNumber() ?? 10;
  const serviceFeeRatePercent = template.service_fee_rate_percent.toNumber();
  const targetAmount = template.target_amount.toNumber();
  const now = utcStartOfDay(new Date());
  const runSuffix = fixedMode ? null : createRunSuffix(now);
  const scenarios = buildScenarios(now, runSuffix);

  console.log(
    fixedMode
      ? "Late payment seed (fixed references — idempotent reset on re-run)\n"
      : `Late payment seed (fresh run suffix: ${runSuffix})\n`
  );

  const created: Array<{
    reference: string;
    id: string;
    tawidhAmount: number;
    gharamahAmount: number;
  }> = [];

  for (const scenario of scenarios) {
    const dueDate = addDays(now, scenario.daysUntilDue);
    const activatedAt = addDays(dueDate, -120);
    const fundingClosedAt = activatedAt;
    const maturityDate = dueDate;

    const invoiceSnapshot = template.invoice_snapshot as Prisma.JsonObject | null;
    const invoiceDetails =
      invoiceSnapshot?.details && typeof invoiceSnapshot.details === "object"
        ? { ...(invoiceSnapshot.details as Prisma.JsonObject) }
        : {};
    invoiceDetails.value = INVOICE_VALUE;
    invoiceDetails.due_date = formatDateOnly(dueDate);
    invoiceDetails.maturity_date = formatDateOnly(maturityDate);

    const { tawidhAmount, gharamahAmount } = resolveSeedLateFees(scenario.previewLateFees);

    const noteId = await prisma.$transaction(async (tx) => {
      const existing = await tx.note.findUnique({
        where: { note_reference: scenario.reference },
        select: { id: true },
      });

      const noteFields = {
        source_application_id: template.source_application_id,
        source_contract_id: template.source_contract_id,
        source_invoice_id: null as string | null,
        issuer_organization_id: template.issuer_organization_id,
        status: scenario.noteStatus,
        listing_status: NoteListingStatus.CLOSED,
        funding_status: NoteFundingStatus.FUNDED,
        servicing_status: scenario.servicingStatus,
        title: `Overdue Test — ${scenario.label}`,
        note_reference: scenario.reference,
        product_snapshot: template.product_snapshot ?? Prisma.JsonNull,
        issuer_snapshot: template.issuer_snapshot,
        paymaster_snapshot: template.paymaster_snapshot ?? Prisma.JsonNull,
        contract_snapshot: template.contract_snapshot ?? Prisma.JsonNull,
        invoice_snapshot: invoiceSnapshot
          ? { ...invoiceSnapshot, details: invoiceDetails }
          : Prisma.JsonNull,
        requested_amount: money(INVOICE_VALUE),
        target_amount: money(targetAmount),
        funded_amount: money(fundedAmount),
        minimum_funding_percent: template.minimum_funding_percent,
        profit_rate_percent: money(profitRatePercent),
        platform_fee_rate_percent: template.platform_fee_rate_percent,
        service_fee_rate_percent: template.service_fee_rate_percent,
        maturity_date: maturityDate,
        grace_period_days: GRACE_DAYS,
        arrears_threshold_days: ARREARS_THRESHOLD_DAYS,
        tawidh_rate_cap_percent: money(TAWIDH_CAP_PERCENT),
        gharamah_rate_cap_percent: money(GHARAMAH_CAP_PERCENT),
        published_at: template.published_at ?? fundingClosedAt,
        funding_closed_at: fundingClosedAt,
        activated_at: activatedAt,
        arrears_started_at: scenario.arrearsStartedAt,
        default_marked_at: scenario.defaultMarkedAt,
        default_marked_by_admin_user_id: scenario.defaultMarkedAt ? adminUser.user_id : null,
        default_reason: scenario.defaultReason,
        repaid_at: scenario.repaidAt,
      };

      let noteId: string;
      if (existing) {
        await tx.note.update({ where: { id: existing.id }, data: noteFields });
        noteId = existing.id;
        await resetScenarioChildren(tx, noteId);
        await tx.notePaymentSchedule.updateMany({
          where: { note_id: noteId },
          data: {
            due_date: dueDate,
            expected_principal: scheduleTemplate.expected_principal,
            expected_profit: scheduleTemplate.expected_profit,
            expected_total: scheduleTemplate.expected_total,
          },
        });
      } else {
        const createdNote = await tx.note.create({ data: noteFields });
        noteId = createdNote.id;
        await tx.noteListing.create({
          data: {
            note_id: noteId,
            status: NoteListingStatus.CLOSED,
            opens_at: template.listing?.opens_at ?? fundingClosedAt,
            closes_at: template.listing?.closes_at ?? dueDate,
            published_at: template.listing?.published_at ?? fundingClosedAt,
            visibility: template.listing?.visibility ?? "INVESTOR_MARKETPLACE",
          },
        });
        await tx.notePaymentSchedule.create({
          data: {
            note_id: noteId,
            status: scheduleTemplate.status,
            sequence: scheduleTemplate.sequence,
            due_date: dueDate,
            expected_principal: scheduleTemplate.expected_principal,
            expected_profit: scheduleTemplate.expected_profit,
            expected_total: scheduleTemplate.expected_total,
          },
        });
        for (const investment of template.investments) {
          await tx.noteInvestment.create({
            data: {
              note_id: noteId,
              investor_organization_id: investment.investor_organization_id,
              investor_user_id: investment.investor_user_id,
              status: investment.status,
              amount: investment.amount,
              allocation_percent: investment.allocation_percent,
              committed_at: investment.committed_at,
              confirmed_at: activatedAt,
            },
          });
        }
      }

      await tx.withdrawalInstruction.create({
        data: {
          note_id: noteId,
          issuer_organization_id: template.issuer_organization_id,
          requested_by_user_id: adminUser.user_id,
          submitted_by_user_id: adminUser.user_id,
          status: WithdrawalStatus.COMPLETED,
          withdrawal_type: WithdrawalType.ISSUER_DISBURSEMENT,
          amount: money(fundedAmount),
          beneficiary_snapshot: {
            bank_name: "Late Test Bank",
            account_number: "1234567890",
            account_holder: "Overdue Test Issuer",
          },
          completed_at: activatedAt,
          metadata: { seed: "seed-late-payment" },
        },
      });

      let paymentId: string | null = null;
      if (scenario.settlementStatus != null) {
        const payment = await tx.notePayment.create({
          data: {
            note_id: noteId,
            source: NotePaymentSource.PAYMASTER,
            status:
              scenario.settlementStatus === NoteSettlementStatus.POSTED
                ? NotePaymentStatus.SETTLED
                : NotePaymentStatus.RECEIVED,
            receipt_amount: money(INVOICE_VALUE),
            receipt_date: now,
            reference: `${scenario.reference}_RECEIPT`,
            received_into_account_code: "REPAYMENT_POOL",
            recorded_by_user_id: adminUser.user_id,
          },
        });
        paymentId = payment.id;
      }

      const waterfallInput = {
        grossReceiptAmount: INVOICE_VALUE,
        fundedPrincipal: fundedAmount,
        profitRatePercent,
        activatedAt,
        maturityDate,
        serviceFeeRatePercent,
        tawidhAmount,
        gharamahAmount,
      };
      const waterfall = buildWaterfall(waterfallInput);

      if (scenario.settlementStatus != null) {
        const approvedAt =
          scenario.settlementStatus === NoteSettlementStatus.APPROVED ||
          scenario.settlementStatus === NoteSettlementStatus.POSTED
            ? addDays(now, -2)
            : null;
        const postedAt =
          scenario.settlementStatus === NoteSettlementStatus.POSTED ? addDays(now, -1) : null;

        await createSettlementRecord(tx, {
          noteId,
          paymentId,
          status: scenario.settlementStatus,
          waterfall,
          tawidhAmount,
          gharamahAmount,
          adminUserId: adminUser.user_id,
          approvedAt,
          postedAt,
          includedPaymentIds: paymentId ? [paymentId] : [],
        });
      } else if (shouldCreatePreviewSettlement(scenario.previewLateFees)) {
        await createSettlementRecord(tx, {
          noteId,
          paymentId: null,
          status: NoteSettlementStatus.PREVIEW,
          waterfall,
          tawidhAmount,
          gharamahAmount,
          adminUserId: adminUser.user_id,
          approvedAt: null,
          postedAt: null,
          includedPaymentIds: [],
        });
      }

      if (scenario.arrearsLetter) {
        await tx.noteEvent.create({
          data: {
            note_id: noteId,
            event_type: "ARREARS_LETTER_GENERATED",
            actor_user_id: adminUser.user_id,
            actor_role: "ADMIN",
            portal: "ADMIN",
            metadata: {
              s3Key: `note-letters/${noteId}/arrears-dev-seed.pdf`,
              seed: scenario.reference,
            },
          },
        });
      }

      if (scenario.defaultLetter) {
        await tx.noteEvent.create({
          data: {
            note_id: noteId,
            event_type: "DEFAULT_LETTER_GENERATED",
            actor_user_id: adminUser.user_id,
            actor_role: "ADMIN",
            portal: "ADMIN",
            metadata: {
              s3Key: `note-letters/${noteId}/default-dev-seed.pdf`,
              seed: scenario.reference,
            },
          },
        });
      }

      if (scenario.key === "DEFAULTED") {
        await tx.noteEvent.create({
          data: {
            note_id: noteId,
            event_type: "NOTE_DEFAULT_MARKED",
            actor_user_id: adminUser.user_id,
            actor_role: "ADMIN",
            portal: "ADMIN",
            metadata: {
              reason: scenario.defaultReason,
              seed: scenario.reference,
            },
          },
        });
      }

      if (scenario.settlementStatus === NoteSettlementStatus.POSTED) {
        await tx.noteEvent.create({
          data: {
            note_id: noteId,
            event_type: "SETTLEMENT_POSTED",
            actor_user_id: adminUser.user_id,
            actor_role: "ADMIN",
            portal: "ADMIN",
            metadata: { seed: scenario.reference },
          },
        });
      }

      return noteId;
    });

    created.push({ reference: scenario.reference, id: noteId, tawidhAmount, gharamahAmount });
    console.log(
      `  ${scenario.reference} → ${noteId} (Ta'widh ${tawidhAmount.toFixed(2)}, Gharamah ${gharamahAmount.toFixed(2)})`
    );
  }

  console.log("\nLate payment seed complete.\n");
  console.log("Open Admin → Notes and search:");
  for (const row of created) {
    console.log(`- ${row.reference} (/notes/${row.id})`);
  }
  if (!fixedMode) {
    console.log("\nRe-run without --fixed to create another fresh batch.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
