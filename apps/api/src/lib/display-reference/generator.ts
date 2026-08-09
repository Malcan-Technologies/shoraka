import { Prisma } from "@prisma/client";
import {
  DISPLAY_REFERENCE_MAX_RETRIES,
  MALAYSIA_TIME_ZONE,
} from "./constants";
import {
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

function isUniqueConstraintViolation(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return true;
  }
  if (error && typeof error === "object" && "code" in error) {
    return (error as { code?: unknown }).code === "P2002";
  }
  return false;
}

export async function allocateDisplayReference(
  input: AllocateDisplayReferenceInput,
  persistEntityReference: PersistDisplayReferenceRecord
): Promise<string> {
  const maxAttempts = DISPLAY_REFERENCE_MAX_RETRIES;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const candidate = generateDisplayReference(input);
    try {
      await input.tx.displayReferenceAllocation.create({
        data: {
          display_reference: candidate,
          module_code: input.moduleCode,
          product_code: isProductScopedInput(input)
            ? normalizeAndValidateProductCode(input.productCode)
            : null,
          entity_type: input.entityType,
          entity_id: input.entityId,
        },
      });

      await persistEntityReference(input.tx, candidate);
      return candidate;
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        continue;
      }
      throw error;
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

export function assertOrganizationModule(moduleCode: string): void {
  if (!(ORGANIZATION_MODULE_CODES as readonly string[]).includes(moduleCode)) {
    throw new Error("Expected organization display-reference module code");
  }
}
