import { extractRegTankPersonSeedFields } from "./regtank-person-profile-seed";

describe("extractRegTankPersonSeedFields", () => {
  it("seeds confirmed userProfile fields and ignores email", () => {
    const seed = extractRegTankPersonSeedFields({
      userProfile: {
        firstName: "Ahmad",
        lastName: "Ali",
        documentNum: "900101-10-1234",
        documentType: "IDENTITY",
        gender: "MALE",
        dateOfBirth: "1990-01-01",
        nationality: "MALAYSIA",
        email: "regtank@example.com",
      },
    });
    expect(seed.name).toBe("Ahmad Ali");
    expect(seed.identityNumber).toBe("900101-10-1234");
    expect(seed.identityPrefix).toBeNull();
    expect(seed.gender).toBe("MALE");
    expect(seed.dateOfBirth).toBe("1990-01-01");
    expect(seed.nationality).toBe("MALAYSIA");
    expect(seed).not.toHaveProperty("email");
  });

  it("sets PASSPORT prefix only for an exact PASSPORT document type", () => {
    expect(
      extractRegTankPersonSeedFields({ userProfile: { documentType: "PASSPORT", documentNum: "A123" } })
        .identityPrefix
    ).toBe("PASSPORT");
    expect(
      extractRegTankPersonSeedFields({ userProfile: { idType: "passport", documentNum: "A123" } }).identityPrefix
    ).toBe("PASSPORT");
    expect(
      extractRegTankPersonSeedFields({ userProfile: { documentType: "DRIVER_LICENSE", documentNum: "A123" } })
        .identityPrefix
    ).toBeNull();
  });

  it("skips UNSPECIFIED gender and unmapped nationality", () => {
    const seed = extractRegTankPersonSeedFields({
      userProfile: { gender: "UNSPECIFIED", nationality: "MY", dateOfBirth: "not-a-date" },
    });
    expect(seed.gender).toBeNull();
    expect(seed.nationality).toBeNull();
    expect(seed.dateOfBirth).toBeNull();
  });

  it("accepts FEMALE and a parseable DOB", () => {
    const seed = extractRegTankPersonSeedFields({
      userProfile: { gender: "female", dateOfBirth: "01-12-2001" },
    });
    expect(seed.gender).toBe("FEMALE");
    expect(seed.dateOfBirth).toBe("2001-12-01");
  });
});
