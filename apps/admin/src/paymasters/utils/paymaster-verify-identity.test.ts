import {
  paymasterDetailVerificationBlocked,
  paymasterIdentityToVerify,
} from "./paymaster-verify-identity";

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
  it("uses Application B submitted identity, not the unverified master, when applicationId is present", () => {
    expect(
      paymasterIdentityToVerify({
        applicationId: "app-b",
        customerDetails: applicationBDetails,
        paymaster: master,
      })
    ).toEqual({
      name: "bbbb",
      entity_type: "Federal Government Agency",
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

describe("paymasterDetailVerificationBlocked", () => {
  it("blocks Paymaster Detail verify when submitted identities differ", () => {
    expect(
      paymasterDetailVerificationBlocked([
        {
          applicationId: "app-a",
          applicationDisplayReference: "A",
          applicationProductId: "prod",
          applicationStatus: "SUBMITTED",
          submittedAt: "2026-09-01T00:00:00.000Z",
          issuerOrganizationId: "org-1",
          issuerName: "Issuer",
          legalName: "yayay",
          registrationNumber: "999999999999",
          entityType: "State Government",
          registrationCountry: "MY",
        },
        {
          applicationId: "app-b",
          applicationDisplayReference: "B",
          applicationProductId: "prod",
          applicationStatus: "SUBMITTED",
          submittedAt: "2026-09-02T00:00:00.000Z",
          issuerOrganizationId: "org-1",
          issuerName: "Issuer",
          legalName: "bbbb",
          registrationNumber: "999999999999",
          entityType: "Federal Government Agency",
          registrationCountry: "MY",
        },
      ])
    ).toBe(true);
  });
});
