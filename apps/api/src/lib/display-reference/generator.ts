import { Prisma } from "@prisma/client";
import {
  DISPLAY_REFERENCE_MAX_RETRIES,
  MALAYSIA_TIME_ZONE,
} from "./constants";
import {
  type AllocateDisplayReferenceBaseInput,
  type AllocateDisplayReferenceInput,
  type GenerateDisplayReferenceInput,
  type PersistDisplayReferenceRecord,
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

function isProductScopedInput(
  input: GenerateDisplayReferenceInput
): input is Extract<GenerateDisplayReferenceInput, { productCode: string }> {
  return (PRODUCT_SCOPED_MODULE_CODES as readonly string[]).includes(input.moduleCode);
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

  if (isProductScopedInput(input)) {
    const productCode = normalizeAndValidateProductCode(input.productCode);
    return `${input.moduleCode}-${productCode}-${yearMonth}-${suffix}`;
  }

  const inputRecord = input as unknown as Record<string, unknown>;
  if ("productCode" in inputRecord) {
    const maybeCode = inputRecord.productCode;
    if (typeof maybeCode === "string" && maybeCode.trim().length > 0) {
      throw new Error("Organization references must not include a product code.");
    }
  }

  return `${input.moduleCode}-${yearMonth}-${suffix}`;
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
          product_code: isProductScopedInput(inTxInput)
            ? normalizeAndValidateProductCode(inTxInput.productCode)
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
      assertEntityAlreadyHasReferenceError(error);
    }
  }

  const scope = (PRODUCT_SCOPED_MODULE_CODES as readonly string[]).includes(input.moduleCode)
    ? `module=${input.moduleCode} product=${normalizeAndValidateProductCode(
        (input as Extract<GenerateDisplayReferenceInput, { productCode: string }>).productCode
      )}`
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
): input is AllocateDisplayReferenceBaseInput & {
  prisma: { $transaction: (fn: (tx: Prisma.TransactionClient) => Promise<string>) => Promise<string> };
} {
  return "prisma" in input;
}

function baseInputFromAllocationInput(
  input: AllocateDisplayReferenceInput
): AllocateDisplayReferenceBaseInput {
  const { moduleCode, referenceDate, entityType, entityId } = input;
  if (isProductScopedInput(input)) {
    return { moduleCode, referenceDate, productCode: input.productCode, entityType, entityId };
  }
  return { moduleCode, referenceDate, entityType, entityId };
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
