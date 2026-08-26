import * as fs from "fs";
import * as path from "path";

describe("admin excess late charge UI wiring", () => {
  it("shows the waiting banner and issuer-paid history on the settlement panel", () => {
    const panel = fs.readFileSync(
      path.join(__dirname, "../components/settlement-panel.tsx"),
      "utf8"
    );
    const adminPanel = fs.readFileSync(
      path.join(__dirname, "../components/excess-late-charge-admin-panel.tsx"),
      "utf8"
    );
    expect(panel).toContain("ExcessLateChargeAdminPanel");
    expect(adminPanel).toContain("ADMIN_WAITING_SURFACE_CLASS");
    expect(adminPanel).toContain('purpose: "EXCESS_LATE_CHARGES"');
    expect(adminPanel).toContain("noteId");
    expect(adminPanel).not.toContain("createExcessLateCharge");
  });

  it("exposes a dedicated late-charge gateway transaction limit", () => {
    const settings = fs.readFileSync(
      path.join(__dirname, "../../app/settings/platform-finance/page.tsx"),
      "utf8"
    );
    expect(settings).toContain("excessLateChargeGatewayTxnMaxAmount");
    expect(settings).toContain("Late charge payment gateway transaction limit");
    expect(settings).not.toContain("facilityFeeGatewayTxnMaxAmount ?? gatewayFees.excess");
  });
});
