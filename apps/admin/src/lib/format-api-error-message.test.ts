import { formatApiErrorMessage } from "./format-api-error-message";

describe("formatApiErrorMessage", () => {
  it("keeps known CTOS errors as their API message, not Internal error", () => {
    expect(
      formatApiErrorMessage({
        code: "CTOS_MISSING_SUBJECT_IDENTIFIER",
        message:
          "CTOS cannot be fetched because the company registration/SSM number is not available yet.",
      })
    ).toBe(
      "CTOS cannot be fetched because the company registration/SSM number is not available yet."
    );
  });

  it("does not append SOAP or upstream details", () => {
    expect(
      formatApiErrorMessage({
        code: "CTOS_PROVIDER_ERROR",
        message: "CTOS is temporarily unavailable. Please try again later.",
        details: { upstreamMessage: "SOAP Fault: Invalid XML" },
      })
    ).toBe("CTOS is temporarily unavailable. Please try again later.");
  });
});
