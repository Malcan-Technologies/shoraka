import { directorKycFinalOutcomes, directorKycMaterialChange, diffCorporateEntities } from "./diff";

describe("diffCorporateEntities", () => {
  it("reports no change when persisted JSON is equivalent", () => {
    const entities = {
      directors: [{ personalInfo: { fullName: "A", governmentIdNumber: "1" } }],
      shareholders: [],
      corporateShareholders: [],
    };
    expect(diffCorporateEntities(entities, structuredClone(entities))).toEqual({
      changed: false,
      addedCount: 0,
      removedCount: 0,
      updatedCount: 0,
    });
  });

  it("counts added, removed, and updated entities", () => {
    const before = {
      directors: [{ personalInfo: { fullName: "A", governmentIdNumber: "1" } }],
      shareholders: [{ personalInfo: { fullName: "B", governmentIdNumber: "2" } }],
      corporateShareholders: [],
    };
    const after = {
      directors: [{ personalInfo: { fullName: "A", governmentIdNumber: "1", email: "a@x.com" } }],
      shareholders: [],
      corporateShareholders: [{ businessName: "Co" }],
    };
    expect(diffCorporateEntities(before, after)).toEqual({
      changed: true,
      addedCount: 1,
      removedCount: 1,
      updatedCount: 1,
    });
  });
});

describe("directorKycMaterialChange", () => {
  it("ignores timestamp-only changes", () => {
    const before = { directors: [{ eodRequestId: "E1", kycStatus: "PENDING", kycId: "KYC1", updatedAt: "1" }] };
    const after = { directors: [{ eodRequestId: "E1", kycStatus: "PENDING", kycId: "KYC1", updatedAt: "2" }] };
    expect(directorKycMaterialChange(before, after).changed).toBe(false);
  });

  it("detects kycStatus changes", () => {
    const before = { directors: [{ eodRequestId: "E1", kycStatus: "PENDING", kycId: "KYC1" }] };
    const after = { directors: [{ eodRequestId: "E1", kycStatus: "APPROVED", kycId: "KYC1" }] };
    const diff = directorKycMaterialChange(before, after);
    expect(diff.changed).toBe(true);
    expect(diff.previousKycStatus).toBe("PENDING");
    expect(diff.newKycStatus).toBe("APPROVED");
  });
});

describe("directorKycFinalOutcomes", () => {
  it("ignores first JSON seed even when a director is already APPROVED", () => {
    const after = {
      directors: [{ eodRequestId: "E1", name: "Ada", kycStatus: "APPROVED" }],
    };
    expect(directorKycFinalOutcomes(null, after)).toEqual([]);
    expect(directorKycFinalOutcomes({ directors: [] }, after)).toEqual([]);
  });

  it("ignores intermediate statuses and kycId-only changes", () => {
    const before = { directors: [{ eodRequestId: "E1", name: "Ada", kycStatus: "PENDING", kycId: "K1" }] };
    expect(
      directorKycFinalOutcomes(before, {
        directors: [{ eodRequestId: "E1", name: "Ada", kycStatus: "ID_UPLOADED", kycId: "K1" }],
      })
    ).toEqual([]);
    expect(
      directorKycFinalOutcomes(before, {
        directors: [{ eodRequestId: "E1", name: "Ada", kycStatus: "LIVENESS_STARTED", kycId: "K1" }],
      })
    ).toEqual([]);
    expect(
      directorKycFinalOutcomes(before, {
        directors: [{ eodRequestId: "E1", name: "Ada", kycStatus: "WAIT_FOR_APPROVAL", kycId: "K1" }],
      })
    ).toEqual([]);
    expect(
      directorKycFinalOutcomes(
        { directors: [{ eodRequestId: "E1", name: "Ada", kycStatus: "APPROVED", kycId: "K1" }] },
        { directors: [{ eodRequestId: "E1", name: "Ada", kycStatus: "APPROVED", kycId: "K2" }] }
      )
    ).toEqual([]);
  });

  it("emits one APPROVED or REJECTED outcome per director without collapsing pairs", () => {
    const before = {
      directors: [
        { eodRequestId: "E1", name: "Ada", kycStatus: "WAIT_FOR_APPROVAL" },
        { eodRequestId: "E2", name: "Ben", kycStatus: "PENDING" },
        { eodRequestId: "E3", name: "Cara", kycStatus: "APPROVED" },
      ],
    };
    const after = {
      directors: [
        { eodRequestId: "E1", name: "Ada", kycStatus: "APPROVED" },
        { eodRequestId: "E2", name: "Ben", kycStatus: "REJECTED" },
        { eodRequestId: "E3", name: "Cara", kycStatus: "APPROVED" },
      ],
    };
    expect(directorKycFinalOutcomes(before, after)).toEqual([
      {
        eodRequestId: "E1",
        directorName: "Ada",
        previousKycStatus: "WAIT_FOR_APPROVAL",
        newKycStatus: "APPROVED",
      },
      {
        eodRequestId: "E2",
        directorName: "Ben",
        previousKycStatus: "PENDING",
        newKycStatus: "REJECTED",
      },
    ]);
  });

  it("does not emit a duplicate final status", () => {
    const row = { directors: [{ eodRequestId: "E1", name: "Ada", kycStatus: "APPROVED" }] };
    expect(directorKycFinalOutcomes(row, structuredClone(row))).toEqual([]);
  });
});
