import {
  classifySigningCloudMessage,
  signingCloudProviderError,
} from "./signingcloud-errors";

describe("classifySigningCloudMessage", () => {
  it("treats already-signed replies as reconciliation", () => {
    expect(classifySigningCloudMessage("The signer has already signed")).toBe("ALREADY_SIGNED");
    expect(classifySigningCloudMessage("already signed")).toBe("ALREADY_SIGNED");
    expect(classifySigningCloudMessage("", 78)).toBe("ALREADY_SIGNED");
    expect(classifySigningCloudMessage("", 96)).toBe("ALREADY_SIGNED");
    expect(classifySigningCloudMessage("SigningCloud request failed (result=78)", 78)).toBe(
      "ALREADY_SIGNED"
    );
  });

  it("classifies missing assets and keywords", () => {
    expect(classifySigningCloudMessage("missing stamp image")).toBe("MISSING_IMAGE");
    expect(classifySigningCloudMessage("keyword not found")).toBe("MISSING_KEYWORD");
    expect(classifySigningCloudMessage("signset is empty")).toBe("MISSING_COORDINATES");
  });

  it("classifies bounds, lock, and parameter errors", () => {
    expect(classifySigningCloudMessage("field out of bounds")).toBe("BOUNDS");
    expect(classifySigningCloudMessage("contract is locked")).toBe("CONTRACT_LOCKED");
    expect(classifySigningCloudMessage("invalid parameter", 1)).toBe("INVALID_PARAMETER");
  });

  it("builds an error without exposing extra payload", () => {
    const error = signingCloudProviderError("keyword not found", 2);
    expect(error.code).toBe("MISSING_KEYWORD");
    expect(error.result).toBe(2);
    expect(error.message).toBe("keyword not found");
  });

  it("includes the provider result when the body has no message", () => {
    const error = signingCloudProviderError("  ", 1);
    expect(error.message).toBe("SigningCloud request failed (result=1)");
    expect(error.result).toBe(1);
  });

  it("maps empty result 78 and 96 to already signed", () => {
    expect(signingCloudProviderError("  ", 78)).toMatchObject({ code: "ALREADY_SIGNED", result: 78 });
    expect(signingCloudProviderError("  ", 96)).toMatchObject({ code: "ALREADY_SIGNED", result: 96 });
  });
});
