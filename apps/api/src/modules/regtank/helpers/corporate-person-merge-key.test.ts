import {
  corporatePersonIdentitiesMatch,
  resolveCorporatePersonMergeKey,
} from "./corporate-person-merge-key";

describe("resolveCorporatePersonMergeKey", () => {
  it("prefers government ID over name and EOD", () => {
    expect(
      resolveCorporatePersonMergeKey({
        governmentIdNumber: "900101-10-1111",
        name: "Lim Tze Yang",
        eodRequestId: "EOD06284",
      })
    ).toBe("gov:900101101111");
  });

  it("uses normalized name when government ID is missing", () => {
    expect(
      resolveCorporatePersonMergeKey({
        governmentIdNumber: null,
        name: "  Lim   Tze Yang ",
        eodRequestId: "EOD06284",
      })
    ).toBe("name:lim tze yang");
  });

  it("falls back to EOD when name and government ID are missing", () => {
    expect(
      resolveCorporatePersonMergeKey({
        governmentIdNumber: null,
        name: "",
        eodRequestId: "EOD06284",
      })
    ).toBe("eod:EOD06284");
  });

  it("never uses email in the merge key", () => {
    const key = resolveCorporatePersonMergeKey({
      governmentIdNumber: "800202-10-2222",
      name: "Ahmad Shahril",
      eodRequestId: "EOD06286",
    });
    expect(key).not.toContain("@");
    expect(key).toBe("gov:800202102222");
  });
});

describe("corporatePersonIdentitiesMatch", () => {
  it("keeps same-email people separate when government IDs differ", () => {
    expect(
      corporatePersonIdentitiesMatch(
        {
          governmentIdNumber: "900101-10-1111",
          name: "Lim Tze Yang",
          eodRequestId: "EOD06284",
        },
        {
          governmentIdNumber: "800202-10-2222",
          name: "Ahmad Shahril",
          eodRequestId: "EOD06286",
        }
      )
    ).toBe(false);
  });

  it("merges director and shareholder roles for the same government ID", () => {
    expect(
      corporatePersonIdentitiesMatch(
        {
          governmentIdNumber: "900101-10-1111",
          name: "Lim Tze Yang",
          eodRequestId: "EOD06284",
        },
        {
          governmentIdNumber: "900101101111",
          name: "Lim Tze Yang",
          eodRequestId: "EOD06283",
        }
      )
    ).toBe(true);
  });

  it("matches via linked shareholder EOD id", () => {
    expect(
      corporatePersonIdentitiesMatch(
        {
          governmentIdNumber: null,
          name: "Lim Tze Yang",
          eodRequestId: "EOD06284",
          shareholderEodRequestId: "EOD06283",
        },
        {
          governmentIdNumber: null,
          name: "Someone Else",
          eodRequestId: "EOD06283",
        }
      )
    ).toBe(true);
  });
});
