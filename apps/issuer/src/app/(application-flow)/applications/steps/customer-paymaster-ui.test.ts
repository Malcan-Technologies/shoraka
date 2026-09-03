import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("issuer Customer / Paymaster UI", () => {
  const step = readFileSync(join(__dirname, "contract-details-step.tsx"), "utf8");
  const flow = readFileSync(join(__dirname, "customer-paymaster-flow.ts"), "utf8");

  it("keeps a single SSM-first form without previous-paymaster convenience controls", () => {
    expect(step).toContain("Customer / Paymaster");
    expect(step).toContain("SSM / Registration Number");
    expect(step).toContain("Customer Name");
    expect(step).toContain("Customer Entity Type");
    expect(step).toContain("Customer Country");
    expect(step).toContain("Is the Customer Related to You?");
    expect(step).toContain("useIssuerPaymasterLookup");
    expect(step).toContain("Looking up this registration number");
    expect(step).not.toMatch(/Select Existing/);
    expect(step).not.toMatch(/Add New/);
    expect(step).not.toMatch(/Use This Paymaster/);
    expect(step).not.toMatch(/Change Registration Number/);
    expect(step).not.toMatch(/Previously Used/);
    expect(step).not.toMatch(/applyPreviousPaymaster/);
    expect(step).not.toMatch(/useIssuerPaymasters/);
    expect(step).not.toMatch(/existingPaymasters/);
    expect(step).not.toMatch(/\bSearch\b.*[Bb]utton|Check this registration/);
    expect(step).not.toMatch(/Verified Paymaster/);
  });

  it("locks verified identity fields while leaving related party editable", () => {
    expect(step).toContain("masterFieldsDisabled");
    expect(step).toContain("customerIdentityLocked");
    expect(step).toContain("VerifiedBadge");
    const relatedPartyCall = step.slice(step.lastIndexOf("<YesNoRadioGroup"));
    expect(relatedPartyCall).toContain("disabled={!stepIsEditable}");
    expect(relatedPartyCall).not.toContain("masterFieldsDisabled");
    expect(flow).toContain('lookupStatus === "FOUND_VERIFIED"');
  });

  it("does not populate or expose another issuer's unverified identity", () => {
    expect(flow).toContain('return "NOT_FOUND"');
    expect(step).toMatch(/status === "FOUND_VERIFIED" && result\.paymaster/);
    expect(step).not.toMatch(/FOUND_UNVERIFIED" && result\.paymaster/);
    expect(step).not.toMatch(/submittedApplicationIdentities/);
    expect(step).not.toMatch(/collectLinkedPaymasterApplications/);
    expect(step).not.toMatch(/PaymasterMismatch/);
  });
});
