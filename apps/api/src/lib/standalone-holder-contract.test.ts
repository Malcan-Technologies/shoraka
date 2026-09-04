import { Prisma } from "@prisma/client";
import {
  isStandaloneHolderContract,
  realFacilityContractWhere,
  resolveInvoiceOccupancyContractId,
} from "./standalone-holder-contract";

describe("standalone holder contracts", () => {
  it("identifies contracts linked only to invoice-only applications", () => {
    expect(
      isStandaloneHolderContract({
        applications: [
          { financing_structure: { structure_type: "invoice_only" } },
          { financing_structure: { structure_type: "invoice_only" } },
        ],
      })
    ).toBe(true);
    expect(
      isStandaloneHolderContract({
        applications: [
          { financing_structure: { structure_type: "invoice_only" } },
          { financing_structure: { structure_type: "existing_contract" } },
        ],
      })
    ).toBe(false);
    expect(isStandaloneHolderContract({ applications: [] })).toBe(false);
  });

  it("keeps unlinked and non-invoice-only contracts in facility queries", () => {
    expect(realFacilityContractWhere()).toEqual({
      OR: [
        { applications: { none: {} } },
        {
          applications: {
            some: {
              OR: [
                { financing_structure: { equals: Prisma.AnyNull } },
                {
                  financing_structure: {
                    path: ["structure_type"],
                    equals: Prisma.AnyNull,
                  },
                },
                {
                  NOT: {
                    financing_structure: {
                      path: ["structure_type"],
                      equals: "invoice_only",
                    },
                  },
                },
              ],
            },
          },
        },
      ],
    });
  });

  it("ignores application and legacy invoice facility links for invoice-only occupancy", () => {
    expect(
      resolveInvoiceOccupancyContractId({
        invoiceContractId: null,
        application: {
          contract_id: "holder-1",
          financing_structure: { structure_type: "invoice_only" },
        },
      })
    ).toBeNull();
    expect(
      resolveInvoiceOccupancyContractId({
        invoiceContractId: "facility-1",
        application: {
          contract_id: "holder-1",
          financing_structure: { structure_type: "invoice_only" },
        },
      })
    ).toBeNull();
    expect(
      resolveInvoiceOccupancyContractId({
        invoiceContractId: null,
        application: {
          contract_id: "facility-1",
          financing_structure: { structure_type: "existing_contract" },
        },
      })
    ).toBe("facility-1");
  });
});
