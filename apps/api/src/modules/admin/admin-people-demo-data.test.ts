/**
 * Seed-focused checks for Admin People demo fixtures.
 * Does not change production people/KYC/AML/CTOS behavior.
 */
import { Prisma } from "@prisma/client";
import {
  isIssuerShareholderOnlyBelowMinimum,
  observedPartyBlockedByIdentityConflict,
  parsePersonIdentityConflict,
  peopleAccessKycLabel,
  type ApplicationPersonRow,
} from "@cashsouk/types";
import { computePartyMismatches } from "../organization-profile/serialize";
import {
  ADMIN_PEOPLE_DEMO_EMAIL,
  ADMIN_PEOPLE_DEMO_IC,
  ADMIN_PEOPLE_DEMO_INVITE,
  ADMIN_PEOPLE_DEMO_INVITE_EXPIRED_AT,
  ADMIN_PEOPLE_DEMO_INVITE_PENDING_EXPIRES,
  ADMIN_PEOPLE_DEMO_ISSUER_ORG_ID,
  ADMIN_PEOPLE_DEMO_INVESTOR_ORG_ID,
  ADMIN_PEOPLE_DEMO_NATHAN_ONBOARDING_KEY,
  ADMIN_PEOPLE_DEMO_PARTY_ID,
  ADMIN_PEOPLE_DEMO_PERSONAL_ORG_ID,
  ADMIN_PEOPLE_DEMO_REPORT,
  ADMIN_PEOPLE_DEMO_UNSUPPORTED,
  adminPeopleDemoHenryObservation,
  adminPeopleDemoNathanIdentityConflict,
  adminPeopleDemoOliviaIsBelowFivePercent,
  adminPeopleDemoWeiObservation,
} from "./admin-people-demo-data";

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

describe("admin people demo seed fixtures", () => {
  it("uses stable organisation ids", () => {
    expect(ADMIN_PEOPLE_DEMO_ISSUER_ORG_ID).toBe("seed_admin_people_test_issuer_org");
    expect(ADMIN_PEOPLE_DEMO_INVESTOR_ORG_ID).toBe("seed_admin_people_test_investor_org");
    expect(ADMIN_PEOPLE_DEMO_PERSONAL_ORG_ID).toBe("seed_admin_people_test_personal_org");
  });

  it("does not duplicate party, report, invitation, or email keys", () => {
    const partyIds = Object.values(ADMIN_PEOPLE_DEMO_PARTY_ID);
    expect(partyIds).toHaveLength(unique(partyIds).length);

    const ics = Object.values(ADMIN_PEOPLE_DEMO_IC);
    expect(ics).toHaveLength(unique(ics).length);

    const emails = Object.values(ADMIN_PEOPLE_DEMO_EMAIL);
    expect(emails).toHaveLength(unique(emails).length);

    const reports = Object.values(ADMIN_PEOPLE_DEMO_REPORT);
    expect(reports).toHaveLength(unique(reports).length);

    const tokens = Object.values(ADMIN_PEOPLE_DEMO_INVITE);
    expect(tokens).toHaveLength(unique(tokens).length);

    expect(ADMIN_PEOPLE_DEMO_NATHAN_ONBOARDING_KEY.startsWith("user:")).toBe(true);
  });

  it("keeps Person Email distinct from Account Email for Benjamin", () => {
    expect(ADMIN_PEOPLE_DEMO_EMAIL.benjaminPerson).not.toBe(ADMIN_PEOPLE_DEMO_EMAIL.benjaminAccount);
  });

  it("uses a future pending invite and a past expired invite", () => {
    const pending = new Date(ADMIN_PEOPLE_DEMO_INVITE_PENDING_EXPIRES).getTime();
    const expired = new Date(ADMIN_PEOPLE_DEMO_INVITE_EXPIRED_AT).getTime();
    const now = new Date("2026-09-11T00:00:00.000Z").getTime();
    expect(pending).toBeGreaterThan(now);
    expect(expired).toBeLessThan(now);
  });

  it("seeds Henry/Wei shareholding mismatches in the current observation shape", () => {
    const henry = computePartyMismatches({
      master: {
        name: "Henry Teo",
        identityNumber: ADMIN_PEOPLE_DEMO_IC.henry,
        entityType: "INDIVIDUAL",
        isDirector: true,
        isShareholder: true,
        shareholdingPercentage: new Prisma.Decimal("20"),
        appointmentDate: new Date("2018-06-15T00:00:00.000Z"),
        resignationDate: null,
      },
      observation: adminPeopleDemoHenryObservation(),
      sources: {},
    });
    expect(henry.find((row) => row.field === "shareholdingPercentage")?.externalValue).toBe(35);

    const wei = computePartyMismatches({
      master: {
        name: "Wei Ming",
        identityNumber: ADMIN_PEOPLE_DEMO_IC.wei,
        entityType: "INDIVIDUAL",
        isDirector: true,
        isShareholder: true,
        shareholdingPercentage: new Prisma.Decimal("18"),
        appointmentDate: new Date("2017-10-10T00:00:00.000Z"),
        resignationDate: null,
      },
      observation: adminPeopleDemoWeiObservation(),
      sources: {},
    });
    expect(wei.find((row) => row.field === "shareholdingPercentage")?.externalValue).toBe(30);
  });

  it("seeds Nathan identity conflict in the current BLOCKED shape", () => {
    const conflict = parsePersonIdentityConflict(adminPeopleDemoNathanIdentityConflict());
    expect(conflict?.status).toBe("BLOCKED");
    expect(conflict?.otherPartyId).toBe(ADMIN_PEOPLE_DEMO_PARTY_ID.nathanObserved);
    expect(conflict?.otherPartyKey).toBe(ADMIN_PEOPLE_DEMO_IC.nathanObserved);
    expect(
      observedPartyBlockedByIdentityConflict({
        observedPartyId: ADMIN_PEOPLE_DEMO_PARTY_ID.nathanObserved,
        observedPartyKey: ADMIN_PEOPLE_DEMO_IC.nathanObserved,
        parties: [
          {
            id: ADMIN_PEOPLE_DEMO_PARTY_ID.nathanOnboarding,
            membershipStatus: "MASTER_ACTIVE",
            externalObservation: { identityConflict: adminPeopleDemoNathanIdentityConflict() },
          },
        ],
      })
    ).toBe(true);
  });

  it("marks Olivia and Owen below the current 5% shareholder-only gate", () => {
    expect(adminPeopleDemoOliviaIsBelowFivePercent()).toBe(true);
    expect(
      isIssuerShareholderOnlyBelowMinimum({
        isShareholder: true,
        isDirector: false,
        shareholdingPercentage: 3,
      })
    ).toBe(true);
  });

  it("does not treat a corporate shareholder as individual KYC", () => {
    const person: ApplicationPersonRow = {
      matchKey: ADMIN_PEOPLE_DEMO_IC.legacyHoldings,
      name: "Legacy Holdings Sdn Bhd",
      entityType: "CORPORATE",
      roles: ["SHAREHOLDER"],
      sharePercentage: 20,
      status: "",
      screening: { status: "APPROVED" },
      onboarding: { status: "APPROVED", id: "COD90084" },
    };
    expect(peopleAccessKycLabel(person)).toBe("—");
  });

  it("documents Case 16 as unsupported rather than inventing a people_only row", () => {
    expect(ADMIN_PEOPLE_DEMO_UNSUPPORTED[0]?.caseId).toBe(16);
  });
});
