#!/usr/bin/env tsx
/**
 * Dev-only seed for Admin Note Detail late-payment / arrears / default workflows.
 *
 * Usage (repo root):
 *   pnpm --filter @cashsouk/api seed-late-payment
 *
 * Idempotent: only touches notes whose note_reference starts with LATE_TEST_.
 */
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
import {
  calculateLateCharge,
  calculateSettlementWaterfall,
} from "../src/modules/notes/calculators";

const prisma = new PrismaClient();

const TEST_REFERENCE_PREFIX = "LATE_TEST_";
const INVOICE_VALUE = 25_000;
const GRACE_DAYS = 7;
const ARREARS_THRESHOLD_DAYS = 14;
const TAWIDH_CAP_PERCENT = 1;
const GHARAMAH_CAP_PERCENT = 9;

type ScenarioKey =
  | "NORMAL_SERVICING"
  | "GRACE_PERIOD"
  | "TAWIDH"
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
  previewLateFees: "none" | "tawidh-only" | "both";
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

function buildScenarios(now: Date): ScenarioConfig[] {
  const overdue20 = resolveServicingFromOverdue(20);
  const overdue45 = resolveServicingFromOverdue(45);
  const overdue25 = resolveServicingFromOverdue(25);

  return [
    {
      key: "NORMAL_SERVICING",
      reference: `${TEST_REFERENCE_PREFIX}NORMAL_SERVICING`,
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
      reference: `${TEST_REFERENCE_PREFIX}GRACE_PERIOD`,
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
      reference: `${TEST_REFERENCE_PREFIX}TAWIDH`,
      label: "Overdue with Ta'widh path",
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
      key: "TAWIDH_GHARAMAH",
      reference: `${TEST_REFERENCE_PREFIX}TAWIDH_GHARAMAH`,
      label: "Overdue with Ta'widh and Gharamah",
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
      reference: `${TEST_REFERENCE_PREFIX}ARREARS_LETTER`,
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
      reference: `${TEST_REFERENCE_PREFIX}DEFAULT_LETTER`,
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
      reference: `${TEST_REFERENCE_PREFIX}DEFAULTED`,
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
      reference: `${TEST_REFERENCE_PREFIX}LATE_SETTLEMENT_READY`,
      label: "Late fees ready for settlement preview",
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
      reference: `${TEST_REFERENCE_PREFIX}LATE_SETTLEMENT_POSTED`,
      label: "Posted settlement with late fees",
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

function suggestLateFees(dueDate: Date, receiptDate: Date) {
  return calculateLateCharge({
    dueDate,
    receiptDate,
    gracePeriodDays: GRACE_DAYS,
    receiptAmount: INVOICE_VALUE,
    tawidhRateCapPercent: TAWIDH_CAP_PERCENT,
    gharamahRateCapPercent: GHARAMAH_CAP_PERCENT,
  });
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

async function resetScenarioChildren(tx: Prisma.TransactionClient, noteId: string) {
  await tx.notePayment.deleteMany({ where: { note_id: noteId } });
  await tx.noteSettlement.deleteMany({ where: { note_id: noteId } });
  await tx.noteEvent.deleteMany({ where: { note_id: noteId } });
  await tx.withdrawalInstruction.deleteMany({ where: { note_id: noteId } });
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run late-payment seed in production.");
  }

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
  const scenarios = buildScenarios(now);
  const created: Array<{ reference: string; id: string }> = [];

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

      const lateFees = suggestLateFees(dueDate, now);
      const tawidhAmount =
        scenario.previewLateFees === "none"
          ? 0
          : scenario.previewLateFees === "tawidh-only"
            ? lateFees.tawidhAmount
            : lateFees.tawidhAmount;
      const gharamahAmount =
        scenario.previewLateFees === "both" ? lateFees.gharamahAmount : 0;

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

      if (scenario.settlementStatus != null) {
        const waterfall = buildWaterfall({
          grossReceiptAmount: INVOICE_VALUE,
          fundedPrincipal: fundedAmount,
          profitRatePercent,
          activatedAt,
          maturityDate,
          serviceFeeRatePercent,
          tawidhAmount,
          gharamahAmount,
        });
        const snapshot = {
          ...waterfall,
          profitStartDate: waterfall.profitStartDate.toISOString(),
          profitMaturityDate: waterfall.profitMaturityDate.toISOString(),
          includedPaymentIds: paymentId ? [paymentId] : [],
          allocations: [],
        };
        const approvedAt =
          scenario.settlementStatus === NoteSettlementStatus.APPROVED ||
          scenario.settlementStatus === NoteSettlementStatus.POSTED
            ? addDays(now, -2)
            : null;
        const postedAt =
          scenario.settlementStatus === NoteSettlementStatus.POSTED ? addDays(now, -1) : null;

        await tx.noteSettlement.create({
          data: {
            note_id: noteId,
            payment_id: paymentId,
            status: scenario.settlementStatus,
            settlement_type:
              tawidhAmount > 0 || gharamahAmount > 0
                ? NoteSettlementType.LATE
                : NoteSettlementType.STANDARD,
            gross_receipt_amount: money(waterfall.grossReceiptAmount),
            investor_principal: money(waterfall.investorPrincipal),
            profit_start_date: waterfall.profitStartDate,
            profit_maturity_date: waterfall.profitMaturityDate,
            profit_days: waterfall.profitDays,
            annual_profit_rate_percent: money(waterfall.annualProfitRatePercent),
            investor_profit_gross: money(waterfall.investorProfitGross),
            service_fee_amount: money(waterfall.serviceFeeAmount),
            investor_profit_net: money(waterfall.investorProfitNet),
            tawidh_amount: money(waterfall.tawidhAmount),
            tawidh_investor_share_percent: money(waterfall.tawidhInvestorSharePercent),
            tawidh_investor_amount: money(waterfall.tawidhInvestorAmount),
            tawidh_account_amount: money(waterfall.tawidhAccountAmount),
            gharamah_amount: money(waterfall.gharamahAmount),
            issuer_residual_amount: money(waterfall.issuerResidualAmount),
            unapplied_amount: money(waterfall.unappliedAmount),
            preview_snapshot: snapshot,
            approved_by_user_id:
              approvedAt || postedAt ? adminUser.user_id : null,
            approved_at: approvedAt,
            posted_at: postedAt,
          },
        });
      } else if (
        scenario.previewLateFees === "tawidh-only" ||
        scenario.previewLateFees === "both"
      ) {
        const waterfall = buildWaterfall({
          grossReceiptAmount: INVOICE_VALUE,
          fundedPrincipal: fundedAmount,
          profitRatePercent,
          activatedAt,
          maturityDate,
          serviceFeeRatePercent,
          tawidhAmount,
          gharamahAmount,
        });
        const snapshot = {
          ...waterfall,
          profitStartDate: waterfall.profitStartDate.toISOString(),
          profitMaturityDate: waterfall.profitMaturityDate.toISOString(),
          includedPaymentIds: [],
          allocations: [],
        };
        await tx.noteSettlement.create({
          data: {
            note_id: noteId,
            status: NoteSettlementStatus.PREVIEW,
            settlement_type: NoteSettlementType.LATE,
            gross_receipt_amount: money(waterfall.grossReceiptAmount),
            investor_principal: money(waterfall.investorPrincipal),
            profit_start_date: waterfall.profitStartDate,
            profit_maturity_date: waterfall.profitMaturityDate,
            profit_days: waterfall.profitDays,
            annual_profit_rate_percent: money(waterfall.annualProfitRatePercent),
            investor_profit_gross: money(waterfall.investorProfitGross),
            service_fee_amount: money(waterfall.serviceFeeAmount),
            investor_profit_net: money(waterfall.investorProfitNet),
            tawidh_amount: money(waterfall.tawidhAmount),
            tawidh_investor_share_percent: money(waterfall.tawidhInvestorSharePercent),
            tawidh_investor_amount: money(waterfall.tawidhInvestorAmount),
            tawidh_account_amount: money(waterfall.tawidhAccountAmount),
            gharamah_amount: money(waterfall.gharamahAmount),
            issuer_residual_amount: money(waterfall.issuerResidualAmount),
            unapplied_amount: money(waterfall.unappliedAmount),
            preview_snapshot: snapshot,
          },
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

    created.push({ reference: scenario.reference, id: noteId });
    console.log(`  ${scenario.reference} → ${noteId}`);
  }

  console.log("\nLate payment seed complete.\n");
  console.log("Open Admin → Notes and search:");
  for (const row of created) {
    console.log(`- ${row.reference} (/notes/${row.id})`);
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
