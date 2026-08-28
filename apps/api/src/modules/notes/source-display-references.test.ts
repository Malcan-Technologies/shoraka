import { applyNoteSourceDisplayReferences } from "./mapper";

describe("applyNoteSourceDisplayReferences", () => {
  it("overlays canonical source refs without generating them", () => {
    const mapped = applyNoteSourceDisplayReferences(
      {
        id: "note_1",
        sourceApplicationDisplayReference: null,
        sourceContractDisplayReference: null,
        sourceInvoiceDisplayReference: null,
        issuerOrganizationDisplayReference: null,
      } as never,
      {
        source_application_id: "app_1",
        source_contract_id: "con_1",
        source_invoice_id: "inv_1",
        issuer_organization_id: "org_1",
      },
      {
        applicationById: new Map([["app_1", "APP-ARF-202608-A82"]]),
        contractById: new Map([["con_1", "CON-ARF-202608-K71"]]),
        invoiceById: new Map([["inv_1", "INV-ARF-202608-0N5"]]),
        issuerOrgById: new Map([["org_1", "ISS-202608-DK3"]]),
      }
    );

    expect(mapped.sourceApplicationDisplayReference).toBe("APP-ARF-202608-A82");
    expect(mapped.sourceContractDisplayReference).toBe("CON-ARF-202608-K71");
    expect(mapped.sourceInvoiceDisplayReference).toBe("INV-ARF-202608-0N5");
    expect(mapped.issuerOrganizationDisplayReference).toBe("ISS-202608-DK3");
  });

  it("keeps nulls for historical rows without allocated references", () => {
    const mapped = applyNoteSourceDisplayReferences(
      {
        sourceApplicationDisplayReference: "stale",
        sourceContractDisplayReference: "stale",
        sourceInvoiceDisplayReference: "stale",
        issuerOrganizationDisplayReference: "stale",
      } as never,
      {
        source_application_id: "app_old",
        source_contract_id: null,
        source_invoice_id: "inv_old",
        issuer_organization_id: "org_old",
      },
      {
        applicationById: new Map([["app_old", null]]),
        contractById: new Map(),
        invoiceById: new Map([["inv_old", null]]),
        issuerOrgById: new Map([["org_old", null]]),
      }
    );

    expect(mapped.sourceApplicationDisplayReference).toBeNull();
    expect(mapped.sourceContractDisplayReference).toBeNull();
    expect(mapped.sourceInvoiceDisplayReference).toBeNull();
    expect(mapped.issuerOrganizationDisplayReference).toBeNull();
  });
});
