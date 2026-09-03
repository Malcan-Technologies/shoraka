import type { Prisma, PrismaClient } from "@prisma/client";
import {
  getFacilityLockedCategoriesFromWorkflow,
  isInheritedFacilityGuarantorReview,
  isNewContractFinancingStructure,
  isTerminalOriginatingApplicationStatus,
  mergeFacilityLockedSupportingDocumentReviewItems,
  mergeFacilityLockedSupportingDocuments,
  pickEarliestOriginatingApplication,
  readFinancingStructureType,
  type SupportingDocumentReviewItem,
} from "@cashsouk/types";

type DbClient = PrismaClient | Prisma.TransactionClient;

export async function resolveContractOriginatingApplicationId(
  db: DbClient,
  contractId: string,
  persistedOriginatingApplicationId?: string | null
): Promise<string | null> {
  if (persistedOriginatingApplicationId) {
    return persistedOriginatingApplicationId;
  }

  const linkedApplications = await db.application.findMany({
    where: { contract_id: contractId },
    select: {
      id: true,
      status: true,
      submitted_at: true,
      updated_at: true,
      financing_structure: true,
    },
  });

  const candidates = linkedApplications.filter(
    (application) =>
      isNewContractFinancingStructure(
        application.financing_structure as { structure_type?: string } | null
      ) && isTerminalOriginatingApplicationStatus(application.status)
  );

  return pickEarliestOriginatingApplication(candidates)?.id ?? null;
}

/** Set once when a new_contract application first approves the contract offer. */
export async function stampContractOriginatingApplicationIfAbsent(
  db: DbClient,
  contractId: string,
  applicationId: string
): Promise<void> {
  await db.contract.updateMany({
    where: { id: contractId, originating_application_id: null },
    data: { originating_application_id: applicationId },
  });
}

export type InheritedAcceptancePayload = {
  source_application_id: string;
  source_product_id: string | null;
  acceptance_documents: unknown;
  review_items: { item_type: string; item_id: string; status: string }[];
  product_workflow: unknown[] | null;
  product_version: number | null;
};

export async function loadInheritedAcceptanceForExistingContract(
  db: DbClient,
  input: {
    contractId: string;
    originatingApplicationId?: string | null;
  }
): Promise<InheritedAcceptancePayload | null> {
  const sourceApplicationId = await resolveContractOriginatingApplicationId(
    db,
    input.contractId,
    input.originatingApplicationId
  );
  if (!sourceApplicationId) {
    return null;
  }

  const sourceApplication = await db.application.findUnique({
    where: { id: sourceApplicationId },
    select: {
      id: true,
      acceptance_documents: true,
      product_version: true,
      financing_type: true,
      application_review_items: {
        where: {
          item_type: "document",
          item_id: { startsWith: "acceptance_documents:" },
        },
        select: { item_type: true, item_id: true, status: true },
      },
    },
  });
  if (!sourceApplication) {
    return null;
  }

  const financingType =
    sourceApplication.financing_type && typeof sourceApplication.financing_type === "object"
      ? (sourceApplication.financing_type as Record<string, unknown>)
      : null;
  const productId =
    typeof financingType?.product_id === "string" ? financingType.product_id : null;

  let productWorkflow: unknown[] | null = null;
  if (productId && sourceApplication.product_version != null) {
    const product = await db.product.findFirst({
      where: {
        version: sourceApplication.product_version,
        OR: [{ id: productId }, { base_id: productId }],
      },
      select: { workflow: true },
    });
    if (product?.workflow && Array.isArray(product.workflow)) {
      productWorkflow = product.workflow as unknown[];
    }
  }

  return {
    source_application_id: sourceApplication.id,
    source_product_id: productId,
    acceptance_documents: sourceApplication.acceptance_documents,
    review_items: sourceApplication.application_review_items,
    product_workflow: productWorkflow,
    product_version: sourceApplication.product_version,
  };
}

export type InheritedGuarantorsPayload = {
  source_application_id: string;
  source_display_reference: string | null;
  source_product_id: string | null;
  application_guarantors: unknown[];
};

export async function loadInheritedGuarantorsForExistingContract(
  db: DbClient,
  input: {
    contractId: string;
    originatingApplicationId?: string | null;
  }
): Promise<InheritedGuarantorsPayload | null> {
  const sourceApplicationId = await resolveContractOriginatingApplicationId(
    db,
    input.contractId,
    input.originatingApplicationId
  );
  if (!sourceApplicationId) {
    return null;
  }

  const sourceApplication = await db.application.findUnique({
    where: { id: sourceApplicationId },
    select: {
      id: true,
      display_reference: true,
      financing_type: true,
      application_guarantors: { orderBy: { position: "asc" as const } },
    },
  });
  if (!sourceApplication) {
    return null;
  }

  const financingType =
    sourceApplication.financing_type && typeof sourceApplication.financing_type === "object"
      ? (sourceApplication.financing_type as Record<string, unknown>)
      : null;
  const productId =
    typeof financingType?.product_id === "string" ? financingType.product_id : null;

  return {
    source_application_id: sourceApplication.id,
    source_display_reference: sourceApplication.display_reference ?? null,
    source_product_id: productId,
    application_guarantors: sourceApplication.application_guarantors,
  };
}

export async function attachInheritedFacilityGuarantors<
  T extends {
    financing_structure?: unknown;
    contract_id?: string | null;
    contract?: { status?: string | null; originating_application_id?: string | null } | null;
    application_guarantors?: unknown;
  },
>(
  db: DbClient,
  application: T
): Promise<T & { inherited_guarantors: InheritedGuarantorsPayload | null }> {
  const structureType = readFinancingStructureType(application.financing_structure);
  if (
    !isInheritedFacilityGuarantorReview(structureType) ||
    !application.contract_id ||
    application.contract?.status !== "APPROVED"
  ) {
    return { ...application, inherited_guarantors: null };
  }

  const inherited = await loadInheritedGuarantorsForExistingContract(db, {
    contractId: application.contract_id,
    originatingApplicationId: application.contract.originating_application_id ?? null,
  });

  return {
    ...application,
    inherited_guarantors: inherited,
    application_guarantors: inherited?.application_guarantors ?? application.application_guarantors,
  };
}

export type InheritedSupportingDocumentsPayload = {
  source_application_id: string;
  supporting_documents: unknown;
  review_items: SupportingDocumentReviewItem[];
};

export async function loadInheritedSupportingDocumentsForExistingContract(
  db: DbClient,
  input: {
    contractId: string;
    originatingApplicationId?: string | null;
  }
): Promise<InheritedSupportingDocumentsPayload | null> {
  const sourceApplicationId = await resolveContractOriginatingApplicationId(
    db,
    input.contractId,
    input.originatingApplicationId
  );
  if (!sourceApplicationId) {
    return null;
  }

  const sourceApplication = await db.application.findUnique({
    where: { id: sourceApplicationId },
    select: {
      id: true,
      supporting_documents: true,
      application_review_items: {
        where: {
          item_type: "document",
          item_id: { startsWith: "supporting_documents:" },
        },
        select: { item_type: true, item_id: true, status: true },
      },
    },
  });
  if (!sourceApplication) {
    return null;
  }

  return {
    source_application_id: sourceApplication.id,
    supporting_documents: sourceApplication.supporting_documents,
    review_items: sourceApplication.application_review_items,
  };
}

async function loadApplicationProductWorkflow(
  db: DbClient,
  application: {
    product_version?: number | null;
    financing_type?: unknown;
  }
): Promise<unknown[] | null> {
  const financingType =
    application.financing_type && typeof application.financing_type === "object"
      ? (application.financing_type as Record<string, unknown>)
      : null;
  const productId = typeof financingType?.product_id === "string" ? financingType.product_id : null;
  if (!productId) return null;

  const product =
    application.product_version != null
      ? await db.product.findFirst({
          where: {
            version: application.product_version,
            OR: [{ id: productId }, { base_id: productId }],
          },
          select: { workflow: true },
        })
      : await db.product.findFirst({
          where: { OR: [{ id: productId }, { base_id: productId }] },
          orderBy: { version: "desc" },
          select: { workflow: true },
        });
  if (!product?.workflow || !Array.isArray(product.workflow)) return null;
  return product.workflow as unknown[];
}

export async function attachInheritedFacilitySupportingDocuments<
  T extends {
    financing_type?: unknown;
    financing_structure?: unknown;
    product_version?: number | null;
    contract_id?: string | null;
    contract?: { status?: string | null; originating_application_id?: string | null } | null;
    supporting_documents?: unknown;
    application_review_items?: SupportingDocumentReviewItem[];
  },
>(
  db: DbClient,
  application: T,
  productWorkflow?: unknown[] | null
): Promise<
  T & {
    facility_locked_supporting_categories: string[];
    inherited_supporting_documents: InheritedSupportingDocumentsPayload | null;
  }
> {
  const structureType = readFinancingStructureType(application.financing_structure);
  const empty = {
    ...application,
    facility_locked_supporting_categories: [] as string[],
    inherited_supporting_documents: null,
  };
  if (structureType !== "existing_contract") {
    return empty;
  }

  const workflow =
    productWorkflow === undefined
      ? await loadApplicationProductWorkflow(db, application)
      : productWorkflow;
  const lockedKeys: string[] = getFacilityLockedCategoriesFromWorkflow(workflow);
  if (lockedKeys.length === 0) {
    return empty;
  }

  if (!application.contract_id || application.contract?.status !== "APPROVED") {
    return {
      ...application,
      facility_locked_supporting_categories: lockedKeys,
      inherited_supporting_documents: null,
    };
  }

  const inherited = await loadInheritedSupportingDocumentsForExistingContract(db, {
    contractId: application.contract_id,
    originatingApplicationId: application.contract.originating_application_id ?? null,
  });

  return {
    ...application,
    supporting_documents: mergeFacilityLockedSupportingDocuments({
      drawdownDocs: application.supporting_documents,
      originDocs: inherited?.supporting_documents,
      lockedKeys,
    }),
    application_review_items: mergeFacilityLockedSupportingDocumentReviewItems(
      application.application_review_items,
      inherited?.review_items,
      lockedKeys
    ),
    facility_locked_supporting_categories: lockedKeys,
    inherited_supporting_documents: inherited,
  };
}
