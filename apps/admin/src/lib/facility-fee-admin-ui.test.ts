import * as fs from "fs";
import * as path from "path";

describe("admin facility fee gateway UI wiring", () => {
  it("sends the snapshotted upfront amount on the facility offer request", () => {
    const section = fs.readFileSync(
      path.join(__dirname, "../components/application-review/sections/contract-section.tsx"),
      "utf8"
    );
    const hook = fs.readFileSync(
      path.join(__dirname, "../hooks/use-application-review-actions.ts"),
      "utf8"
    );
    const client = fs.readFileSync(
      path.join(__dirname, "../../../../packages/config/src/api-client.ts"),
      "utf8"
    );
    expect(section).toContain("facilityFeeUpfrontCollectAmount");
    expect(section).toContain("buildSendContractOfferPayload");
    expect(section).toContain("Upfront via payment gateway");
    expect(section).toContain("Remaining for drawdown collections");
    expect(hook).toContain("facilityFeeUpfrontCollectAmount ?? 0");
    expect(client).toContain("facilityFeeUpfrontCollectAmount: facilityFeeUpfrontCollectAmount ?? 0");
  });

  it("shows facility-fee history from the admin list filtered by contract", () => {
    const panel = fs.readFileSync(
      path.join(__dirname, "../contracts/components/contract-facility-fee-panel.tsx"),
      "utf8"
    );
    expect(panel).toContain('purpose: "FACILITY_FEE"');
    expect(panel).toContain("contractId");
    expect(panel).toContain("No facility fee gateway payments yet.");
    expect(panel).toContain("Could not load facility fee payments.");
    expect(panel).toContain("/finance/gateway-payments/");
    expect(panel).not.toContain("createFacilityFee");
    expect(panel).not.toContain("Initiate facility fee");
  });

  it("exposes the facility fee gateway transaction limit on platform finance settings", () => {
    const settings = fs.readFileSync(
      path.join(__dirname, "../app/settings/platform-finance/page.tsx"),
      "utf8"
    );
    expect(settings).toContain("facilityFeeGatewayTxnMaxAmount");
    expect(settings).toContain("Facility fee payment gateway transaction limit");
    expect(settings).toContain("Caps each FPX facility-fee transaction");
  });

  it("keeps the Facility Fee purpose label and filter", () => {
    const table = fs.readFileSync(
      path.join(__dirname, "../components/gateway-payments-table.tsx"),
      "utf8"
    );
    const labels = fs.readFileSync(path.join(__dirname, "./gateway-payment-display.ts"), "utf8");
    expect(labels).toContain('FACILITY_FEE: "Facility Fee"');
    expect(table).toContain('{ value: "FACILITY_FEE", label: PURPOSE_LABEL.FACILITY_FEE }');
    expect(table).toContain("View facility");
  });
});
