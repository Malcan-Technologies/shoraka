import { diffCorporateEntities, directorKycMaterialChange } from "./diff";

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
