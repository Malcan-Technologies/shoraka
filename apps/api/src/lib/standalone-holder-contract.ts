import { Prisma } from "@prisma/client";
import { isInvoiceOnlyFinancingStructure } from "@cashsouk/types";

const nonInvoiceOnlyApplicationWhere: Prisma.ApplicationWhereInput = {
  OR: [
    { financing_structure: { equals: Prisma.AnyNull } },
    { financing_structure: { path: ["structure_type"], equals: Prisma.AnyNull } },
    {
      NOT: {
        financing_structure: {
          path: ["structure_type"],
          equals: "invoice_only",
        },
      },
    },
  ],
};

export function realFacilityContractWhere(): Prisma.ContractWhereInput {
  return {
    OR: [
      { applications: { none: {} } },
      { applications: { some: nonInvoiceOnlyApplicationWhere } },
    ],
  };
}

export function isStandaloneHolderContract(contract: {
  applications: ReadonlyArray<{ financing_structure: unknown }>;
}): boolean {
  return (
    contract.applications.length > 0 &&
    contract.applications.every((application) =>
      isInvoiceOnlyFinancingStructure(application.financing_structure)
    )
  );
}

export function resolveInvoiceOccupancyContractId(input: {
  invoiceContractId?: string | null;
  application: {
    contract_id?: string | null;
    financing_structure?: unknown;
  };
}): string | null {
  if (isInvoiceOnlyFinancingStructure(input.application.financing_structure)) return null;
  if (input.invoiceContractId) return input.invoiceContractId;
  return input.application.contract_id ?? null;
}
