import {
  parseSigningCloudSubmitResultBody,
  signingCloudQueryUsersHasSigner,
} from "./signingcloud-ekyc";

describe("SigningCloud submitResult parsing", () => {
  it("reads userVerificationSuccess from body", () => {
    const parsed = parseSigningCloudSubmitResultBody({
      result: 0,
      ekycData: {},
      userVerificationSuccess: false,
      message: "Success",
    });

    expect(parsed.userVerificationSuccess).toBe(false);
    expect(parsed.message).toBe("Success");
  });

  it("treats missing userVerificationSuccess as false", () => {
    const parsed = parseSigningCloudSubmitResultBody({
      result: 0,
      ekycData: {},
      message: "Success",
    });

    expect(parsed.userVerificationSuccess).toBe(false);
  });

  it("reads userVerificationSuccess true from decrypted-style body", () => {
    const parsed = parseSigningCloudSubmitResultBody({
      userVerificationSuccess: true,
      ekycData: { name: "TEST USER" },
    });

    expect(parsed.userVerificationSuccess).toBe(true);
    expect(parsed.ekycData).toEqual({ name: "TEST USER" });
  });
});

describe("signingCloudQueryUsersHasSigner", () => {
  it("returns true when users map contains the email key", () => {
    expect(
      signingCloudQueryUsersHasSigner(
        {
          users: {
            "signer@example.com": {
              email: "signer@example.com",
              roletype: -1,
            },
          },
        },
        "signer@example.com"
      )
    ).toBe(true);
  });

  it("returns true when user entry email matches case-insensitively", () => {
    expect(
      signingCloudQueryUsersHasSigner(
        {
          users: {
            "1": {
              email: "Signer@Example.com",
              roletype: -1,
            },
          },
        },
        "signer@example.com"
      )
    ).toBe(true);
  });

  it("returns false when users map is empty", () => {
    expect(signingCloudQueryUsersHasSigner({ users: {} }, "signer@example.com")).toBe(false);
  });

  it("returns false when another email is returned", () => {
    expect(
      signingCloudQueryUsersHasSigner(
        {
          users: {
            "other@example.com": {
              email: "other@example.com",
              roletype: -1,
            },
          },
        },
        "signer@example.com"
      )
    ).toBe(false);
  });
});
