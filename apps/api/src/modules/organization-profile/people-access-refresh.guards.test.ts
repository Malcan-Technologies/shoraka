import { readFileSync } from "fs";
import { join } from "path";

describe("People & Access party refresh must not change frozen CTOS/onboarding flows", () => {
  it("does not import or call the CTOS parser", () => {
    const refresh = readFileSync(join(__dirname, "refresh-party-regtank-status.ts"), "utf8");
    expect(refresh).not.toContain("parseCtosReportXml");
    expect(refresh).not.toContain("ctos/parser");
    expect(refresh).not.toContain("equity_percentage");
    expect(refresh).not.toContain("company_json");
    expect(refresh).not.toContain("seedMasterPartiesIfEmpty");
    expect(refresh).not.toContain("adoptObservedParty");
    expect(refresh).not.toContain("refreshOrganizationAML");
    expect(refresh).not.toContain("parentCorporateRequestId");
  });

  it("leaves the CTOS parser file untouched by this feature", () => {
    const parser = readFileSync(join(__dirname, "../ctos/parser.ts"), "utf8");
    expect(parser).toContain("export async function parseCtosReportXml");
    expect(parser).toContain("equity_percentage");
  });

  it("leaves adopt / do-not-adopt routes on the profile controller", () => {
    const controller = readFileSync(join(__dirname, "controller.ts"), "utf8");
    expect(controller).toContain("/:portal/:id/party-profiles/:partyId/adopt");
    expect(controller).toContain("adoptObservedParty");
    expect(controller).toContain("createUserAddedParty");
  });

  it("does not add People & Access refresh to PERSONAL investor profile", () => {
    const investorProfile = readFileSync(
      join(__dirname, "../../../../investor/src/app/profile/page.tsx"),
      "utf8"
    );
    expect(investorProfile).toContain("{!isPersonal ? (");
    expect(investorProfile).toContain("PeopleAccessSection");
  });
});
