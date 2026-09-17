import { evidenceObservationFromResolvedPerson } from "./service";

describe("evidenceObservationFromResolvedPerson identityNumber provenance", () => {
  it("does not infer identityNumber from matchKey when canonical identityNumber is missing", () => {
    const resolved = evidenceObservationFromResolvedPerson({
      matchKey: "820508105871",
      name: "Ali",
      entityType: "INDIVIDUAL",
      roles: ["DIRECTOR"],
      sharePercentage: null,
      identityNumber: null,
    });

    expect(resolved.identityNumber).toBeNull();
  });
});

