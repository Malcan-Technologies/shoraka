import { getApplicationItemManagePermission } from "./review-item-permission";
import * as fs from "fs";
import * as path from "path";

const CONTROLLER = fs.readFileSync(path.join(__dirname, "controller.ts"), "utf8");

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

describe("getApplicationItemManagePermission", () => {
  it("maps invoice items to invoice.manage and documents to documents.manage", () => {
    expect(getApplicationItemManagePermission("invoice")).toBe("applications.invoice.manage");
    expect(getApplicationItemManagePermission("document")).toBe("applications.documents.manage");
    expect(getApplicationItemManagePermission("authorized_representatives")).toBe(
      "applications.documents.manage"
    );
  });
});
