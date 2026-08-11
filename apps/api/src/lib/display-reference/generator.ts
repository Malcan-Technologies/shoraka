import { Prisma, PrismaClient } from "@prisma/client";
import {
  DISPLAY_REFERENCE_MAX_RETRIES,
  MALAYSIA_TIME_ZONE,
} from "./constants";
import {
  type AllocateDisplayReferenceBaseInput,
  type AllocateDisplayReferenceInput,
  type GenerateDisplayReferenceInput,
  type PersistDisplayReferenceRecord,
  ACCOUNT_SCOPED_MODULE_CODES,
  ORGANIZATION_MODULE_CODES,
  PRODUCT_SCOPED_MODULE_CODES,
} from "./types";
import { normalizeAndValidateProductCode } from "./product-code";
import { generateSecureSuffix } from "./suffix";

export class DisplayReferenceExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DisplayReferenceExhaustedError";
  }
}

export class DisplayReferenceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DisplayReferenceConflictError";
  }
}

function isProductScopedModuleInput(
  input: GenerateDisplayReferenceInput
): input is Extract<GenerateDisplayReferenceInput, { productCode: string }> {
  if ((PRODUCT_SCOPED_MODULE_CODES as readonly string[]).includes(input.moduleCode)) {
    return true;
  }
  return input.moduleCode === "WDL" && "scope" in input && input.scope === "product";
}

function isAccountScopedModuleInput(
  input: GenerateDisplayReferenceInput
): input is Extract<GenerateDisplayReferenceInput, { moduleCode: "WDL" }> & { scope?: never } {
  return (ACCOUNT_SCOPED_MODULE_CODES as readonly string[]).includes(input.moduleCode);
}

function isOrganizationModuleInput(
  input: GenerateDisplayReferenceInput
): input is Extract<GenerateDisplayReferenceInput, { moduleCode: "ISS" | "IVT" }> {
  return (ORGANIZATION_MODULE_CODES as readonly string[]).includes(input.moduleCode);
}

function allocationUsesProductCode(input: AllocateDisplayReferenceBaseInput): boolean {
  return isProductScopedModuleInput(input);
}

export function getMalaysiaYearMonth(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MALAYSIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  if (!year || !month) {
    throw new Error("Failed to resolve Malaysia year-month");
  }

  return `${year}${month}`;
}

export function generateDisplayReference(input: GenerateDisplayReferenceInput): string {
  const yearMonth = getMalaysiaYearMonth(input.referenceDate);
  const suffix = generateSecureSuffix();

  if (isProductScopedModuleInput(input)) {
    const productCode = normalizeAndValidateProductCode(input.productCode);
    return `${input.moduleCode}-${productCode}-${yearMonth}-${suffix}`;
  }

  if (isAccountScopedModuleInput(input)) {
    const inputRecord = input as unknown as Record<string, unknown>;
    if ("productCode" in inputRecord) {
      const maybeCode = inputRecord.productCode;
      if (typeof maybeCode === "string" && maybeCode.trim().length > 0) {
        throw new Error("Account-scoped WDL references must not include a product code.");
      }
    }
    if ("scope" in inputRecord && inputRecord.scope === "product") {
      throw new Error("Account-scoped WDL references must not use product scope.");
    }
    return `${input.moduleCode}-${yearMonth}-${suffix}`;
  }

  if (isOrganizationModuleInput(input)) {
    const inputRecord = input as unknown as Record<string, unknown>;
    if ("productCode" in inputRecord) {
      const maybeCode = inputRecord.productCode;
      if (typeof maybeCode === "string" && maybeCode.trim().length > 0) {
        throw new Error("Organization references must not include a product code.");
      }
    }
    return `${input.moduleCode}-${yearMonth}-${suffix}`;
  }

  throw new Error(`Unsupported display reference module: ${(input as { moduleCode?: string }).moduleCode}`);
}

function getUniqueConstraintTarget(error: unknown): string[] | null | undefined {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    const target = (error.meta as { target?: unknown } | undefined)?.target;
    return Array.isArray(target) ? target.map(String) : null;
  }
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  ) {
    const target = (error as { meta?: { target?: unknown } }).meta?.target;
    return Array.isArray(target) ? target.map(String) : null;
  }
  return undefined;
}

function isDisplayReferenceCollision(error: unknown): boolean {
  const target = getUniqueConstraintTarget(error);
  if (target === undefined) {
    return false;
  }
  if (target === null) {
    return true;
  }
  if (target.length === 0) {
    return true;
  }
  return target.includes("display_reference");
}

function assertEntityAlreadyHasReferenceError(error: unknown): never {
  const target = getUniqueConstraintTarget(error);
  if (target && target.includes("entity_type") && target.includes("entity_id")) {
    throw new Error("Entity already has a canonical display reference allocation.");
  }
  throw error as Error;
}

async function resolveExistingEntityAllocation(
  tx: Prisma.TransactionClient,
  input: AllocateDisplayReferenceBaseInput
): Promise<string> {
  const existing = await tx.displayReferenceAllocation.findUnique({
    where: {
      entity_type_entity_id: {
        entity_type: input.entityType,
        entity_id: input.entityId,
      },
    },
  });
  if (!existing) {
    throw new DisplayReferenceConflictError(
      "Entity already has a canonical display reference allocation."
    );
  }

  if (existing.module_code !== input.moduleCode) {
    throw new DisplayReferenceConflictError(
      `Display reference allocation conflict for ${input.entityType}:${input.entityId}. Existing module ${existing.module_code} does not match requested module ${input.moduleCode}.`
    );
  }

  if (allocationUsesProductCode(input)) {
    const expectedCode = normalizeAndValidateProductCode(
      (input as Extract<AllocateDisplayReferenceBaseInput, { productCode: string }>).productCode
    );
    if (existing.product_code == null) {
      throw new DisplayReferenceConflictError(
        `Display reference allocation conflict for ${input.entityType}:${input.entityId}. Existing allocation has no product code but ${expectedCode} is required.`
      );
    }
    const existingCode = normalizeAndValidateProductCode(existing.product_code);
    if (existingCode !== expectedCode) {
      throw new DisplayReferenceConflictError(
        `Display reference allocation conflict for ${input.entityType}:${input.entityId}. Existing product code ${existingCode} does not match requested product code ${expectedCode}.`
      );
    }
  } else if (existing.product_code != null) {
    throw new DisplayReferenceConflictError(
      `Display reference allocation conflict for ${input.entityType}:${input.entityId}. Existing allocation has product code ${existing.product_code} but account/organization modules must not use product codes.`
    );
  }

  return existing.display_reference;
}

async function allocateDisplayReferenceInTx(
  tx: Prisma.TransactionClient,
  input: AllocateDisplayReferenceBaseInput,
  persistEntityReference: PersistDisplayReferenceRecord
): Promise<string> {
  const inTxInput = { ...input, tx };
  const maxAttempts = DISPLAY_REFERENCE_MAX_RETRIES;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const candidate = generateDisplayReference(inTxInput);
    try {
      await tx.displayReferenceAllocation.create({
        data: {
          display_reference: candidate,
          module_code: inTxInput.moduleCode,
          product_code: allocationUsesProductCode(inTxInput)
            ? normalizeAndValidateProductCode(
                (inTxInput as Extract<AllocateDisplayReferenceBaseInput, { productCode: string }>)
                  .productCode
              )
            : null,
          entity_type: inTxInput.entityType,
          entity_id: inTxInput.entityId,
        },
      });

      await persistEntityReference(tx, candidate);
      return candidate;
    } catch (error) {
      if (isDisplayReferenceCollision(error)) {
        continue;
      }
      const target = getUniqueConstraintTarget(error);
      if (target && target.includes("entity_type") && target.includes("entity_id")) {
        return resolveExistingEntityAllocation(tx, input);
      }
      assertEntityAlreadyHasReferenceError(error);
    }
  }

  const scope = allocationUsesProductCode(input)
    ? `module=${input.moduleCode} product=${normalizeAndValidateProductCode(
        (input as Extract<AllocateDisplayReferenceBaseInput, { productCode: string }>).productCode
      )}`
    : input.moduleCode === "WDL"
      ? "module=WDL scope=account"
      : `module=${input.moduleCode}`;
  throw new DisplayReferenceExhaustedError(
    `Failed to allocate display reference after ${maxAttempts} attempts (${scope}).`
  );
}

function hasTransactionClient(
  input: AllocateDisplayReferenceInput
): input is AllocateDisplayReferenceBaseInput & { tx: Prisma.TransactionClient } {
  return "tx" in input;
}

function hasPrismaClient(
  input: AllocateDisplayReferenceInput
): input is Extract<AllocateDisplayReferenceInput, { prisma: PrismaClient }> {
  return "prisma" in input;
}

function baseInputFromAllocationInput(
  input: AllocateDisplayReferenceInput
): AllocateDisplayReferenceBaseInput {
  const { referenceDate, entityType, entityId, moduleCode } = input;

  switch (moduleCode) {
    case "APP":
    case "CON":
    case "INV":
    case "NOTE":
    case "SET":
      return {
        moduleCode,
        referenceDate,
        productCode: input.productCode,
        entityType,
        entityId,
      };
    case "WDL":
      if ("scope" in input && input.scope === "product") {
        return {
          moduleCode: "WDL",
          scope: "product",
          referenceDate,
          productCode: input.productCode,
          entityType,
          entityId,
        };
      }
      return { moduleCode: "WDL", referenceDate, entityType, entityId };
    case "ISS":
    case "IVT":
      return { moduleCode, referenceDate, entityType, entityId };
    default: {
      const unsupported: never = moduleCode;
      throw new Error(`Unsupported display reference module: ${unsupported}`);
    }
  }
}

export async function allocateDisplayReference(
  input: AllocateDisplayReferenceInput,
  persistEntityReference: PersistDisplayReferenceRecord
): Promise<string> {
  if (hasTransactionClient(input)) {
    return allocateDisplayReferenceInTx(
      input.tx,
      baseInputFromAllocationInput(input),
      persistEntityReference
    );
  }
  if (hasPrismaClient(input)) {
    const baseInput = baseInputFromAllocationInput(input);
    return input.prisma.$transaction((tx) =>
      allocateDisplayReferenceInTx(tx, baseInput, persistEntityReference)
    );
  }
  throw new Error("allocateDisplayReference requires either tx or prisma client.");
}

export function assertOrganizationModule(moduleCode: string): void {
  if (!(ORGANIZATION_MODULE_CODES as readonly string[]).includes(moduleCode)) {
    throw new Error("Expected organization display-reference module code");
  }
}
