import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CustomerPartyProfileOverview } from "./customer-person-overview";
import {
  emptyPartyPlatformFields,
  issuerPersonCompletenessInputFromParty,
  issuerPersonCompletenessSummary,
  type OrganizationPartyProfileDto,
  type PartyAddressCompletenessInput,
  type ScIdentityPrefix,
} from "@cashsouk/types";

// Note: this test intentionally verifies the coupling between:
// - person completeness missingCount and missingItems labels (source of truth)
// - CustomerPartyProfileOverview's mapping that decides which labels are rendered as missing.

function splitPleaseFillUps(html: string): number {
  return html.split("Please fill up").length - 1;
}

describe("CustomerPartyProfileOverview missing fields mapping", () => {
  it("renders identity completeness missingCount for a personal company person (including Identity Prefix)", () => {
    const partyKey = "900101101234";

    const address: PartyAddressCompletenessInput = {
      line1: null,
      state: null,
      postalCode: null,
    };

    const party: OrganizationPartyProfileDto = {
      id: "p1",
      partyKey,
      origin: "USER_ADDED",
      membershipStatus: "MASTER_ACTIVE",
      entityType: "INDIVIDUAL",
      absentFromLatestExternal: false,
      name: "Ivan Chew Ken Yoong",
      email: null,
      salutation: null,
      identityPrefix: null,
      identityNumber: null,
      dateOfBirth: null,
      dateOfIncorporation: null,
      gender: null,
      nationality: null,
      countryOfIncorporation: null,
      address,
      isDirector: true,
      isShareholder: false,
      isBoard: false,
      isManagement: false,
      shareType: null,
      shareTypeOther: null,
      shareholdingUnits: null,
      shareholdingAmount: null,
      shareholdingPercentage: null,
      designation: null,
      designationOther: null,
      appointmentDate: null,
      resignationDate: null,
      fieldSources: {},
      externalObservation: null,
      mismatches: [],
      createdAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2020-01-01T00:00:00.000Z",
      ...emptyPartyPlatformFields(),
    };

    // Completeness is computed using the issuer-person completeness rules.
    const completenessInput = issuerPersonCompletenessInputFromParty({
      partyKey,
      name: party.name,
      entityType: party.entityType,
      isDirector: party.isDirector,
      isShareholder: party.isShareholder,
      isBoard: party.isBoard,
      isManagement: party.isManagement,
      identityPrefix: party.identityPrefix as ScIdentityPrefix | null,
      identityNumber: party.identityNumber,
      dateOfBirth: party.dateOfBirth,
      dateOfIncorporation: party.dateOfIncorporation,
      gender: party.gender,
      nationality: party.nationality,
      countryOfIncorporation: party.countryOfIncorporation,
      address: party.address,
      shareType: party.shareType,
      shareTypeOther: party.shareTypeOther,
      shareholdingUnits: party.shareholdingUnits,
      shareholdingAmount: party.shareholdingAmount,
      shareholdingPercentage: party.shareholdingPercentage,
      designation: party.designation,
      designationOther: party.designationOther,
      appointmentDate: party.appointmentDate,
      kycOnboardingStatus: null,
    });

    const summary = issuerPersonCompletenessSummary(completenessInput);

    // This scenario should have 8 missing required fields for the Overview.
    expect(summary.missingCount).toBe(8);

    const requiredMissingLabels = new Set(summary.missingItems.map((item) => item.label));
    const html = renderToStaticMarkup(
      <CustomerPartyProfileOverview
        party={party}
        variant="profile"
        requiredMissingLabels={requiredMissingLabels}
      />
    );

    const renderedPleaseFillUps = splitPleaseFillUps(html);
    expect(renderedPleaseFillUps).toBe(summary.missingCount);

    // The hidden completeness field is identityPrefix; it's surfaced via the UI's "Identity Type" field.
    expect(html).toContain("Identity Type");
    expect(html).toContain("Please fill up");
    expect(html).not.toContain("Identity Prefix");
  });
});

