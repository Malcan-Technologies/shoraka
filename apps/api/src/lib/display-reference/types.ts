import type { Prisma } from "@prisma/client";

export const PRODUCT_SCOPED_MODULE_CODES = ["APP", "CON", "INV", "NOTE", "SET", "WDL"] as const;
export const ORGANIZATION_MODULE_CODES = ["ISS", "IVT"] as const;
export const MODULE_CODES = [...PRODUCT_SCOPED_MODULE_CODES, ...ORGANIZATION_MODULE_CODES] as const;

export type ProductScopedModuleCode = (typeof PRODUCT_SCOPED_MODULE_CODES)[number];
export type OrganizationModuleCode = (typeof ORGANIZATION_MODULE_CODES)[number];
export type ModuleCode = (typeof MODULE_CODES)[number];

export interface ProductScopedReferenceInput {
  moduleCode: ProductScopedModuleCode;
  productCode: string;
  referenceDate: Date;
}

export interface OrganizationReferenceInput {
  moduleCode: OrganizationModuleCode;
  referenceDate: Date;
}

export type GenerateDisplayReferenceInput = ProductScopedReferenceInput | OrganizationReferenceInput;

export type DisplayReferenceEntityType =
  | "application"
  | "contract"
  | "invoice"
  | "note"
  | "note_settlement"
  | "withdrawal_instruction"
  | "issuer_organization"
  | "investor_organization";

export type AllocationInputBase = {
  entityType: DisplayReferenceEntityType;
  entityId: string;
  tx: Prisma.TransactionClient;
};

export type AllocateDisplayReferenceInput =
  | (ProductScopedReferenceInput & AllocationInputBase)
  | (OrganizationReferenceInput & AllocationInputBase);

export type PersistDisplayReferenceRecord = (
  tx: Prisma.TransactionClient,
  reference: string
) => Promise<void>;
