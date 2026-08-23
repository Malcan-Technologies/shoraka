import type { Prisma, PrismaClient } from "@prisma/client";

export const PRODUCT_SCOPED_MODULE_CODES = ["APP", "CON", "INV", "NOTE", "SET"] as const;
export const ACCOUNT_SCOPED_MODULE_CODES = ["WDL"] as const;
export const ORGANIZATION_MODULE_CODES = ["ISS", "IVT"] as const;
export const RECEIPT_MODULE_CODES = ["RCP"] as const;
export const MODULE_CODES = [
  ...PRODUCT_SCOPED_MODULE_CODES,
  ...ACCOUNT_SCOPED_MODULE_CODES,
  ...ORGANIZATION_MODULE_CODES,
  ...RECEIPT_MODULE_CODES,
] as const;

export type ProductScopedModuleCode = (typeof PRODUCT_SCOPED_MODULE_CODES)[number];
export type AccountScopedModuleCode = (typeof ACCOUNT_SCOPED_MODULE_CODES)[number];
export type OrganizationModuleCode = (typeof ORGANIZATION_MODULE_CODES)[number];
export type ReceiptModuleCode = (typeof RECEIPT_MODULE_CODES)[number];
export type ModuleCode = (typeof MODULE_CODES)[number];

export interface ProductScopedReferenceInput {
  moduleCode: ProductScopedModuleCode;
  productCode: string;
  referenceDate: Date;
}

export interface WdlProductScopedReferenceInput {
  moduleCode: "WDL";
  scope: "product";
  productCode: string;
  referenceDate: Date;
}

export interface AccountScopedReferenceInput {
  moduleCode: AccountScopedModuleCode;
  referenceDate: Date;
}

export interface OrganizationReferenceInput {
  moduleCode: OrganizationModuleCode;
  referenceDate: Date;
}

export interface ReceiptReferenceInput {
  moduleCode: ReceiptModuleCode;
  referenceDate: Date;
}

export type GenerateDisplayReferenceInput =
  | ProductScopedReferenceInput
  | WdlProductScopedReferenceInput
  | AccountScopedReferenceInput
  | OrganizationReferenceInput
  | ReceiptReferenceInput;

export type DisplayReferenceEntityType =
  | "application"
  | "contract"
  | "invoice"
  | "note"
  | "note_settlement"
  | "withdrawal_instruction"
  | "issuer_organization"
  | "investor_organization"
  | "gateway_payment_receipt";

export type AllocationInputBase = {
  entityType: DisplayReferenceEntityType;
  entityId: string;
};

export type AllocateDisplayReferenceBaseInput =
  | (ProductScopedReferenceInput & AllocationInputBase)
  | (WdlProductScopedReferenceInput & AllocationInputBase)
  | (AccountScopedReferenceInput & AllocationInputBase)
  | (OrganizationReferenceInput & AllocationInputBase)
  | (ReceiptReferenceInput & AllocationInputBase);

export type AllocateDisplayReferenceInput =
  | (AllocateDisplayReferenceBaseInput & { tx: Prisma.TransactionClient; prisma?: never })
  | (AllocateDisplayReferenceBaseInput & { prisma: PrismaClient; tx?: never });

export type PersistDisplayReferenceRecord = (
  tx: Prisma.TransactionClient,
  reference: string
) => Promise<void>;
