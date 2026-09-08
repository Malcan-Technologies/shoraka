import {
  extractBusinessNameFromCorpShareholderRow,
  extractBusinessNumberFromCorpShareholderRow,
  matchBusinessShareholderForKybWebhook,
} from "./business-shareholder-kyb-match";

const apexCeRow = {
  requestId: "COD05579",
  companyName: "ApexStar Holdings Sdn. Bhd.",
  status: "APPROVED",
  formContent: {
    displayAreas: [
      {
        displayArea: "Basic Information Setting",
        content: [
          { fieldName: "Business Name", fieldValue: "ApexStar Holdings Sdn. Bhd." },
          { fieldName: "% of Shares", fieldValue: "10" },
          { fieldName: "Business Number", fieldValue: "7321984G" },
        ],
      },
    ],
  },
};

const apexAmlRow = {
  kybId: "KYB00109",
  amlStatus: "Pending",
  businessName: "ApexStar Holdings Sdn. Bhd.",
  codRequestId: "COD05579",
  sharePercentage: 10,
};

const org = {
  corporate_entities: { corporateShareholders: [apexCeRow] },
  director_aml_status: { directors: [], businessShareholders: [apexAmlRow] },
};

describe("matchBusinessShareholderForKybWebhook", () => {
  it("matches nested shareholder by kybId even when webhook onboardingId is the parent COD", () => {
    const match = matchBusinessShareholderForKybWebhook(org, {
      kybId: "KYB00109",
      onboardingId: "COD05578",
    });
    expect(match?.shareholderCodRequestId).toBe("COD05579");
    expect(match?.storedKybId).toBe("KYB00109");
    expect(match?.amlEntry).toEqual(apexAmlRow);
  });

  it("matches by nested COD when kybId is not stored on the org yet", () => {
    const beforeKyb = {
      corporate_entities: { corporateShareholders: [apexCeRow] },
      director_aml_status: { directors: [], businessShareholders: [] },
    };
    const match = matchBusinessShareholderForKybWebhook(beforeKyb, {
      kybId: "KYB00109",
      onboardingId: "COD05579",
    });
    expect(match?.shareholderCodRequestId).toBe("COD05579");
    expect(match?.corporateShareholder).toEqual(apexCeRow);
  });

  it("does not treat the parent company COD as the nested shareholder", () => {
    const match = matchBusinessShareholderForKybWebhook(org, {
      kybId: "KYB-MAIN",
      onboardingId: "COD05578",
    });
    expect(match).toBeNull();
  });
});

describe("corporate shareholder form extractors", () => {
  it("reads business name and number from RegTank formContent", () => {
    expect(extractBusinessNameFromCorpShareholderRow(apexCeRow)).toBe("ApexStar Holdings Sdn. Bhd.");
    expect(extractBusinessNumberFromCorpShareholderRow(apexCeRow)).toBe("7321984G");
  });
});
