import { paymasterIdentityToVerify } from "./paymaster-verify-identity";

const master = {
  id: "pm_1",
  legalName: "yayay",
  entityType: "State Government",
  registrationNumber: "999999999999",
  registrationCountry: "MY",
  verificationStatus: "UNVERIFIED",
};

const applicationBDetails = {
  name: "bbbb",
  entity_type: "Federal Government Agency",
  ssm_number: "999999999999",
  country: "MY",
};

describe("paymasterIdentityToVerify", () => {
  it("uses the current official master even when Application Review supplies submitted details", () => {
    expect(
      paymasterIdentityToVerify({
        applicationId: "app-b",
        customerDetails: applicationBDetails,
        paymaster: master,
      })
    ).toEqual({
      name: "yayay",
      entity_type: "State Government",
      ssm_number: "999999999999",
      country: "MY",
    });
  });

  it("uses the current master identity on Paymaster Detail", () => {
    expect(
      paymasterIdentityToVerify({
        customerDetails: applicationBDetails,
        paymaster: master,
      })
    ).toEqual({
      name: "yayay",
      entity_type: "State Government",
      ssm_number: "999999999999",
      country: "MY",
    });
  });
});
