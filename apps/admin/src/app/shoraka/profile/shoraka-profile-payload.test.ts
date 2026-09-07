import { shorakaRecordPayload, shorakaShareCapitalPayload } from "./shoraka-profile-payload";

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

  it("strips row id on create and update bodies", () => {
    expect(
      shorakaRecordPayload({
        id: "sh_1",
        holderType: "SHAREHOLDER",
        name: "Aisha",
      })
    ).toEqual({
      holderType: "SHAREHOLDER",
      name: "Aisha",
    });
  });
});
