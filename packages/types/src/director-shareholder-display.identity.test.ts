import {
  attachGovernmentIdToUnresolvedCorporateEntities,
  extractGovernmentId,
  upsertGovernmentIdOnFormContent,
} from "./director-shareholder-display";

const toyotaLike = {
  directors: [
    {
      eodRequestId: "EOD04846",
      personalInfo: {
        email: "ivan.chew@malcan.io",
        fullName: "Ivan Chew Ken Yoong",
        formContent: {
          content: [{ fieldName: "Government ID Number", fieldValue: "891114075601" }],
        },
      },
    },
  ],
  shareholders: [
    {
      eodRequestId: "EOD04846",
      personalInfo: {
        email: "denglucasyijin@gmail.com",
        fullName: "Deng Yi Jin",
        formContent: {
          content: [
            { fieldName: "First Name", fieldValue: "Deng" },
            { fieldName: "% of Shares", fieldValue: "10" },
            { fieldName: "Email Address", fieldValue: "denglucasyijin@gmail.com" },
          ],
        },
      },
    },
    {
      eodRequestId: "EOD04848",
      personalInfo: {
        email: "lucas.deng@malcan.io",
        fullName: "Lucas Deng",
        formContent: {
          content: [
            { fieldName: "First Name", fieldValue: "Lucas" },
            { fieldName: "% of Shares", fieldValue: "10" },
            { fieldName: "Email Address", fieldValue: "lucas.deng@malcan.io" },
          ],
        },
      },
    },
  ],
};

describe("attachGovernmentIdToUnresolvedCorporateEntities", () => {
  it("writes Government ID Number onto a shareholder that shares an EOD with a director", () => {
    const next = attachGovernmentIdToUnresolvedCorporateEntities(toyotaLike, {
      eodRequestId: "EOD04846",
      email: "denglucasyijin@gmail.com",
      role: "SHAREHOLDER",
      governmentId: "900101-10-1111",
    });
    const deng = (next.shareholders as Record<string, unknown>[])[0];
    const info = deng.personalInfo as Record<string, unknown>;
    expect(info.governmentIdNumber).toBe("900101-10-1111");
    expect(extractGovernmentId(info.formContent)).toBe("900101-10-1111");
    const ivan = (next.directors as Record<string, unknown>[])[0];
    expect(
      extractGovernmentId((ivan.personalInfo as Record<string, unknown>).formContent)
    ).toBe("891114075601");
  });

  it("rejects a government ID already used on another person", () => {
    expect(() =>
      attachGovernmentIdToUnresolvedCorporateEntities(toyotaLike, {
        eodRequestId: "EOD04848",
        email: "lucas.deng@malcan.io",
        role: "SHAREHOLDER",
        governmentId: "891114075601",
      })
    ).toThrow("GOVERNMENT_ID_IN_USE");
  });

  it("upserts the government ID field without dropping existing form rows", () => {
    const next = upsertGovernmentIdOnFormContent(
      { content: [{ fieldName: "Email Address", fieldValue: "a@b.com" }] },
      "021116101341"
    );
    expect(next.content).toEqual([
      { fieldName: "Email Address", fieldValue: "a@b.com" },
      { fieldName: "Government ID Number", fieldType: "text", fieldValue: "021116101341" },
    ]);
  });
});
