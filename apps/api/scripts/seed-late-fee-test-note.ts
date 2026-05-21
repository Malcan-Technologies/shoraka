import {
  NoteFundingStatus,
  NoteListingStatus,
  NoteServicingStatus,
  NoteStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";

const prisma = new PrismaClient();

const TEMPLATE_NOTE_ID = "cmp2gmbkz0009g3i5n3ls8ijf";
const NOTE_REFERENCE = process.argv[2] ?? "NOTE-LATE-TEST-20260521";

const ACTIVATED_AT = new Date("2026-01-15T09:00:00.000Z");
/** Payment due and contractual maturity match (prod behaviour for bullet notes). */
const PAYMENT_DUE_AND_MATURITY = new Date("2026-04-06T00:00:00.000Z");

async function main() {
  const existing = await prisma.note.findUnique({ where: { note_reference: NOTE_REFERENCE } });
  if (existing) {
    console.log(`Note ${NOTE_REFERENCE} already exists (${existing.id}). Skipping create.`);
    return;
  }

  const template = await prisma.note.findUnique({
    where: { id: TEMPLATE_NOTE_ID },
    include: { investments: true, listing: true, payment_schedules: true },
  });
  if (!template) {
    throw new Error(`Template note ${TEMPLATE_NOTE_ID} not found`);
  }

  const scheduleTemplate = template.payment_schedules[0];
  if (!scheduleTemplate) {
    throw new Error("Template note has no payment schedule");
  }

  const now = new Date();
  const daysPastDue = Math.floor((now.getTime() - PAYMENT_DUE_AND_MATURITY.getTime()) / 86_400_000);
  const daysAfterGrace = Math.max(0, daysPastDue - template.grace_period_days);
  const isArrears = daysAfterGrace >= template.arrears_threshold_days;

  const invoiceSnapshot = template.invoice_snapshot as Prisma.JsonObject | null;
  const invoiceDetails =
    invoiceSnapshot?.details && typeof invoiceSnapshot.details === "object"
      ? { ...(invoiceSnapshot.details as Prisma.JsonObject) }
      : {};
  invoiceDetails.value = 25000;
  invoiceDetails.due_date = "2026-04-06";
  invoiceDetails.maturity_date = "2026-04-06";

  const note = await prisma.$transaction(async (tx) => {
    const created = await tx.note.create({
      data: {
        source_application_id: template.source_application_id,
        source_contract_id: template.source_contract_id,
        source_invoice_id: null,
        issuer_organization_id: template.issuer_organization_id,
        status: isArrears ? NoteStatus.ARREARS : NoteStatus.ACTIVE,
        listing_status: NoteListingStatus.CLOSED,
        funding_status: NoteFundingStatus.FUNDED,
        servicing_status: isArrears ? NoteServicingStatus.ARREARS : NoteServicingStatus.LATE,
        title: `Late fee test note (dev) — ${NOTE_REFERENCE}`,
        note_reference: NOTE_REFERENCE,
        product_snapshot: template.product_snapshot ?? Prisma.JsonNull,
        issuer_snapshot: template.issuer_snapshot,
        paymaster_snapshot: template.paymaster_snapshot ?? Prisma.JsonNull,
        contract_snapshot: template.contract_snapshot ?? Prisma.JsonNull,
        invoice_snapshot: invoiceSnapshot
          ? { ...invoiceSnapshot, details: invoiceDetails }
          : Prisma.JsonNull,
        requested_amount: template.requested_amount,
        target_amount: template.target_amount,
        funded_amount: template.funded_amount,
        minimum_funding_percent: template.minimum_funding_percent,
        profit_rate_percent: template.profit_rate_percent,
        platform_fee_rate_percent: template.platform_fee_rate_percent,
        service_fee_rate_percent: template.service_fee_rate_percent,
        maturity_date: PAYMENT_DUE_AND_MATURITY,
        grace_period_days: template.grace_period_days,
        arrears_threshold_days: template.arrears_threshold_days,
        tawidh_rate_cap_percent: template.tawidh_rate_cap_percent,
        gharamah_rate_cap_percent: template.gharamah_rate_cap_percent,
        published_at: template.published_at,
        funding_closed_at: ACTIVATED_AT,
        activated_at: ACTIVATED_AT,
        arrears_started_at: isArrears ? new Date("2026-04-21T00:00:00.000Z") : null,
      },
    });

    await tx.noteListing.create({
      data: {
        note_id: created.id,
        status: NoteListingStatus.CLOSED,
        opens_at: template.listing?.opens_at ?? ACTIVATED_AT,
        closes_at: template.listing?.closes_at ?? PAYMENT_DUE_AND_MATURITY,
        published_at: template.listing?.published_at ?? ACTIVATED_AT,
        visibility: template.listing?.visibility ?? "INVESTOR_MARKETPLACE",
      },
    });

    await tx.notePaymentSchedule.create({
      data: {
        note_id: created.id,
        status: scheduleTemplate.status,
        sequence: scheduleTemplate.sequence,
        due_date: PAYMENT_DUE_AND_MATURITY,
        expected_principal: scheduleTemplate.expected_principal,
        expected_profit: scheduleTemplate.expected_profit,
        expected_total: scheduleTemplate.expected_total,
      },
    });

    for (const investment of template.investments) {
      await tx.noteInvestment.create({
        data: {
          note_id: created.id,
          investor_organization_id: investment.investor_organization_id,
          investor_user_id: investment.investor_user_id,
          status: investment.status,
          amount: investment.amount,
          allocation_percent: investment.allocation_percent,
          committed_at: investment.committed_at,
          confirmed_at: ACTIVATED_AT,
        },
      });
    }

    return created;
  });

  console.log(`Created late-fee test note ${note.note_reference}`);
  console.log(`  id: ${note.id}`);
  console.log(`  admin: /notes/${note.id}`);
  console.log(`  activated: ${ACTIVATED_AT.toISOString()}`);
  console.log(`  payment due / maturity: ${PAYMENT_DUE_AND_MATURITY.toISOString()}`);
  console.log(`  servicing: ${note.servicing_status}`);
  console.log(`  days past due: ${daysPastDue}, after grace: ${daysAfterGrace}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
