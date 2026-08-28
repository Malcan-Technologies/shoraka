import type {
  OrganizationLinkedRecordRow,
  OrganizationLinkedRecordsCounts,
  OrganizationLinkedRecordsResponse,
  OrganizationLinkedRecordType,
} from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { prisma } from "../../lib/prisma";

function isPlainObjectRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    value &&
    typeof value === "object" &&
    "toNumber" in value &&
    typeof (value as { toNumber: () => number }).toNumber === "function"
  ) {
    const n = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function requestedAmountFromApplication(app: {
  invoices: Array<{ details: unknown }>;
  contract: { contract_details: unknown } | null;
}): number | null {
  if (app.invoices.length > 0) {
    const total = app.invoices.reduce((sum, invoice) => {
      const details = isPlainObjectRecord(invoice.details) ? invoice.details : null;
      const invoiceValue = Number(details?.value ?? 0);
      const financingRatio = Number(details?.financing_ratio_percent ?? 80);
      return sum + (invoiceValue * financingRatio) / 100;
    }, 0);
    return Number.isFinite(total) ? total : null;
  }
  const contractDetails = isPlainObjectRecord(app.contract?.contract_details)
    ? app.contract.contract_details
    : null;
  const amount = Number(contractDetails?.value ?? contractDetails?.approved_facility ?? 0);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function productIdFromFinancingType(financingType: unknown): string | null {
  if (!isPlainObjectRecord(financingType)) return null;
  return typeof financingType.product_id === "string" && financingType.product_id.trim().length > 0
    ? financingType.product_id.trim()
    : null;
}

export function productNameFromFinancingType(financingType: unknown): string | null {
  if (!isPlainObjectRecord(financingType)) return null;
  for (const value of [financingType.product_name, financingType.name]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function contractValueFromDetails(contractDetails: unknown): number | null {
  const details = isPlainObjectRecord(contractDetails) ? contractDetails : null;
  const value = Number(details?.value ?? details?.approved_facility ?? 0);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function resolveLinkedRecordType(
  portal: "issuer" | "investor",
  type: OrganizationLinkedRecordType | undefined
): OrganizationLinkedRecordType {
  if (portal === "issuer") {
    if (type === "investments") {
      throw new AppError(400, "VALIDATION_ERROR", "Issuer organizations do not have investment linked records");
    }
    if (!type || type === "applications" || type === "contracts" || type === "notes") {
      return type ?? "applications";
    }
    throw new AppError(400, "VALIDATION_ERROR", "Invalid linked record type for issuer");
  }
  if (type && type !== "investments") {
    throw new AppError(400, "VALIDATION_ERROR", "Investor organizations only have investment linked records");
  }
  return "investments";
}

function pagination(page: number, pageSize: number, totalCount: number) {
  return {
    page,
    pageSize,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize) || 1),
  };
}

export async function listOrganizationLinkedRecords(
  portal: "issuer" | "investor",
  organizationId: string,
  query: { type?: OrganizationLinkedRecordType; page: number; pageSize: number }
): Promise<OrganizationLinkedRecordsResponse | null> {
  const exists =
    portal === "issuer"
      ? await prisma.issuerOrganization.findUnique({
          where: { id: organizationId },
          select: { id: true },
        })
      : await prisma.investorOrganization.findUnique({
          where: { id: organizationId },
          select: { id: true },
        });
  if (!exists) return null;

  const type = resolveLinkedRecordType(portal, query.type);
  const skip = (query.page - 1) * query.pageSize;

  if (portal === "investor") {
    const where = { investor_organization_id: organizationId };
    const [totalCount, rows] = await Promise.all([
      prisma.noteInvestment.count({ where }),
      prisma.noteInvestment.findMany({
        where,
        orderBy: { committed_at: "desc" },
        skip,
        take: query.pageSize,
        select: {
          id: true,
          status: true,
          amount: true,
          committed_at: true,
          updated_at: true,
          note: {
            select: {
              id: true,
              note_reference: true,
              title: true,
            },
          },
        },
      }),
    ]);
    const items: OrganizationLinkedRecordRow[] = rows.map((investment) => ({
      type: "investment",
      id: investment.id,
      displayReference: investment.note.note_reference,
      title: `${investment.note.note_reference} · ${investment.note.title}`,
      amount: toFiniteNumber(investment.amount),
      status: investment.status,
      updatedAt: investment.updated_at.toISOString(),
      productId: null,
      noteId: investment.note.id,
      contractId: null,
      contractNumber: null,
    }));
    const counts: OrganizationLinkedRecordsCounts = { investments: totalCount };
    return { items, pagination: pagination(query.page, query.pageSize, totalCount), counts };
  }

  const [applicationCount, contractCount, noteCount] = await Promise.all([
    prisma.application.count({ where: { issuer_organization_id: organizationId } }),
    prisma.contract.count({ where: { issuer_organization_id: organizationId } }),
    prisma.note.count({ where: { issuer_organization_id: organizationId } }),
  ]);
  const counts: OrganizationLinkedRecordsCounts = {
    applications: applicationCount,
    contracts: contractCount,
    notes: noteCount,
  };

  if (type === "applications") {
    const [totalCount, rows] = await Promise.all([
      Promise.resolve(applicationCount),
      prisma.application.findMany({
        where: { issuer_organization_id: organizationId },
        orderBy: { updated_at: "desc" },
        skip,
        take: query.pageSize,
        select: {
          id: true,
          display_reference: true,
          status: true,
          financing_type: true,
          contract_id: true,
          updated_at: true,
          invoices: { select: { details: true } },
          contract: { select: { contract_details: true } },
        },
      }),
    ]);
    const items: OrganizationLinkedRecordRow[] = rows.map((app) => ({
      type: "application",
      id: app.id,
      displayReference: app.display_reference ?? null,
      title: productNameFromFinancingType(app.financing_type) ?? "Application",
      amount: requestedAmountFromApplication(app),
      status: app.status,
      updatedAt: app.updated_at.toISOString(),
      productId: productIdFromFinancingType(app.financing_type),
      noteId: null,
      contractId: app.contract_id,
      contractNumber: null,
    }));
    return { items, pagination: pagination(query.page, query.pageSize, totalCount), counts };
  }

  if (type === "contracts") {
    const [totalCount, rows] = await Promise.all([
      Promise.resolve(contractCount),
      prisma.contract.findMany({
        where: { issuer_organization_id: organizationId },
        orderBy: { updated_at: "desc" },
        skip,
        take: query.pageSize,
        select: {
          id: true,
          display_reference: true,
          status: true,
          updated_at: true,
          contract_details: true,
        },
      }),
    ]);
    const items: OrganizationLinkedRecordRow[] = rows.map((contract) => {
      const details = isPlainObjectRecord(contract.contract_details) ? contract.contract_details : null;
      const contractNumber = typeof details?.number === "string" ? details.number : null;
      const title = typeof details?.title === "string" ? details.title : null;
      return {
        type: "contract",
        id: contract.id,
        displayReference: contract.display_reference ?? null,
        title: title ?? contractNumber,
        amount: contractValueFromDetails(contract.contract_details),
        status: contract.status,
        updatedAt: contract.updated_at.toISOString(),
        productId: null,
        noteId: null,
        contractId: contract.id,
        contractNumber,
      };
    });
    return { items, pagination: pagination(query.page, query.pageSize, totalCount), counts };
  }

  const [totalCount, rows] = await Promise.all([
    Promise.resolve(noteCount),
    prisma.note.findMany({
      where: { issuer_organization_id: organizationId },
      orderBy: { updated_at: "desc" },
      skip,
      take: query.pageSize,
      select: {
        id: true,
        note_reference: true,
        title: true,
        status: true,
        target_amount: true,
        updated_at: true,
      },
    }),
  ]);
  const items: OrganizationLinkedRecordRow[] = rows.map((note) => ({
    type: "note",
    id: note.id,
    displayReference: note.note_reference,
    title: note.title,
    amount: toFiniteNumber(note.target_amount),
    status: note.status,
    updatedAt: note.updated_at.toISOString(),
      productId: null,
      noteId: note.id,
      contractId: null,
      contractNumber: null,
  }));
  return { items, pagination: pagination(query.page, query.pageSize, totalCount), counts };
}
