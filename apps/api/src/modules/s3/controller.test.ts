import { parseApplicationIdFromS3Key } from "./controller";

describe("parseApplicationIdFromS3Key", () => {
  it("extracts application id from application-scoped keys", () => {
    expect(
      parseApplicationIdFromS3Key("applications/clxxxxxxxxxxxxxxxxxxxx/signing/env1/signed/doc.pdf")
    ).toBe("clxxxxxxxxxxxxxxxxxxxx");
    expect(
      parseApplicationIdFromS3Key("applications/clxxxxxxxxxxxxxxxxxxxx/v1-2026-07-21-abc.png")
    ).toBe("clxxxxxxxxxxxxxxxxxxxx");
  });

  it("returns null for non-application keys", () => {
    expect(parseApplicationIdFromS3Key("products/foo/bar.pdf")).toBeNull();
    expect(parseApplicationIdFromS3Key("applications")).toBeNull();
    expect(parseApplicationIdFromS3Key("")).toBeNull();
  });
});
