import {
  buildRegTankIndividualVerifyLink,
  calculateRegTankVerifyLinkExpiresAt,
  classifyPersonVerifyLinkExpiry,
  deriveRegTankIndividualOnboardingOrigin,
  parseRegTankTimestamp,
  replaceRegTankVerifyLinkToken,
  resolvePersonRenewedVerifyLink,
} from "./regtank-verify-link";

describe("RegTank verify-link expiry", () => {
  it("parses the documented timestamp format with a space and +0000 offset", () => {
    expect(parseRegTankTimestamp("2023-07-31 09:45:29+0000").toISOString()).toBe(
      "2023-07-31T09:45:29.000Z"
    );
  });

  it.each([
    { expiredIn: 3600, expected: "2023-07-31T10:45:29.000Z" },
    { expiredIn: 86400, expected: "2023-08-01T09:45:29.000Z" },
    { expiredIn: 604800, expected: "2023-08-07T09:45:29.000Z" },
  ])("uses returned expiredIn=$expiredIn against the RegTank timestamp", ({ expiredIn, expected }) => {
    expect(
      calculateRegTankVerifyLinkExpiresAt({
        expiredIn,
        timestamp: "2023-07-31 09:45:29+0000",
      })?.toISOString()
    ).toBe(expected);
  });

  it("does not invent a duration when expiredIn is missing", () => {
    expect(
      calculateRegTankVerifyLinkExpiresAt({
        timestamp: "2023-07-31 09:45:29+0000",
        expiredIn: undefined,
      })
    ).toBeUndefined();
  });

  it("uses now as the base when timestamp is missing", () => {
    const now = new Date("2026-09-10T00:00:00.000Z");
    expect(
      calculateRegTankVerifyLinkExpiresAt({
        expiredIn: 3600,
        now,
      })?.toISOString()
    ).toBe("2026-09-10T01:00:00.000Z");
  });
});

describe("classifyPersonVerifyLinkExpiry", () => {
  const now = new Date("2026-09-10T12:00:00.000Z");
  const link = "https://onboarding.example/?requestId=LD1&token=abc";

  it("is missing when the verify link is absent", () => {
    expect(
      classifyPersonVerifyLinkExpiry({
        verifyLink: "",
        verifyLinkExpiresAt: "2026-09-10T13:00:00.000Z",
        now,
      })
    ).toBe("missing");
  });

  it("is valid when now is before verifyLinkExpiresAt", () => {
    expect(
      classifyPersonVerifyLinkExpiry({
        verifyLink: link,
        verifyLinkExpiresAt: "2026-09-10T13:00:00.000Z",
        now,
      })
    ).toBe("valid");
  });

  it("is expired when verifyLinkExpiresAt is now or earlier", () => {
    expect(
      classifyPersonVerifyLinkExpiry({
        verifyLink: link,
        verifyLinkExpiresAt: "2026-09-10T12:00:00.000Z",
        now,
      })
    ).toBe("expired");
    expect(
      classifyPersonVerifyLinkExpiry({
        verifyLink: link,
        verifyLinkExpiresAt: "2026-09-10T11:59:59.000Z",
        now,
      })
    ).toBe("expired");
  });

  it("is unknown when expiry is missing and does not assume expired", () => {
    expect(classifyPersonVerifyLinkExpiry({ verifyLink: link, now })).toBe("unknown");
  });
});

describe("RegTank verify-link URL handling", () => {
  const existing =
    "https://shoraka-onboarding.regtank.com?requestId=LD00001&formId=1015495&token=OLDTOKEN&language=EN&step=BaseInfo&skipFormPage=false";

  it("replaces only the token query parameter", () => {
    const next = replaceRegTankVerifyLinkToken(existing, "NEWTOKEN");
    const url = new URL(next);
    expect(url.origin).toBe("https://shoraka-onboarding.regtank.com");
    expect(url.searchParams.get("requestId")).toBe("LD00001");
    expect(url.searchParams.get("formId")).toBe("1015495");
    expect(url.searchParams.get("token")).toBe("NEWTOKEN");
    expect(url.searchParams.get("language")).toBe("EN");
    expect(url.searchParams.get("step")).toBe("BaseInfo");
    expect(url.searchParams.get("skipFormPage")).toBe("false");
  });

  it("derives the person onboarding origin from the API server URL", () => {
    expect(deriveRegTankIndividualOnboardingOrigin("https://shoraka-trial-server.regtank.com")).toBe(
      "https://shoraka-trial-onboarding.regtank.com"
    );
  });

  it("reconstructs a missing verifyLink from request context and the new token", () => {
    const built = buildRegTankIndividualVerifyLink({
      origin: "https://shoraka-onboarding.regtank.com",
      requestId: "LD00001",
      token: "NEWTOKEN",
      formId: 1015495,
    });
    const url = new URL(built);
    expect(url.searchParams.get("requestId")).toBe("LD00001");
    expect(url.searchParams.get("token")).toBe("NEWTOKEN");
    expect(url.searchParams.get("formId")).toBe("1015495");
    expect(url.searchParams.get("skipFormPage")).toBe("false");
  });

  it("prefers a returned verifyLink, otherwise patches the stored URL", () => {
    expect(
      resolvePersonRenewedVerifyLink({
        existingVerifyLink: existing,
        requestId: "LD00001",
        token: "NEWTOKEN",
        formId: 1015495,
        origin: "https://shoraka-onboarding.regtank.com",
        returnedVerifyLink: "https://returned.example/?token=FROMAPI",
      })
    ).toBe("https://returned.example/?token=FROMAPI");

    const patched = resolvePersonRenewedVerifyLink({
      existingVerifyLink: existing,
      requestId: "LD00001",
      token: "NEWTOKEN",
      formId: 1015495,
      origin: "https://shoraka-onboarding.regtank.com",
    });
    expect(new URL(patched).searchParams.get("token")).toBe("NEWTOKEN");
    expect(new URL(patched).searchParams.get("requestId")).toBe("LD00001");
  });
});
