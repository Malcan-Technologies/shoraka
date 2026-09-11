import { emptyPartyPlatformFields } from "./organization-party-profile";
import type { OrganizationPartyProfileDto } from "./organization-party-profile";
import type { ApplicationPersonRow } from "./application-people-display";
import { getRegtankOnboardingViewLinks } from "./application-people-display";
import type { AdminPeopleAccessRow } from "./admin-people-access-rows";
import {
  adminAmlWaitingCopy,
  adminOnboardingStageLabel,
  adminPartyProfileStatusLabel,
  adminPartyRecordSourceLabel,
  adminPeopleAccessDetailRoleLine,
  adminPersonCtosAbsenceCopy,
  adminPersonHasCtosEvidence,
  adminPersonHasRegTankEvidence,
  adminPersonKycResultUrl,
  adminPersonKybResultUrl,
  adminProfileCompletenessHint,
  buildAdminPeopleAccessOverviewItems,
  buildAdminPersonRegTankRoleRecords,
  isCustomerRegTankVerifyUrl,
  personRegTankKycId,
  personRegTankKybId,
  roleOnboardingStatusFromCorporateEntities,
} from "./admin-people-access-detail";
import { PERSON_KYC_REQUIRED_BEFORE_PROFILE_COMPLETION } from "./person-onboarding-display";

function party(
  overrides: Partial<OrganizationPartyProfileDto> & Pick<OrganizationPartyProfileDto, "id" | "partyKey">
): OrganizationPartyProfileDto {
  return {
    origin: "REGTANK_PARTY",
    membershipStatus: "MASTER_ACTIVE",
    entityType: "INDIVIDUAL",
    absentFromLatestExternal: false,
    name: "Chng Yuen Zheng",
    email: "max.chng@truestack.my",
    salutation: null,
    identityPrefix: "NRIC",
    identityNumber: "021116101341",
    dateOfBirth: null,
    dateOfIncorporation: null,
    gender: null,
    nationality: null,
    countryOfIncorporation: null,
    address: null,
    isDirector: true,
    isShareholder: true,
    isBoard: false,
    isManagement: false,
    shareType: null,
    shareTypeOther: null,
    shareholdingUnits: null,
    shareholdingAmount: null,
    shareholdingPercentage: "16",
    designation: null,
    designationOther: null,
    appointmentDate: null,
    resignationDate: null,
    fieldSources: {},
    externalObservation: null,
    mismatches: [],
    createdAt: "2026-09-10T00:00:00.000Z",
    updatedAt: "2026-09-10T00:00:00.000Z",
    ...emptyPartyPlatformFields(),
    ...overrides,
  };
}

function person(overrides: Partial<ApplicationPersonRow> & Pick<ApplicationPersonRow, "matchKey">): ApplicationPersonRow {
  return {
    name: "Chng Yuen Zheng",
    entityType: "INDIVIDUAL",
    roles: ["DIRECTOR", "SHAREHOLDER"],
    sharePercentage: 16,
    status: "",
    email: "max.chng@truestack.my",
    ...overrides,
  };
}

function row(overrides: Partial<AdminPeopleAccessRow> = {}): AdminPeopleAccessRow {
  const p = party({ id: "p1", partyKey: "021116101341" });
  const pe = person({
    matchKey: "021116101341",
    onboarding: { status: "ID_UPLOADED", id: null },
    directorEodRequestId: "EOD06934",
    shareholderEodRequestId: "EOD06933",
    parentCorporateRequestId: "COD05594",
  });
  return {
    key: "party:p1",
    kind: "company_person",
    name: "Chng Yuen Zheng",
    companyRoles: ["Director", "Shareholder"],
    companyRoleLine: "Director, Shareholder",
    platformAccess: "No access",
    kyc: "In progress",
    aml: "Not started",
    ctos: "—",
    corporate: false,
    observed: false,
    inactive: false,
    identityConflict: false,
    partyId: p.id,
    partyKey: p.partyKey,
    userId: null,
    invitationId: null,
    invitationExpiresAt: null,
    personEmail: p.email,
    accountEmail: null,
    person: pe,
    party: p,
    member: null,
    ...overrides,
  };
}

describe("admin onboarding stage labels", () => {
  it("maps ID_UPLOADED to identity documents submitted, not the raw token", () => {
    expect(adminOnboardingStageLabel("ID_UPLOADED")).toBe("Identity documents submitted");
    expect(adminOnboardingStageLabel("WAIT_FOR_APPROVAL")).toBe("Pending approval");
    expect(adminOnboardingStageLabel("APPROVED")).toBe("Approved");
    expect(adminOnboardingStageLabel("URL_GENERATED")).toBe("Invitation sent");
    expect(adminOnboardingStageLabel("NOT_STARTED")).toBe("Not started");
    expect(adminOnboardingStageLabel("REJECTED")).toBe("Rejected");
    expect(adminOnboardingStageLabel("EXPIRED")).toBe("Expired");
  });
});

describe("record source and profile status", () => {
  it("does not expose REGTANK_PARTY as the Admin label", () => {
    expect(adminPartyRecordSourceLabel("REGTANK_PARTY")).toBe("Created from RegTank onboarding");
    expect(adminPartyRecordSourceLabel("REGTANK_PARTY")).not.toContain("REGTANK_PARTY");
    expect(adminPartyRecordSourceLabel("CTOS_PARTY")).toBe("Created from CTOS information");
    expect(adminPartyRecordSourceLabel("USER_ADDED")).toBe("Added on the company profile");
  });

  it("uses human profile status labels", () => {
    expect(adminPartyProfileStatusLabel(row())).toBe("Active profile");
    expect(adminPartyProfileStatusLabel(row({ inactive: true }))).toBe("Inactive");
    expect(adminPartyProfileStatusLabel(row({ observed: true }))).toBe("Observed from CTOS");
    expect(adminPartyProfileStatusLabel(row({ kind: "platform_only" }))).toBe("Platform access only");
  });
});

describe("Chng Yuen Zheng dual-role projection", () => {
  it("keeps one person row with two EOD references", () => {
    const current = row();
    expect(current.person?.directorEodRequestId).toBe("EOD06934");
    expect(current.person?.shareholderEodRequestId).toBe("EOD06933");
    expect(adminPeopleAccessDetailRoleLine(current)).toBe("Director · Shareholder · 16%");
    const records = buildAdminPersonRegTankRoleRecords({
      person: current.person,
      corporateEntities: {
        directors: [{ eodRequestId: "EOD06934", status: "ID_UPLOADED" }],
        shareholders: [{ eodRequestId: "EOD06933", status: "ID_UPLOADED" }],
      },
    });
    expect(records).toEqual([
      expect.objectContaining({
        kind: "director",
        title: "Director",
        requestId: "EOD06934",
        stageLabel: "Identity documents submitted",
        url: "https://shoraka-trial.regtank.com/app/onboardingCorporate/COD05594/EOD06934",
        actionLabel: "View Director onboarding",
      }),
      expect.objectContaining({
        kind: "shareholder",
        title: "Shareholder · 16%",
        requestId: "EOD06933",
        stageLabel: "Identity documents submitted",
        url: "https://shoraka-trial.regtank.com/app/onboardingCorporate/COD05594/EOD06933",
        actionLabel: "View Shareholder onboarding",
      }),
    ]);
  });

  it("does not invent a KYC ID or KYC result link before approval", () => {
    const current = row();
    expect(personRegTankKycId(current.person)).toBeNull();
    expect(adminPersonKycResultUrl(current.person)).toBeNull();
  });

  it("links KYC result only when a KYC id exists", () => {
    const approved = person({
      matchKey: "021116101341",
      onboarding: { status: "APPROVED", id: "KYC00184" },
      screeningRequestId: "KYC00184",
      directorEodRequestId: "EOD06934",
      parentCorporateRequestId: "COD05594",
    });
    expect(personRegTankKycId(approved)).toBe("KYC00184");
    expect(adminPersonKycResultUrl(approved)).toBe(
      "https://shoraka-trial.regtank.com/app/screen-kyc/result/KYC00184"
    );
  });

  it("explains AML not started after identity submit", () => {
    expect(
      adminAmlWaitingCopy({ corporate: false, person: row().person, amlLabel: "Not started" })
    ).toBe("AML review becomes available after KYC approval.");
  });

  it("hides CTOS when no comparison exists and distinguishes Not found", () => {
    const none = row();
    expect(adminPersonHasCtosEvidence(none)).toBe(false);
    expect(adminPersonCtosAbsenceCopy(none)).toBe("No CTOS record has been linked to this person yet.");
    const notFound = row({
      ctos: "Not found",
      party: party({ id: "p1", partyKey: "021116101341", absentFromLatestExternal: true }),
    });
    expect(adminPersonHasCtosEvidence(notFound)).toBe(true);
    expect(adminPersonCtosAbsenceCopy(notFound)).toBeNull();
  });

  it("shows CTOS matched and differs as evidence", () => {
    expect(
      adminPersonHasCtosEvidence(
        row({
          ctos: "Matched",
          party: party({
            id: "p1",
            partyKey: "021116101341",
            externalObservation: { name: "Chng" },
          }),
        })
      )
    ).toBe(true);
    expect(
      adminPersonHasCtosEvidence(
        row({
          ctos: "Differs",
          party: party({
            id: "p1",
            partyKey: "021116101341",
            mismatches: [{ field: "name", masterValue: "A", externalValue: "B", source: "CTOS" }],
          }),
        })
      )
    ).toBe(true);
  });
});

describe("overview items", () => {
  it("shows master profile fields without raw origin enums", () => {
    const items = buildAdminPeopleAccessOverviewItems(row());
    expect(items.find((item) => item.label === "Full Name")?.value).toBe("Chng Yuen Zheng");
    expect(items.find((item) => item.label === "Entity Type")?.value).toBe("Individual");
    expect(items.find((item) => item.label === "Company Roles")?.value).toBe("Director · Shareholder");
    expect(items.find((item) => item.label === "Shareholding")?.value).toBe("16%");
    expect(items.find((item) => item.label === "Identity Number")?.value).toBe("021116101341");
    expect(items.find((item) => item.label === "Identity Type")?.value).toBe("NRIC");
    expect(items.find((item) => item.label === "Person Email")?.value).toBe("max.chng@truestack.my");
    expect(items.find((item) => item.label === "Platform Access")?.value).toBe("No access");
    expect(items.find((item) => item.label === "Profile Status")?.value).toBe("Active profile");
    expect(items.map((item) => item.value).join(" ")).not.toContain("REGTANK_PARTY");
    expect(items.map((item) => item.label)).not.toContain("Origin");
  });

  it("keeps Person Email separate from Account Email", () => {
    const items = buildAdminPeopleAccessOverviewItems(
      row({
        accountEmail: "login@example.com",
        party: party({
          id: "p1",
          partyKey: "021116101341",
          userId: "U1",
          linkedUser: { userId: "U1", email: "login@example.com", firstName: "Chng", lastName: "Yuen Zheng" },
        }),
      })
    );
    expect(items.find((item) => item.label === "Person Email")?.value).toBe("max.chng@truestack.my");
    expect(items.find((item) => item.label === "Platform Access")?.value).not.toBe("login@example.com");
  });

  it("uses company language for a corporate shareholder", () => {
    const corpPerson = person({
      matchKey: "8217649D",
      name: "Orion Crest Holdings Sdn. Bhd.",
      entityType: "CORPORATE",
      roles: ["SHAREHOLDER"],
      sharePercentage: 50,
      onboarding: { status: "WAIT_FOR_APPROVAL", id: null },
      partyCorporateRequestId: "COD05595",
      parentCorporateRequestId: "COD05594",
    });
    const items = buildAdminPeopleAccessOverviewItems(
      row({
        name: "Orion Crest Holdings Sdn. Bhd.",
        corporate: true,
        companyRoles: ["Shareholder"],
        companyRoleLine: "Shareholder",
        kyc: "Pending approval",
        aml: "—",
        personEmail: null,
        person: corpPerson,
        party: party({
          id: "c1",
          partyKey: "8217649D",
          name: "Orion Crest Holdings Sdn. Bhd.",
          entityType: "CORPORATE",
          isDirector: false,
          isShareholder: true,
          identityPrefix: "ROC",
          identityNumber: "8217649D",
          email: null,
          shareholdingPercentage: "50",
        }),
      })
    );
    expect(items.find((item) => item.label === "Entity Type")?.value).toBe("Company");
    expect(items.find((item) => item.label === "Company Registration Number")?.value).toBe("8217649D");
    expect(items.find((item) => item.label === "Platform Access")?.value).toBe("Not applicable");
    expect(items.find((item) => item.label === "Shareholding")?.value).toBe("50%");
    expect(items.map((item) => item.label)).not.toContain("Person Email");
  });
});

describe("RegTank role records and links", () => {
  it("builds Vertex-shaped corporate director and shareholder paths", () => {
    const links = getRegtankOnboardingViewLinks({
      entityType: "INDIVIDUAL",
      parentCorporateRequestId: "COD05594",
      directorEodRequestId: "EOD06934",
      shareholderEodRequestId: "EOD06933",
      partyCorporateRequestId: null,
    });
    expect(links.map((link) => link.url)).toEqual([
      "https://shoraka-trial.regtank.com/app/onboardingCorporate/COD05594/EOD06934",
      "https://shoraka-trial.regtank.com/app/onboardingCorporate/COD05594/EOD06933",
    ]);
  });

  it("uses a corporate shareholder's own COD", () => {
    const records = buildAdminPersonRegTankRoleRecords({
      person: person({
        matchKey: "8217649D",
        entityType: "CORPORATE",
        roles: ["SHAREHOLDER"],
        sharePercentage: 50,
        partyCorporateRequestId: "COD05595",
        parentCorporateRequestId: "COD05594",
        onboarding: { status: "WAIT_FOR_APPROVAL" },
      }),
    });
    expect(records).toEqual([
      expect.objectContaining({
        requestId: "COD05595",
        url: "https://shoraka-trial.regtank.com/app/onboardingCorporate/COD05595?archived=false",
        actionLabel: "View corporate shareholder onboarding",
      }),
    ]);
  });

  it("omits a broken EOD link when parent COD is missing", () => {
    const records = buildAdminPersonRegTankRoleRecords({
      person: person({
        matchKey: "021116101341",
        directorEodRequestId: "EOD06934",
        parentCorporateRequestId: null,
      }),
    });
    expect(records[0]?.requestId).toBe("EOD06934");
    expect(records[0]?.url).toBeNull();
    const links = getRegtankOnboardingViewLinks({
      entityType: "INDIVIDUAL",
      parentCorporateRequestId: null,
      directorEodRequestId: "EOD06934",
      shareholderEodRequestId: null,
      partyCorporateRequestId: null,
    });
    expect(links).toEqual([{ label: "Director", url: null, requestId: "EOD06934" }]);
  });

  it("does not treat a customer verify URL as an Admin deep link", () => {
    expect(
      isCustomerRegTankVerifyUrl(
        "https://shoraka-trial-onboarding.regtank.com/Onboarding2Company/step1?requestId=COD05594"
      )
    ).toBe(true);
    expect(
      isCustomerRegTankVerifyUrl("https://shoraka-trial.regtank.com/app/onboardingCorporate/COD05594?archived=false")
    ).toBe(false);
  });

  it("does not generate a KYB result link from a COD", () => {
    const corp = person({
      matchKey: "8217649D",
      entityType: "CORPORATE",
      roles: ["SHAREHOLDER"],
      sharePercentage: 50,
      partyCorporateRequestId: "COD05595",
      screeningRequestId: "COD05595",
      onboarding: { status: "WAIT_FOR_APPROVAL", id: null },
    });
    expect(personRegTankKybId(corp)).toBeNull();
    expect(adminPersonKybResultUrl(corp)).toBeNull();
  });

  it("links KYB result only when a KYB id exists", () => {
    expect(
      adminPersonKybResultUrl(
        person({
          matchKey: "8217649D",
          entityType: "CORPORATE",
          roles: ["SHAREHOLDER"],
          sharePercentage: 50,
          screeningRequestId: "KYB00105",
        })
      )
    ).toBe("https://shoraka-trial.regtank.com/app/screen-kyb/result/KYB00105");
  });

  it("reads role-specific status from corporate entities without merging records", () => {
    expect(
      roleOnboardingStatusFromCorporateEntities(
        { directors: [{ eodRequestId: "EOD06934", status: "ID_UPLOADED" }] },
        "EOD06934"
      )
    ).toBe("ID_UPLOADED");
  });

  it("treats dual-role EODs as RegTank evidence and director-only / shareholder-only as one record", () => {
    expect(adminPersonHasRegTankEvidence(row().person)).toBe(true);
    expect(
      buildAdminPersonRegTankRoleRecords({
        person: person({
          matchKey: "1",
          roles: ["DIRECTOR"],
          sharePercentage: null,
          directorEodRequestId: "EOD1",
          parentCorporateRequestId: "COD1",
        }),
      })
    ).toHaveLength(1);
    expect(
      buildAdminPersonRegTankRoleRecords({
        person: person({
          matchKey: "2",
          roles: ["SHAREHOLDER"],
          directorEodRequestId: null,
          shareholderEodRequestId: "EOD2",
          parentCorporateRequestId: "COD1",
        }),
      })
    ).toHaveLength(1);
    expect(adminPersonHasRegTankEvidence(person({ matchKey: "none", directorEodRequestId: null }))).toBe(false);
  });
});

describe("completeness copy", () => {
  it("replaces vague complete-onboarding copy with the KYC rule", () => {
    expect(
      adminProfileCompletenessHint({
        applyIssuerComrep: true,
        row: row(),
        missingCount: 4,
        kycApproved: false,
      })
    ).toBe(PERSON_KYC_REQUIRED_BEFORE_PROFILE_COMPLETION);
    expect(
      adminProfileCompletenessHint({
        applyIssuerComrep: true,
        row: row({
          person: person({
            matchKey: "021116101341",
            onboarding: { status: "APPROVED", id: "KYC00184" },
          }),
        }),
        missingCount: 2,
        kycApproved: true,
      })
    ).toContain("Complete profile");
  });
});

describe("AML states", () => {
  it("maps pending approved and rejected without changing workflow tokens", () => {
    expect(adminAmlWaitingCopy({ corporate: false, person: row().person, amlLabel: "Pending" })).toBe(
      "AML review becomes available after KYC approval."
    );
    expect(
      adminAmlWaitingCopy({
        corporate: false,
        person: person({ matchKey: "1", onboarding: { status: "APPROVED" }, screening: { status: "CLEAR" } }),
        amlLabel: "Approved",
      })
    ).toBeNull();
    expect(
      adminAmlWaitingCopy({
        corporate: false,
        person: person({ matchKey: "1", onboarding: { status: "APPROVED" }, screening: { status: "FAILED" } }),
        amlLabel: "Rejected",
      })
    ).toBeNull();
  });
});

describe("platform-only and inactive", () => {
  it("labels platform-only and inactive rows", () => {
    expect(adminPartyProfileStatusLabel(row({ kind: "platform_only", companyRoleLine: "—" }))).toBe(
      "Platform access only"
    );
    expect(adminPartyProfileStatusLabel(row({ inactive: true }))).toBe("Inactive");
  });
});
