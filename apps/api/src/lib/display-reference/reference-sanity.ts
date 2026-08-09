import type { PrismaClient } from "@prisma/client";
import {
  MODULE_CODES,
  ORGANIZATION_MODULE_CODES,
  PRODUCT_SCOPED_MODULE_CODES,
} from "./types";
import { isValidProductCode } from "./product-code";

export type ReferenceSanityIssue = {
  code: string;
  severity: "error" | "warning";
  message: string;
  allocationId?: string;
  entityType?: string;
  entityId?: string;
  displayReference?: string;
};

export type ReferenceSanityModuleSummary = {
  moduleCode: string;
  allocationCount: number;
  issueCount: number;
};

export type ReferenceSanityReport = {
  ok: boolean;
  issues: ReferenceSanityIssue[];
  byModule: ReferenceSanityModuleSummary[];
  totals: {
    allocations: number;
    duplicateAllocations: number;
    issues: number;
  };
};

const PRODUCT_SCOPED_PATTERN = new RegExp(
  `^(${PRODUCT_SCOPED_MODULE_CODES.join("|")})-([A-Z0-9]{2,8})-(\\d{6})-([A-Z0-9]{3})$`
);
const ORGANIZATION_PATTERN = new RegExp(
  `^(${ORGANIZATION_MODULE_CODES.join("|")})-(\\d{6})-([A-Z0-9]{3})$`
);

type EntityReferenceLookup = {
  entityType: string;
  entityId: string;
  reference: string | null;
};

function parseReferenceParts(reference: string): {
  moduleCode: string;
  productCode: string | null;
} | null {
  const productScoped = reference.match(PRODUCT_SCOPED_PATTERN);
  if (productScoped) {
    return { moduleCode: productScoped[1], productCode: productScoped[2] };
  }
  const organization = reference.match(ORGANIZATION_PATTERN);
  if (organization) {
    return { moduleCode: organization[1], productCode: null };
  }
  return null;
}

async function loadEntityReference(
  db: PrismaClient,
  entityType: string,
  entityId: string
): Promise<string | null> {
  switch (entityType) {
    case "application": {
      const row = await db.application.findUnique({
        where: { id: entityId },
        select: { display_reference: true },
      });
      return row?.display_reference ?? null;
    }
    case "contract": {
      const row = await db.contract.findUnique({
        where: { id: entityId },
        select: { display_reference: true },
      });
      return row?.display_reference ?? null;
    }
    case "invoice": {
      const row = await db.invoice.findUnique({
        where: { id: entityId },
        select: { display_reference: true },
      });
      return row?.display_reference ?? null;
    }
    case "note": {
      const row = await db.note.findUnique({
        where: { id: entityId },
        select: { note_reference: true },
      });
      return row?.note_reference ?? null;
    }
    case "note_settlement": {
      const row = await db.noteSettlement.findUnique({
        where: { id: entityId },
        select: { display_reference: true },
      });
      return row?.display_reference ?? null;
    }
    case "withdrawal_instruction": {
      const row = await db.withdrawalInstruction.findUnique({
        where: { id: entityId },
        select: { display_reference: true },
      });
      return row?.display_reference ?? null;
    }
    case "issuer_organization": {
      const row = await db.issuerOrganization.findUnique({
        where: { id: entityId },
        select: { display_reference: true },
      });
      return row?.display_reference ?? null;
    }
    case "investor_organization": {
      const row = await db.investorOrganization.findUnique({
        where: { id: entityId },
        select: { display_reference: true },
      });
      return row?.display_reference ?? null;
    }
    default:
      return null;
  }
}

export async function checkDisplayReferenceSanity(
  db: PrismaClient
): Promise<ReferenceSanityReport> {
  const issues: ReferenceSanityIssue[] = [];
  const allocations = await db.displayReferenceAllocation.findMany({
    orderBy: [{ module_code: "asc" }, { allocated_at: "asc" }],
  });

  const byReference = new Map<string, typeof allocations>();
  for (const allocation of allocations) {
    const list = byReference.get(allocation.display_reference) ?? [];
    list.push(allocation);
    byReference.set(allocation.display_reference, list);
  }

  let duplicateAllocations = 0;
  for (const [reference, rows] of byReference.entries()) {
    if (rows.length <= 1) continue;
    duplicateAllocations += rows.length - 1;
    for (const row of rows) {
      issues.push({
        code: "DUPLICATE_ALLOCATION",
        severity: "error",
        message: `Duplicate allocation for display reference ${reference}`,
        allocationId: row.id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        displayReference: reference,
      });
    }
  }

  const byModule = new Map<string, ReferenceSanityModuleSummary>();
  for (const moduleCode of MODULE_CODES) {
    byModule.set(moduleCode, { moduleCode, allocationCount: 0, issueCount: 0 });
  }

  for (const allocation of allocations) {
    const moduleSummary = byModule.get(allocation.module_code) ?? {
      moduleCode: allocation.module_code,
      allocationCount: 0,
      issueCount: 0,
    };
    moduleSummary.allocationCount += 1;

    const parsed = parseReferenceParts(allocation.display_reference);
    if (!parsed) {
      issues.push({
        code: "INVALID_FORMAT",
        severity: "error",
        message: `Display reference ${allocation.display_reference} does not match canonical format`,
        allocationId: allocation.id,
        entityType: allocation.entity_type,
        entityId: allocation.entity_id,
        displayReference: allocation.display_reference,
      });
    } else if (parsed.moduleCode !== allocation.module_code) {
      issues.push({
        code: "MODULE_MISMATCH",
        severity: "error",
        message: `Allocation module ${allocation.module_code} does not match reference prefix ${parsed.moduleCode}`,
        allocationId: allocation.id,
        entityType: allocation.entity_type,
        entityId: allocation.entity_id,
        displayReference: allocation.display_reference,
      });
    }

    const isProductScoped = (PRODUCT_SCOPED_MODULE_CODES as readonly string[]).includes(
      allocation.module_code
    );
    const isOrganization = (ORGANIZATION_MODULE_CODES as readonly string[]).includes(
      allocation.module_code
    );

    if (isProductScoped) {
      if (!allocation.product_code) {
        issues.push({
          code: "MISSING_PRODUCT_CODE",
          severity: "error",
          message: `Product-scoped allocation ${allocation.display_reference} is missing product_code`,
          allocationId: allocation.id,
          entityType: allocation.entity_type,
          entityId: allocation.entity_id,
          displayReference: allocation.display_reference,
        });
      } else if (!isValidProductCode(allocation.product_code)) {
        issues.push({
          code: "INVALID_PRODUCT_CODE",
          severity: "error",
          message: `Allocation product_code ${allocation.product_code} is invalid`,
          allocationId: allocation.id,
          entityType: allocation.entity_type,
          entityId: allocation.entity_id,
          displayReference: allocation.display_reference,
        });
      } else if (parsed?.productCode && parsed.productCode !== allocation.product_code) {
        issues.push({
          code: "PRODUCT_CODE_MISMATCH",
          severity: "error",
          message: `Allocation product_code ${allocation.product_code} does not match reference ${parsed.productCode}`,
          allocationId: allocation.id,
          entityType: allocation.entity_type,
          entityId: allocation.entity_id,
          displayReference: allocation.display_reference,
        });
      }
    }

    if (isOrganization && allocation.product_code) {
      issues.push({
        code: "ORGANIZATION_HAS_PRODUCT_CODE",
        severity: "error",
        message: `Organization allocation ${allocation.display_reference} must not include product_code`,
        allocationId: allocation.id,
        entityType: allocation.entity_type,
        entityId: allocation.entity_id,
        displayReference: allocation.display_reference,
      });
    }

    const entityReference = await loadEntityReference(
      db,
      allocation.entity_type,
      allocation.entity_id
    );
    if (!entityReference) {
      issues.push({
        code: "ENTITY_REFERENCE_MISSING",
        severity: "error",
        message: `Entity ${allocation.entity_type}:${allocation.entity_id} has no canonical reference field value`,
        allocationId: allocation.id,
        entityType: allocation.entity_type,
        entityId: allocation.entity_id,
        displayReference: allocation.display_reference,
      });
    } else if (entityReference !== allocation.display_reference) {
      issues.push({
        code: "ENTITY_REFERENCE_MISMATCH",
        severity: "error",
        message: `Entity reference ${entityReference} does not match allocation ${allocation.display_reference}`,
        allocationId: allocation.id,
        entityType: allocation.entity_type,
        entityId: allocation.entity_id,
        displayReference: allocation.display_reference,
      });
    }

    moduleSummary.issueCount = issues.filter(
      (issue) => issue.displayReference === allocation.display_reference
    ).length;
    byModule.set(allocation.module_code, moduleSummary);
  }

  const entityTables: Array<{
    entityType: string;
    rows: EntityReferenceLookup[];
  }> = [
    {
      entityType: "application",
      rows: (
        await db.application.findMany({
          where: { display_reference: { not: null } },
          select: { id: true, display_reference: true },
        })
      ).map((row) => ({
        entityType: "application",
        entityId: row.id,
        reference: row.display_reference,
      })),
    },
    {
      entityType: "contract",
      rows: (
        await db.contract.findMany({
          where: { display_reference: { not: null } },
          select: { id: true, display_reference: true },
        })
      ).map((row) => ({
        entityType: "contract",
        entityId: row.id,
        reference: row.display_reference,
      })),
    },
    {
      entityType: "invoice",
      rows: (
        await db.invoice.findMany({
          where: { display_reference: { not: null } },
          select: { id: true, display_reference: true },
        })
      ).map((row) => ({
        entityType: "invoice",
        entityId: row.id,
        reference: row.display_reference,
      })),
    },
    {
      entityType: "note",
      rows: (
        await db.note.findMany({
          select: { id: true, note_reference: true },
        })
      )
        .filter((row) => /^NOTE-/.test(row.note_reference))
        .map((row) => ({
          entityType: "note",
          entityId: row.id,
          reference: row.note_reference,
        })),
    },
    {
      entityType: "note_settlement",
      rows: (
        await db.noteSettlement.findMany({
          where: { display_reference: { not: null } },
          select: { id: true, display_reference: true },
        })
      ).map((row) => ({
        entityType: "note_settlement",
        entityId: row.id,
        reference: row.display_reference,
      })),
    },
    {
      entityType: "withdrawal_instruction",
      rows: (
        await db.withdrawalInstruction.findMany({
          where: { display_reference: { not: null } },
          select: { id: true, display_reference: true },
        })
      ).map((row) => ({
        entityType: "withdrawal_instruction",
        entityId: row.id,
        reference: row.display_reference,
      })),
    },
    {
      entityType: "issuer_organization",
      rows: (
        await db.issuerOrganization.findMany({
          where: { display_reference: { not: null } },
          select: { id: true, display_reference: true },
        })
      ).map((row) => ({
        entityType: "issuer_organization",
        entityId: row.id,
        reference: row.display_reference,
      })),
    },
    {
      entityType: "investor_organization",
      rows: (
        await db.investorOrganization.findMany({
          where: { display_reference: { not: null } },
          select: { id: true, display_reference: true },
        })
      ).map((row) => ({
        entityType: "investor_organization",
        entityId: row.id,
        reference: row.display_reference,
      })),
    },
  ];

  const allocationByEntity = new Map(
    allocations.map((allocation) => [
      `${allocation.entity_type}:${allocation.entity_id}`,
      allocation,
    ])
  );

  for (const table of entityTables) {
    for (const row of table.rows) {
      if (!row.reference) continue;
      const key = `${row.entityType}:${row.entityId}`;
      const allocation = allocationByEntity.get(key);
      if (!allocation) {
        issues.push({
          code: "ALLOCATION_ROW_MISSING",
          severity: "error",
          message: `Entity ${key} has reference ${row.reference} but no allocation registry row`,
          entityType: row.entityType,
          entityId: row.entityId,
          displayReference: row.reference,
        });
      }
    }
  }

  for (const summary of byModule.values()) {
    summary.issueCount = issues.filter((issue) => {
      if (!issue.displayReference) return false;
      const parsed = parseReferenceParts(issue.displayReference);
      return parsed?.moduleCode === summary.moduleCode;
    }).length;
  }

  return {
    ok: issues.length === 0,
    issues,
    byModule: Array.from(byModule.values()),
    totals: {
      allocations: allocations.length,
      duplicateAllocations,
      issues: issues.length,
    },
  };
}
