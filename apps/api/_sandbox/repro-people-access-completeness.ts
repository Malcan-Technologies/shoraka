import { asAddress } from "../src/modules/organization-profile/serialize";
import { buildIssuerProfileCompleteness } from "@cashsouk/types";

function isoDate(yyyyMmDd: string): string {
  // Keep it parseable by `hasDate(...)` inside comrep-profile rules.
  // `computeOrgProfileCompleteness` would normally pass a Date instance from Prisma,
  // but strings are also supported by completeness checks.
  return yyyyMmDd;
}

function main() {
  const dbAddressJson = {
    line1: "1 Jalan A",
    line2: null,
    state: "Selangor",
    // Mimic the current DB/patch shape: `postalCode` (backend tolerates `postcode` too).
    postalCode: "47800",
  };

  const person = {
    partyKey: "repro_director_1",
    name: "Nur Aina Farisha Binti Salleh",
    entityType: "INDIVIDUAL" as const,
    isDirector: true,
    isShareholder: false,
    isBoard: false,
    isManagement: false,
    identityPrefix: "NRIC" as const,
    identityNumber: "950829083430",
    dateOfBirth: isoDate("1980-01-01"),
    dateOfIncorporation: null,
    gender: "FEMALE" as const,
    nationality: "Malaysia",
    countryOfIncorporation: null,
    address: asAddress(dbAddressJson),
    shareType: null,
    shareTypeOther: null,
    shareholdingUnits: null,
    shareholdingAmount: null,
    shareholdingPercentage: null,
    designation: null,
    designationOther: null,
    appointmentDate: null,
    kycOnboardingStatus: null,
  };

  const completeness = buildIssuerProfileCompleteness({
    company: {
      name: "Acme Sdn Bhd",
      registrationNumber: "1234567A",
      organizationId: "repro_org_1",
      dateOfIncorporation: isoDate("2020-01-01"),
      dateOfCommencement: isoDate("2020-02-01"),
      countryOfIncorporation: "Malaysia",
      scCompanyType: "PRIVATE_LIMITED",
      registeredAddress: {
        line1: "1 Jalan R",
        line2: null,
        state: "Selangor",
        postalCode: "40000",
        city: null,
        country: null,
      },
      businessAddress: {
        line1: "2 Jalan B",
        line2: null,
        state: "Selangor",
        postalCode: "41000",
        city: null,
        country: null,
      },
      contactPerson: {
        name: "PIC Name",
        position: "Director",
        email: "pic@example.com",
        contact: "+60123456789",
      },
      personInCharge: null,
      companyActivities: "What we do",
      mainCustomers: "Our customers",
    },
    shareholders: [],
    board: [],
    people: [person],
    financials: null,
  });

  // Focus on the People & Access gate items.
  const peopleMissing = completeness.missing.filter((m) => m.step === "shareholders" || m.step === "board");
  // Print something machine-readable for quick comparison.
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        complete: completeness.complete,
        missingCount: completeness.missing.length,
        peopleMissingCount: peopleMissing.length,
        peopleMissing,
      },
      null,
      2
    )
  );
}

main();

