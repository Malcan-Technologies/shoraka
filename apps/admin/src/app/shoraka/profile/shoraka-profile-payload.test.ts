import {
  shorakaAdvisorPayload,
  shorakaFinancialPayload,
  shorakaInterestPayload,
  shorakaOfficerPayload,
  shorakaShareCapitalPayload,
  shorakaShareholderPayload,
} from "./shoraka-profile-payload";

describe("Shoraka profile payload shaping", () => {
  it("strips share-capital DTO id before PATCH", () => {
    expect(
      shorakaShareCapitalPayload(
        {
          id: "cap_1",
          ordinaryUnits: "50",
          ordinaryAmount: "50",
          extra: "no",
          totalLlp: "9",
        },
        "SDN_BHD"
      )
    ).toEqual({
      ordinaryUnits: "50",
      ordinaryAmount: "50",
    });
  });

  it("strips row id and unknown keys on shareholder bodies", () => {
    expect(
      shorakaShareholderPayload({
        id: "sh_1",
        holderType: "SHAREHOLDER",
        entityType: "INDIVIDUAL",
        name: "Aisha",
        extra: true,
      })
    ).toEqual({
      holderType: "SHAREHOLDER",
      entityType: "INDIVIDUAL",
      name: "Aisha",
    });
  });

  it("strips id and unknown keys from officer, adviser, interest, and financial bodies", () => {
    expect(
      shorakaOfficerPayload({
        id: "of_1",
        personKind: "BOARD",
        name: "Aisha",
        isResponsiblePerson: true,
        extra: true,
      })
    ).toEqual({
      personKind: "BOARD",
      name: "Aisha",
      isResponsiblePerson: true,
    });
    expect(
      shorakaAdvisorPayload({
        id: "ad_1",
        advisorType: "AUDITOR",
        name: "Audit Co",
        extra: true,
      })
    ).toEqual({
      advisorType: "AUDITOR",
      name: "Audit Co",
    });
    expect(
      shorakaInterestPayload({
        id: "in_1",
        name: "HoldCo",
        shareType: "ORDINARY",
        extra: true,
      })
    ).toEqual({
      name: "HoldCo",
      shareType: "ORDINARY",
    });
    expect(
      shorakaFinancialPayload({
        id: "fs_1",
        totalRevenue: "1000",
        extra: true,
      })
    ).toEqual({
      totalRevenue: "1000",
    });
  });
});
