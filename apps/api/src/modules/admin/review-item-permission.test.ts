import {
  getApplicationItemManagePermission,
  getApplicationSectionManagePermission,
  getPendingAmendmentCreatePermission,
  getPendingAmendmentRoutePermission,
} from "./review-item-permission";
import * as fs from "fs";
import * as path from "path";

const CONTROLLER = fs.readFileSync(path.join(__dirname, "controller.ts"), "utf8");
const REPOSITORY = fs.readFileSync(path.join(__dirname, "repository.ts"), "utf8");

describe("getApplicationItemManagePermission", () => {
  it("maps Offer & Acceptance items to offer_acceptance.manage", () => {
    expect(getApplicationItemManagePermission("invoice")).toBe(
      "applications.offer_acceptance.manage"
    );
    expect(getApplicationItemManagePermission("authorized_representatives")).toBe(
      "applications.offer_acceptance.manage"
    );
    expect(
      getApplicationItemManagePermission("document", "acceptance_documents:0:Board resolution")
    ).toBe("applications.offer_acceptance.manage");
  });

  it("keeps Supporting Documents items on documents.manage", () => {
    expect(getApplicationItemManagePermission("document")).toBe("applications.documents.manage");
    expect(
      getApplicationItemManagePermission("document", "supporting_documents:financial:0:Statement")
    ).toBe("applications.documents.manage");
  });

  it("gates item approve/reject/amend/reset on the item permission using the item id", () => {
    expect(CONTROLLER).toContain("requireApplicationItemManage");
    expect(CONTROLLER).toContain("getApplicationItemManagePermission(itemType, itemId)");
    expect(CONTROLLER).not.toMatch(
      /reviews\/items\/approve[\s\S]{0,120}requirePermission\("applications\.manage"\)/
    );
  });
});

describe("getApplicationSectionManagePermission", () => {
  it.each(["contract_details", "invoice_details", "acceptance_documents"])(
    "maps the merged Offer & Acceptance section %s to offer_acceptance.manage",
    (section) => {
      expect(getApplicationSectionManagePermission(section)).toBe(
        "applications.offer_acceptance.manage"
      );
    }
  );

  it("keeps the other review sections on their own permission", () => {
    expect(getApplicationSectionManagePermission("supporting_documents")).toBe(
      "applications.documents.manage"
    );
    expect(getApplicationSectionManagePermission("financial")).toBe(
      "applications.financial.manage"
    );
    expect(getApplicationSectionManagePermission("business_details")).toBe(
      "applications.business_guarantor.manage"
    );
    expect(getApplicationSectionManagePermission("company_details")).toBe(
      "applications.company.manage"
    );
  });
});

describe("Offer & Acceptance offer routes", () => {
  it("guards contract/invoice offer routes with offer_acceptance.manage", () => {
    for (const route of [
      "/applications/:id/offers/contracts/send",
      "/applications/:id/offers/contracts/extend-signing-deadline",
      "/applications/:id/offers/invoices/:invoiceId/send",
      "/applications/:id/offers/invoices/:invoiceId/extend-signing-deadline",
    ]) {
      const idx = CONTROLLER.indexOf(`"${route}"`);
      expect(idx).toBeGreaterThan(-1);
      expect(CONTROLLER.slice(idx, idx + 160)).toContain(
        'requirePermission("applications.offer_acceptance.manage")'
      );
    }
  });
});

describe("pending amendment manage permissions", () => {
  it("maps section and item queued amendments to the matching manage permission", () => {
    expect(getApplicationSectionManagePermission("contract_details")).toBe(
      "applications.offer_acceptance.manage"
    );
    expect(getApplicationSectionManagePermission("invoice_details")).toBe(
      "applications.offer_acceptance.manage"
    );
    expect(getPendingAmendmentCreatePermission({ scope: "section", scopeKey: "contract_details" })).toBe(
      "applications.offer_acceptance.manage"
    );
    expect(
      getPendingAmendmentCreatePermission({ scope: "item", itemType: "invoice" })
    ).toBe("applications.offer_acceptance.manage");
    expect(
      getPendingAmendmentCreatePermission({
        scope: "item",
        itemType: "document",
        itemId: "acceptance_documents:0:Board resolution",
      })
    ).toBe("applications.offer_acceptance.manage");
    expect(
      getPendingAmendmentCreatePermission({
        scope: "item",
        itemType: "document",
        itemId: "supporting_documents:financial:0:Statement",
      })
    ).toBe("applications.documents.manage");
    expect(
      getPendingAmendmentRoutePermission("item", "invoice_details:0:INV-1")
    ).toBe("applications.offer_acceptance.manage");
    expect(
      getPendingAmendmentRoutePermission("item", "acceptance_documents:0:Board resolution")
    ).toBe("applications.offer_acceptance.manage");
    expect(
      getPendingAmendmentRoutePermission("item", "supporting_documents:financial:0:Statement")
    ).toBe("applications.documents.manage");
  });

  it("resolves item amendment create from itemId, the key the handler stores", () => {
    // Admin "Request amendment" on an item sends { scope: "item", itemType, itemId } only.
    expect(CONTROLLER).toContain("itemId: parsed.data.itemId,");
    expect(CONTROLLER).not.toContain("parsed.data.scopeKey ?? parsed.data.itemId");
    expect(
      getPendingAmendmentCreatePermission({
        scope: "item",
        itemType: "document",
        itemId: "acceptance_documents:0:Board resolution",
      })
    ).toBe("applications.offer_acceptance.manage");
  });

  describe("item scopeKey cannot override itemId", () => {
    // Body that claims a Supporting Documents scopeKey but targets an acceptance document itemId.
    const spoofed = {
      scope: "item" as const,
      itemType: "document" as const,
      scopeKey: "supporting_documents:financial:0:Statement",
      itemId: "acceptance_documents:0:Board resolution",
    };
    const allowed = (granted: string[]) => {
      const required = getPendingAmendmentCreatePermission(spoofed);
      return required != null && granted.includes(required);
    };

    it("requires offer_acceptance.manage for the acceptance document itemId", () => {
      expect(getPendingAmendmentCreatePermission(spoofed)).toBe(
        "applications.offer_acceptance.manage"
      );
    });

    it("denies a documents.manage-only admin", () => {
      expect(allowed(["applications.view", "applications.documents.manage"])).toBe(false);
    });

    it("allows an offer_acceptance.manage admin", () => {
      expect(allowed(["applications.view", "applications.offer_acceptance.manage"])).toBe(true);
    });

    it("keeps supporting_documents itemIds on documents.manage even with another scopeKey", () => {
      expect(
        getPendingAmendmentCreatePermission({
          scope: "item",
          itemType: "document",
          scopeKey: "acceptance_documents:0:Board resolution",
          itemId: "supporting_documents:financial:0:Statement",
        })
      ).toBe("applications.documents.manage");
    });
  });

  it("gates queued amendment create/update/delete on section or item manage, not applications.manage", () => {
    expect(CONTROLLER).toContain("requirePendingAmendmentCreate");
    expect(CONTROLLER).toContain("requirePendingAmendmentRoute");
    expect(CONTROLLER).not.toMatch(
      /reviews\/pending-amendments",\s*requirePermission\("applications\.manage"\)/
    );
  });

  it("loads sibling invoice application financing type so other-app product ids can be stamped", () => {
    expect(REPOSITORY).toContain("select: { financing_type: true }");
  });
});
