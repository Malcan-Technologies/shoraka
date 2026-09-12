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
  it("maps invoice items to invoice.manage and documents to documents.manage", () => {
    expect(getApplicationItemManagePermission("invoice")).toBe("applications.invoice.manage");
    expect(getApplicationItemManagePermission("document")).toBe("applications.documents.manage");
    expect(getApplicationItemManagePermission("authorized_representatives")).toBe(
      "applications.documents.manage"
    );
  });

  it("gates item approve/reject/amend/reset on the item-type permission", () => {
    expect(CONTROLLER).toContain("requireApplicationItemManage");
    expect(CONTROLLER).toContain("getApplicationItemManagePermission");
    expect(CONTROLLER).not.toMatch(
      /reviews\/items\/approve[\s\S]{0,120}requirePermission\("applications\.manage"\)/
    );
  });
});

describe("pending amendment manage permissions", () => {
  it("maps section and item queued amendments to the matching manage permission", () => {
    expect(getApplicationSectionManagePermission("contract_details")).toBe(
      "applications.contract.manage"
    );
    expect(getApplicationSectionManagePermission("invoice_details")).toBe(
      "applications.invoice.manage"
    );
    expect(getPendingAmendmentCreatePermission({ scope: "section", scopeKey: "contract_details" })).toBe(
      "applications.contract.manage"
    );
    expect(
      getPendingAmendmentCreatePermission({ scope: "item", itemType: "invoice" })
    ).toBe("applications.invoice.manage");
    expect(
      getPendingAmendmentRoutePermission("item", "invoice_details:0:INV-1")
    ).toBe("applications.invoice.manage");
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
