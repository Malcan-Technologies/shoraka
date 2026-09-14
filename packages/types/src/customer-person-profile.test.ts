import { emptyPartyPlatformFields } from "./organization-party-profile";
import type { OrganizationPartyProfileDto } from "./organization-party-profile";
import type { ApplicationPersonRow } from "./application-people-display";
import {
  buildCustomerPersonOverviewSections,
  customerAccountEmail,
  customerAmlWaitingCopy,
  customerApprovedAt,
  customerHeaderFacts,
  customerIdentityNumber,
  customerIdentityType,
  customerKycCurrentStage,
  customerKycId,
  customerKybId,
  customerOverviewContainsCtos,
  customerPersonEmail,
  customerProcessStatusLabel,
  customerShareholding,
  formatCustomerProfileDate,
  isInternalOnboardingRequestId,
} from "./customer-person-profile";

function party(partial: Partial<OrganizationPartyProfileDto> = {}): OrganizationPartyProfileDto {
  return {
    id: "p1",
    partyKey: "021116101341",
    origin: "USER_ADDED",
    membershipStatus: "MASTER_ACTIVE",
    entityType: "INDIVIDUAL",
    absentFromLatestExternal: false,
    name: "Chng Yuen Zheng",
    email: "max.chng@truestack.my",
    salutation: "Mr",
    identityPrefix: "NRIC",
    identityNumber: "021116101341",
    dateOfBirth: "2026-09-10",
    dateOfIncorporation: null,
    gender: "MALE",
    nationality: "MALAYSIA",
    countryOfIncorporation: null,
    address: {
      line1: "Address (line 1)",
      line2: "Address (line 2)",
      state: "Selangor",
      postalCode: "47300",
    },
    isDirector: true,
    isShareholder: true,
    isBoard: false,
    isManagement: false,
    shareType: "ORDINARY",
    shareTypeOther: null,
    shareholdingUnits: "200",
    shareholdingAmount: "999000",
    shareholdingPercentage: "16",
    designation: null,
    designationOther: null,
    appointmentDate: null,
    resignationDate: null,
    fieldSources: {},
    externalObservation: null,
    mismatches: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...emptyPartyPlatformFields(),
    ...partial,
  };
}

function person(partial: Partial<ApplicationPersonRow> = {}): ApplicationPersonRow {
  return {
    matchKey: "021116101341",
    name: "Chng Yuen Zheng",
    entityType: "INDIVIDUAL",
    roles: ["DIRECTOR", "SHAREHOLDER"],
    sharePercentage: 16,
    status: "",
    email: "max.chng@truestack.my",
    onboarding: { status: "APPROVED", id: "KYC00185", updatedAt: "2026-09-10T00:00:00.000Z" },
    screening: { status: "CLEAR", id: "SCR-1" },
    requestId: "KYC00185",
    screeningRequestId: "KYC00185",
    ...partial,
  };
}

function fieldMap(sections: ReturnType<typeof buildCustomerPersonOverviewSections>): Map<string, string> {
  return new Map(sections.flatMap((section) => section.fields.map((field) => [field.label, field.value])));
}

describe("customer person Profile mapping", () => {
  it("maps identity type and number from the master party, not request IDs", () => {
    const row = person({
      onboarding: { status: "APPROVED", id: "EOD06934" },
      requestId: "EOD06934",
      screeningRequestId: "KYC00185",
      identityNumber: "021116101341",
    });
    expect(customerIdentityType(party())).toBe("NRIC");
    expect(customerIdentityNumber({ party: party(), person: row })).toBe("021116101341");
    expect(customerIdentityNumber({ party: party(), person: row })).not.toBe("KYC00185");
    expect(customerIdentityNumber({ party: party(), person: row })).not.toBe("EOD06934");
  });

  it("does not display EOD, COD, LD, KYC, or KYB identifiers as Identity Number", () => {
    expect(isInternalOnboardingRequestId("EOD06934")).toBe(true);
    expect(isInternalOnboardingRequestId("COD05594")).toBe(true);
    expect(isInternalOnboardingRequestId("LD1001")).toBe(true);
    expect(isInternalOnboardingRequestId("KYC00185")).toBe(true);
    expect(isInternalOnboardingRequestId("KYB2001")).toBe(true);
    expect(isInternalOnboardingRequestId("021116101341")).toBe(false);
    const fields = fieldMap(
      buildCustomerPersonOverviewSections({
        party: party({ identityNumber: "KYC00185", partyKey: "user:jamie" }),
        person: person({ onboarding: { status: "IN_PROGRESS", id: "KYC00185" }, matchKey: "user:jamie" }),
      })
    );
    expect(fields.get("Identity Number")).not.toBe("KYC00185");
    expect(fields.get("Identity Number")).toBe("Pending onboarding");
  });

  it("maps KYC ID only from a KYC* identifier and never from EOD/COD/LD", () => {
    expect(
      customerKycId(
        person({
          onboarding: { status: "APPROVED", id: "LD1001" },
          requestId: "LD1001",
          screeningRequestId: "KYC00185",
          directorEodRequestId: "EOD06934",
          parentCorporateRequestId: "COD05594",
        })
      )
    ).toBe("KYC00185");
    expect(
      customerKycId(
        person({
          onboarding: { status: "APPROVED", id: "EOD06934" },
          requestId: "EOD06934",
          screeningRequestId: null,
          directorEodRequestId: "EOD06934",
        })
      )
    ).toBeNull();
    expect(customerKycId(person({ entityType: "CORPORATE", roles: ["SHAREHOLDER"] }))).toBeNull();
  });

  it("maps KYB ID only from a KYB* identifier", () => {
    const corp = person({
      matchKey: "199501012345",
      entityType: "CORPORATE",
      roles: ["SHAREHOLDER"],
      onboarding: { status: "APPROVED", id: "COD2001" },
      requestId: "COD2001",
      partyCorporateRequestId: "COD2001",
      screeningRequestId: "KYB2001",
    });
    expect(customerKybId(corp)).toBe("KYB2001");
    expect(customerKycId(corp)).toBeNull();
    expect(
      customerKybId(
        person({
          entityType: "CORPORATE",
          roles: ["SHAREHOLDER"],
          onboarding: { status: "APPROVED", id: "COD2001" },
          requestId: "COD2001",
          screeningRequestId: null,
        })
      )
    ).toBeNull();
  });

  it("keeps Person Email on the party master and Account Email on linked User only", () => {
    const withUser = party({
      email: "max.chng@truestack.my",
      linkedUser: {
        userId: "u1",
        email: "login@example.com",
        firstName: "Chng",
        lastName: "Zheng",
      },
    });
    expect(customerPersonEmail({ party: withUser, person: person({ email: "other@example.com" }) })).toBe(
      "max.chng@truestack.my"
    );
    expect(customerAccountEmail(withUser)).toBe("login@example.com");
    expect(customerAccountEmail(party({ email: "max.chng@truestack.my", linkedUser: null }))).toBe("");
    expect(
      customerAccountEmail(
        party({
          email: "same@example.com",
          linkedUser: null,
          userId: null,
        })
      )
    ).toBe("");
  });

  it("maps shareholding from master percentage and formats amount with RM", () => {
    expect(customerShareholding({ party: party(), person: person({ sharePercentage: 99 }) })).toBe("16%");
    const fields = fieldMap(buildCustomerPersonOverviewSections({ party: party(), person: person() }));
    expect(fields.get("Shareholding")).toBe("16%");
    expect(fields.get("Shareholding Amount")).toBe("RM 999,000");
    expect(fields.get("Roles")).toBe("Director · Shareholder");
    expect(fields.get("Roles")).not.toContain("16%");
    expect(customerHeaderFacts({ party: party() })).toBe("Director · Shareholder");
  });

  it("uses human identity type and entity-specific date/nationality labels", () => {
    const fields = fieldMap(buildCustomerPersonOverviewSections({ party: party(), person: person() }));
    expect(fields.get("Identity Type")).toBe("NRIC");
    expect(fields.has("Identity Prefix")).toBe(false);
    expect(fields.get("Date of Birth")).toBe("10 Sep 2026");
    expect(fields.has("Date of Birth / Incorporation")).toBe(false);
    expect(fields.get("Nationality")).toBe("Malaysia");
    expect(fields.has("Nationality / Country")).toBe(false);
    expect(formatCustomerProfileDate("2026-09-10")).toBe("10 Sep 2026");
  });

  it("does not include CTOS evidence in customer Overview", () => {
    const sections = buildCustomerPersonOverviewSections({
      party: party({
        absentFromLatestExternal: true,
        mismatches: [
          { field: "name", masterValue: "A", externalValue: "B", source: "CTOS" },
        ],
      }),
      person: person(),
    });
    expect(customerOverviewContainsCtos(sections)).toBe(false);
    const blob = JSON.stringify(sections);
    expect(blob).not.toMatch(/CTOS/i);
    expect(blob).not.toContain("Matched");
    expect(blob).not.toContain("Differs");
    expect(blob).not.toContain("Observed");
  });

  it("omits individual identity fields for a corporate shareholder and uses KYB IDs", () => {
    const corpParty = party({
      entityType: "CORPORATE",
      name: "Acme Sdn Bhd",
      partyKey: "199501012345",
      identityPrefix: "ROC",
      identityNumber: "199501012345",
      salutation: "Mr",
      gender: "NOT_APPLICABLE",
      dateOfBirth: "1990-01-01",
      dateOfIncorporation: "2018-04-01",
      nationality: null,
      countryOfIncorporation: "MALAYSIA",
      isDirector: false,
      isBoard: false,
      isManagement: false,
      email: null,
    });
    const corpPerson = person({
      matchKey: "199501012345",
      name: "Acme Sdn Bhd",
      entityType: "CORPORATE",
      roles: ["SHAREHOLDER"],
      onboarding: { status: "APPROVED", id: "COD2001" },
      screeningRequestId: "KYB2001",
      partyCorporateRequestId: "COD2001",
    });
    const fields = fieldMap(buildCustomerPersonOverviewSections({ party: corpParty, person: corpPerson }));
    expect(fields.get("Company Name")).toBe("Acme Sdn Bhd");
    expect(fields.get("Entity Type")).toBe("Company");
    expect(fields.get("Company Registration Number")).toBe("199501012345");
    expect(fields.get("Identity Type")).toBe("ROC");
    expect(fields.get("Date of Incorporation")).toBe("1 Apr 2018");
    expect(fields.get("Country of Incorporation")).toBe("Malaysia");
    expect(fields.has("Salutation")).toBe(false);
    expect(fields.has("Gender")).toBe(false);
    expect(fields.has("Date of Birth")).toBe(false);
    expect(fields.has("Person Email")).toBe(false);
    expect(customerProcessStatusLabel({ kind: "kyb", person: corpPerson })).toBe("Approved");
    expect(customerKybId(corpPerson)).toBe("KYB2001");
    expect(customerKycId(corpPerson)).toBeNull();
  });

  it("does not duplicate KYC request/result IDs and hides raw approved stages", () => {
    const approved = person({
      onboarding: { status: "APPROVED", id: "KYC00185", updatedAt: "2026-09-10T00:00:00.000Z" },
      requestId: "KYC00185",
      screeningRequestId: "KYC00185",
    });
    expect(customerKycId(approved)).toBe("KYC00185");
    expect(customerProcessStatusLabel({ kind: "kyc", person: approved })).toBe("Approved");
    expect(customerKycCurrentStage({ person: approved, statusLabel: "Approved" })).toBeNull();
    expect(customerApprovedAt(approved)).toBe("10 Sep 2026");
    expect(
      customerApprovedAt(person({ onboarding: { status: "APPROVED", id: "KYC00185" } }))
    ).toBe("");
  });

  it("humanises in-progress KYC stage and AML waiting copy", () => {
    const inProgress = person({
      onboarding: { status: "ID_UPLOADED", id: "LD1001" },
      screening: null,
      screeningRequestId: null,
      requestId: "LD1001",
    });
    expect(customerProcessStatusLabel({ kind: "kyc", person: inProgress })).toBe("In progress");
    expect(customerKycCurrentStage({ person: inProgress, statusLabel: "In progress" })).toBe(
      "Identity documents submitted"
    );
    expect(
      customerAmlWaitingCopy({
        corporate: false,
        person: inProgress,
        amlLabel: customerProcessStatusLabel({ kind: "aml", person: inProgress }),
      })
    ).toBe("AML screening will begin after KYC approval.");
  });
});
