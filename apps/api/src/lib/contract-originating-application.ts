import type { Prisma, PrismaClient } from "@prisma/client";
import {
  isNewContractFinancingStructure,
  isTerminalOriginatingApplicationStatus,
  pickEarliestOriginatingApplication,
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
