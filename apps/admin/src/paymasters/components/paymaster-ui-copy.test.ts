import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Admin Paymaster UI copy after mismatch removal", () => {
  it("Registry has Verified/Unverified filters and no review-required mismatch state", () => {
    const source = readFileSync(join(__dirname, "../../app/paymasters/page.tsx"), "utf8");
    expect(source).toMatch(/label:\s*"Verified"/);
    expect(source).toMatch(/label:\s*"Unverified"/);
    expect(source).not.toMatch(/Review required/i);
    expect(source).not.toMatch(/mismatchPending|mismatch_pending/);
  });

  it("Registry table keeps verification and drops mismatch columns", () => {
    const source = readFileSync(join(__dirname, "paymasters-table.tsx"), "utf8");
    expect(source).toContain("Verification");
    expect(source).not.toMatch(/Review required/i);
    expect(source).not.toMatch(/mismatch/i);
  });

  it("Paymaster Detail keeps verification status/by/at and has no mismatch section", () => {
    const detail = readFileSync(join(__dirname, "paymaster-detail-view.tsx"), "utf8");
    const panel = readFileSync(join(__dirname, "paymaster-verification-panel.tsx"), "utf8");
    expect(detail).toContain("PaymasterVerificationPanel");
    expect(detail).toContain("Internal Paymaster identity review");
    expect(detail).not.toMatch(/Keep existing identity/i);
    expect(detail).not.toMatch(/Data review/i);
    expect(panel).toContain("Verified by");
    expect(panel).toContain("Verified at");
    expect(panel).toContain("Verify Paymaster");
    expect(panel).not.toMatch(/Customer details differ/i);
    expect(panel).not.toMatch(/Review Paymaster/);
    expect(panel).not.toMatch(/mismatch/i);
  });

  it("Application Review retains Verify Paymaster without mismatch warning", () => {
    const customer = readFileSync(
      join(__dirname, "../../components/application-review/sections/customer-section.tsx"),
      "utf8"
    );
    const contract = readFileSync(
      join(__dirname, "../../components/application-review/sections/contract-section.tsx"),
      "utf8"
    );
    const panel = readFileSync(join(__dirname, "paymaster-verification-panel.tsx"), "utf8");
    expect(customer).toContain("Paymaster Verification");
    expect(contract).toContain("Paymaster Verification");
    expect(customer).not.toMatch(/showMismatchBanner/);
    expect(contract).not.toMatch(/showMismatchBanner/);
    expect(panel).toContain("Verify Paymaster");
    expect(panel).toContain("applicationId");
  });
});
