import { PrismaClient, ApplicationStatus, NoteStatus } from "@prisma/client";
import { resolveOfferedAmount, resolveOfferedProfitRate, resolveRequestedInvoiceAmount } from "../src/lib/invoice-offer";

const prisma = new PrismaClient();

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

async function main() {
  const source = await prisma.application.findFirst({
    where: { status: ApplicationStatus.COMPLETED },
    include: {
      issuer_organization: true,
      contract: true,
      invoices: { orderBy: { created_at: "asc" } },
    },
    orderBy: { updated_at: "desc" },
  });

  if (!source) {
    console.log("No completed application found. Skipping note scenario seed.");
    return;
  }

  const invoice = source.invoices[0] ?? null;
  const invoiceDetails = asRecord(invoice?.details) ?? {};
  const invoiceOffer = asRecord(invoice?.offer_details) ?? {};
  const contractDetails = asRecord(source.contract?.contract_details) ?? {};
  const customerDetails = asRecord(source.contract?.customer_details) ?? {};
  const amount =
    resolveOfferedAmount(invoiceOffer) ||
    resolveRequestedInvoiceAmount(invoiceDetails) ||
    toNumber(contractDetails.approved_facility) ||
    toNumber(contractDetails.financing) ||
    100_000;

  const note = await prisma.note.upsert({
    where: { note_reference: `SEED-${source.id.slice(-6).toUpperCase()}` },
    update: {},
    create: {
      source_application_id: source.id,
      source_contract_id: source.contract_id,
      source_invoice_id: invoice?.id ?? null,
      issuer_organization_id: source.issuer_organization_id,
      title: `Seed note for ${source.issuer_organization.name ?? source.id}`,
      note_reference: `SEED-${source.id.slice(-6).toUpperCase()}`,
      product_snapshot: source.financing_type ?? undefined,
      issuer_snapshot: {
        id: source.issuer_organization.id,
        name: source.issuer_organization.name,
        type: source.issuer_organization.type,
      },
      paymaster_snapshot: customerDetails,
      contract_snapshot: source.contract
        ? {
            id: source.contract.id,
            status: source.contract.status,
            contract_details: source.contract.contract_details,
            offer_details: source.contract.offer_details,
          }
        : undefined,
      invoice_snapshot: invoice
        ? {
            id: invoice.id,
            status: invoice.status,
            details: invoice.details,
            offer_details: invoice.offer_details,
          }
        : undefined,
      requested_amount: amount,
      target_amount: amount,
      profit_rate_percent: resolveOfferedProfitRate(invoiceOffer),
      platform_fee_rate_percent: 0,
      service_fee_rate_percent: 15,
      maturity_date:
        typeof invoiceDetails.maturity_date === "string"
          ? new Date(invoiceDetails.maturity_date)
          : null,
      status: NoteStatus.DRAFT,
    },
  });

  console.log(`Seeded note scenario ${note.note_reference}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
