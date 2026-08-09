import type { Prisma, PrismaClient } from "@prisma/client";
import {
  isValidProductCode,
  normalizeAndValidateProductCode,
} from "../../lib/display-reference/product-code";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type ProductFamilyVersion = {
  id: string;
  version: number;
  status: string;
  name: string;
  productCode: string | null;
};

export type ProductFamilyAuditRow = {
  familyId: string;
  versions: ProductFamilyVersion[];
  productCode: string | null;
  codeMissing: boolean;
  codeInvalid: boolean;
  referencesAllocated: boolean;
  allocationCount: number;
};

export type ProductCodeReadinessFamily = {
  familyId: string;
  activeProductId: string | null;
  names: string[];
  productCode: string | null;
  codeMissing: boolean;
  codeInvalid: boolean;
  hasActiveApplications: boolean;
  ready: boolean;
  blockers: string[];
};

export type ProductCodeReadinessReport = {
  ready: boolean;
  families: ProductCodeReadinessFamily[];
  summary: {
    totalFamilies: number;
    readyFamilies: number;
    blockedFamilies: number;
    missingCodeFamilies: number;
    invalidCodeFamilies: number;
  };
};

export type ProductCodeBackfillPlanRow = {
  familyId: string;
  currentCode: string | null;
  targetCode: string;
  versions: ProductFamilyVersion[];
  action: "apply" | "skip";
  reason?: string;
};

export type ProductCodeBackfillResult = {
  dryRun: boolean;
  applied: number;
  skipped: number;
  unmappedFamilies: ProductFamilyAuditRow[];
  rows: ProductCodeBackfillPlanRow[];
  errors: string[];
};

export function effectiveFamilyId(product: { id: string; base_id?: string | null }): string {
  return product.base_id ?? product.id;
}

export function extractProductDisplayName(workflow: unknown): string {
  const first = Array.isArray(workflow)
    ? (workflow[0] as { config?: { name?: string; type?: { name?: string } } } | undefined)
    : undefined;
  const name = first?.config?.name?.trim() ?? first?.config?.type?.name?.trim();
  return name && name.length > 0 ? name : "—";
}

function resolveFamilyCode(versions: Array<{ product_code: string | null }>): string | null {
  let familyCode: string | null = null;
  for (const row of versions) {
    const code = row.product_code?.trim().toUpperCase() ?? null;
    if (!code) continue;
    if (!familyCode) {
      familyCode = code;
      continue;
    }
    if (familyCode !== code) {
      throw new Error("Product family has inconsistent product codes.");
    }
  }
  return familyCode;
}

export async function loadProductFamilies(db: DbClient): Promise<
  Array<{
    familyId: string;
    versions: Array<{
      id: string;
      version: number;
      status: string;
      workflow: unknown;
      product_code: string | null;
    }>;
  }>
> {
  const products = await db.product.findMany({
    where: { status: { not: "DELETED" } },
    select: {
      id: true,
      base_id: true,
      version: true,
      status: true,
      workflow: true,
      product_code: true,
    },
    orderBy: [{ base_id: "asc" }, { version: "asc" }],
  });

  const byFamily = new Map<
    string,
    Array<{
      id: string;
      version: number;
      status: string;
      workflow: unknown;
      product_code: string | null;
    }>
  >();

  for (const product of products) {
    const familyId = effectiveFamilyId(product);
    const list = byFamily.get(familyId) ?? [];
    list.push(product);
    byFamily.set(familyId, list);
  }

  return Array.from(byFamily.entries()).map(([familyId, versions]) => ({
    familyId,
    versions,
  }));
}

export async function getLockedProductCodes(
  db: DbClient,
  productCodes: string[]
): Promise<Set<string>> {
  const codes = Array.from(new Set(productCodes.map((code) => code.trim()).filter(Boolean)));
  if (codes.length === 0) return new Set();

  const rows = await db.displayReferenceAllocation.findMany({
    where: { product_code: { in: codes } },
    select: { product_code: true },
    distinct: ["product_code"],
  });

  return new Set(
    rows.map((row) => row.product_code).filter((code): code is string => Boolean(code))
  );
}

export async function isProductCodeLocked(
  db: DbClient,
  productCode: string | null | undefined
): Promise<boolean> {
  const code = productCode?.trim();
  if (!code) return false;
  const allocation = await db.displayReferenceAllocation.findFirst({
    where: { product_code: code },
    select: { id: true },
  });
  return allocation != null;
}

export async function auditProductFamilies(db: DbClient): Promise<ProductFamilyAuditRow[]> {
  const families = await loadProductFamilies(db);
  const codes = families
    .map((family) => resolveFamilyCode(family.versions))
    .filter((code): code is string => Boolean(code));

  const allocationCounts = new Map<string, number>();
  if (codes.length > 0) {
    const grouped = await db.displayReferenceAllocation.groupBy({
      by: ["product_code"],
      where: { product_code: { in: codes } },
      _count: { _all: true },
    });
    for (const row of grouped) {
      if (row.product_code) {
        allocationCounts.set(row.product_code, row._count._all);
      }
    }
  }

  return families.map((family) => {
    const productCode = resolveFamilyCode(family.versions);
    const allocationCount = productCode ? allocationCounts.get(productCode) ?? 0 : 0;
    return {
      familyId: family.familyId,
      versions: family.versions.map((version) => ({
        id: version.id,
        version: version.version,
        status: version.status,
        name: extractProductDisplayName(version.workflow),
        productCode: version.product_code,
      })),
      productCode,
      codeMissing: !productCode,
      codeInvalid: productCode != null && !isValidProductCode(productCode),
      referencesAllocated: allocationCount > 0,
      allocationCount,
    };
  });
}

export async function checkProductCodeReadiness(db: DbClient): Promise<ProductCodeReadinessReport> {
  const families = await auditProductFamilies(db);
  const activeProductIds = families
    .map((family) => family.versions.find((version) => version.status === "ACTIVE")?.id)
    .filter((id): id is string => Boolean(id));

  const appsByProductId = new Map<string, number>();
  if (activeProductIds.length > 0) {
    const grouped = await db.application.groupBy({
      by: ["financing_type"],
      where: {
        status: { notIn: ["DRAFT", "WITHDRAWN", "REJECTED", "ARCHIVED"] },
      },
      _count: { _all: true },
    });
    for (const row of grouped) {
      const financingType = row.financing_type as { product_id?: string } | null;
      const productId = financingType?.product_id;
      if (!productId) continue;
      appsByProductId.set(productId, (appsByProductId.get(productId) ?? 0) + row._count._all);
    }
  }

  const readinessFamilies: ProductCodeReadinessFamily[] = families.map((family) => {
    const activeVersion = family.versions.find((version) => version.status === "ACTIVE");
    const names = Array.from(new Set(family.versions.map((version) => version.name)));
    const blockers: string[] = [];
    const activeApps = activeVersion ? appsByProductId.get(activeVersion.id) ?? 0 : 0;
    const hasActiveApplications = activeApps > 0;

    if (activeVersion) {
      if (family.codeMissing) {
        blockers.push("PRODUCT_CODE_MISSING");
      }
      if (family.codeInvalid) {
        blockers.push("PRODUCT_CODE_INVALID");
      }
      if (hasActiveApplications && (family.codeMissing || family.codeInvalid)) {
        blockers.push("PRODUCT_CODE_REQUIRED_FOR_APPLICATIONS");
      }
    }

    const ready = !activeVersion || blockers.length === 0;
    return {
      familyId: family.familyId,
      activeProductId: activeVersion?.id ?? null,
      names,
      productCode: family.productCode,
      codeMissing: family.codeMissing,
      codeInvalid: family.codeInvalid,
      hasActiveApplications,
      ready,
      blockers,
    };
  });

  const blockedFamilies = readinessFamilies.filter((family) => !family.ready).length;
  const missingCodeFamilies = readinessFamilies.filter((family) => family.codeMissing).length;
  const invalidCodeFamilies = readinessFamilies.filter((family) => family.codeInvalid).length;

  return {
    ready: blockedFamilies === 0,
    families: readinessFamilies,
    summary: {
      totalFamilies: readinessFamilies.length,
      readyFamilies: readinessFamilies.length - blockedFamilies,
      blockedFamilies,
      missingCodeFamilies,
      invalidCodeFamilies,
    },
  };
}

export function parseProductCodeMappingInput(
  raw: string
): Map<string, string> {
  const mapping = new Map<string, string>();
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [familyId, code] = trimmed.split(/[:=,\s]+/).map((part) => part.trim());
    if (!familyId || !code) {
      throw new Error(`Invalid mapping line: ${line}`);
    }
    mapping.set(familyId, normalizeAndValidateProductCode(code));
  }
  return mapping;
}

export async function planProductCodeBackfill(
  db: DbClient,
  mapping: Map<string, string>
): Promise<ProductCodeBackfillResult> {
  const audit = await auditProductFamilies(db);
  const unmappedFamilies = audit.filter((family) => family.codeMissing && !mapping.has(family.familyId));
  const rows: ProductCodeBackfillPlanRow[] = [];
  const errors: string[] = [];

  const targetCodeOwners = new Map<string, string>();
  for (const [familyId, code] of mapping.entries()) {
    const existingOwner = targetCodeOwners.get(code);
    if (existingOwner && existingOwner !== familyId) {
      errors.push(
        `Duplicate mapping code ${code} for families ${existingOwner} and ${familyId}.`
      );
    } else {
      targetCodeOwners.set(code, familyId);
    }
  }

  for (const family of audit) {
    const targetCode = mapping.get(family.familyId);
    if (!targetCode) {
      if (family.codeMissing) {
        rows.push({
          familyId: family.familyId,
          currentCode: family.productCode,
          targetCode: "",
          versions: family.versions,
          action: "skip",
          reason: "No mapping provided",
        });
      }
      continue;
    }

    if (family.productCode === targetCode) {
      rows.push({
        familyId: family.familyId,
        currentCode: family.productCode,
        targetCode,
        versions: family.versions,
        action: "skip",
        reason: "Already set",
      });
      continue;
    }

    if (family.referencesAllocated && family.productCode && family.productCode !== targetCode) {
      rows.push({
        familyId: family.familyId,
        currentCode: family.productCode,
        targetCode,
        versions: family.versions,
        action: "skip",
        reason: "Product code locked after reference allocation",
      });
      continue;
    }

    const conflict = audit.find(
      (other) =>
        other.familyId !== family.familyId &&
        other.productCode === targetCode &&
        other.productCode != null
    );
    if (conflict) {
      rows.push({
        familyId: family.familyId,
        currentCode: family.productCode,
        targetCode,
        versions: family.versions,
        action: "skip",
        reason: `Code ${targetCode} already used by family ${conflict.familyId}`,
      });
      continue;
    }

    rows.push({
      familyId: family.familyId,
      currentCode: family.productCode,
      targetCode,
      versions: family.versions,
      action: "apply",
    });
  }

  return {
    dryRun: true,
    applied: rows.filter((row) => row.action === "apply").length,
    skipped: rows.filter((row) => row.action === "skip").length,
    unmappedFamilies,
    rows,
    errors,
  };
}

export async function applyProductCodeBackfill(
  db: DbClient,
  mapping: Map<string, string>,
  dryRun: boolean
): Promise<ProductCodeBackfillResult> {
  const plan = await planProductCodeBackfill(db, mapping);
  if (dryRun || plan.errors.length > 0) {
    return { ...plan, dryRun };
  }

  let applied = 0;
  for (const row of plan.rows) {
    if (row.action !== "apply") continue;
    await db.product.updateMany({
      where: {
        OR: [{ id: row.familyId }, { base_id: row.familyId }],
      },
      data: { product_code: row.targetCode },
    });
    applied += 1;
  }

  return {
    ...plan,
    dryRun: false,
    applied,
    skipped: plan.rows.filter((row) => row.action === "skip").length,
  };
}
