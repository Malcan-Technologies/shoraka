import type { ProfileFieldSources } from "@cashsouk/types";
import {
  computePartyEditorProvenanceLockFlags,
  type PartyEditorProvenanceLockFlags,
} from "./party-editor-provenance-lock";

function flagsFor(params: {
  fieldSources?: ProfileFieldSources;
  values?: Partial<{
    salutation: string;
    gender: string;
    dateOfBirth: string;
    nationality: string;
    identityPrefix: string;
    identityNumber: string;
    dateOfIncorporation: string;
    countryOfIncorporation: string;
  }>;
}): PartyEditorProvenanceLockFlags {
  return computePartyEditorProvenanceLockFlags({
    fieldSources: params.fieldSources,
    values: {
      salutation: params.values?.salutation ?? "",
      gender: params.values?.gender ?? "",
      dateOfBirth: params.values?.dateOfBirth ?? "",
      nationality: params.values?.nationality ?? "",
      identityPrefix: params.values?.identityPrefix ?? "",
      identityNumber: params.values?.identityNumber ?? "",
      dateOfIncorporation: params.values?.dateOfIncorporation ?? "",
      countryOfIncorporation: params.values?.countryOfIncorporation ?? "",
    },
  });
}

describe("computePartyEditorProvenanceLockFlags", () => {
  it("locks RegTank fields when value is non-empty", () => {
    const fieldSources: ProfileFieldSources = {
      salutation: { source: "REGTANK", updatedAt: "2026-01-01T00:00:00.000Z" },
      gender: { source: "REGTANK", updatedAt: "2026-01-01T00:00:00.000Z" },
      dateOfBirth: { source: "REGTANK", updatedAt: "2026-01-01T00:00:00.000Z" },
      nationality: { source: "REGTANK", updatedAt: "2026-01-01T00:00:00.000Z" },
      identityPrefix: { source: "REGTANK", updatedAt: "2026-01-01T00:00:00.000Z" },
      identityNumber: { source: "REGTANK", updatedAt: "2026-01-01T00:00:00.000Z" },
      dateOfIncorporation: { source: "REGTANK", updatedAt: "2026-01-01T00:00:00.000Z" },
      countryOfIncorporation: { source: "REGTANK", updatedAt: "2026-01-01T00:00:00.000Z" },
    };

    const locked = flagsFor({
      fieldSources,
      values: {
        salutation: "Mr",
        gender: "MALE",
        dateOfBirth: "1990-01-01",
        nationality: "MALAYSIA",
        identityPrefix: "NRIC",
        identityNumber: "S1234567A",
        dateOfIncorporation: "2010-01-01",
        countryOfIncorporation: "SG",
      },
    });

    expect(locked).toEqual({
      salutationLocked: true,
      genderLocked: true,
      dateOfBirthLocked: true,
      nationalityLocked: true,
      identityPrefixLocked: true,
      identityNumberLocked: true,
      dateOfIncorporationLocked: true,
      countryOfIncorporationLocked: true,
    });
  });

  it("does not lock RegTank fields when value is empty", () => {
    const fieldSources: ProfileFieldSources = {
      salutation: { source: "REGTANK", updatedAt: "2026-01-01T00:00:00.000Z" },
      dateOfBirth: { source: "REGTANK", updatedAt: "2026-01-01T00:00:00.000Z" },
      identityNumber: { source: "REGTANK", updatedAt: "2026-01-01T00:00:00.000Z" },
    };

    const locked = flagsFor({
      fieldSources,
      values: {
        salutation: "",
        dateOfBirth: "",
        identityNumber: "",
      },
    });

    expect(locked.salutationLocked).toBe(false);
    expect(locked.dateOfBirthLocked).toBe(false);
    expect(locked.identityNumberLocked).toBe(false);
  });

  it("does not lock when provenance is USER/ADMIN", () => {
    const fieldSources: ProfileFieldSources = {
      salutation: { source: "USER", updatedAt: "2026-01-01T00:00:00.000Z" },
      dateOfBirth: { source: "ADMIN", updatedAt: "2026-01-01T00:00:00.000Z" },
      identityNumber: { source: "USER", updatedAt: "2026-01-01T00:00:00.000Z" },
    };

    const locked = flagsFor({
      fieldSources,
      values: {
        salutation: "Mr",
        dateOfBirth: "1990-01-01",
        identityNumber: "S1234567A",
      },
    });

    expect(locked.salutationLocked).toBe(false);
    expect(locked.dateOfBirthLocked).toBe(false);
    expect(locked.identityNumberLocked).toBe(false);
  });

  it("does not lock when provenance is missing", () => {
    const locked = flagsFor({
      fieldSources: {},
      values: {
        salutation: "Mr",
        dateOfBirth: "1990-01-01",
        identityNumber: "S1234567A",
      },
    });

    expect(locked.salutationLocked).toBe(false);
    expect(locked.dateOfBirthLocked).toBe(false);
    expect(locked.identityNumberLocked).toBe(false);
  });
});

