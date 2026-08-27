import {
  decryptSigningCloudResponse,
  encryptPayload,
  parseSigningCloudHttpBody,
} from "./crypto";

describe("parseSigningCloudHttpBody", () => {
  it("throws a clear error for an empty body", () => {
    expect(() => parseSigningCloudHttpBody("", 200)).toThrow(
      "SigningCloud returned an empty response (HTTP 200)"
    );
  });

  it("throws a clear error for non-JSON", () => {
    expect(() => parseSigningCloudHttpBody("<html></html>", 502)).toThrow(
      "SigningCloud returned a non-JSON response (HTTP 502)"
    );
  });

  it("parses a JSON envelope", () => {
    expect(parseSigningCloudHttpBody('{"result":0,"message":"ok","data":"aa","mac":"bb"}', 200)).toEqual(
      { result: 0, message: "ok", data: "aa", mac: "bb" }
    );
  });
});

describe("decryptSigningCloudResponse", () => {
  it("throws when the decrypted payload is empty", () => {
    const { data, mac } = encryptPayload("", "secret");
    expect(() =>
      decryptSigningCloudResponse({ result: 0, message: "", data, mac }, "secret")
    ).toThrow("SigningCloud decrypted payload was empty");
  });

  it("round-trips a JSON object", () => {
    const { data, mac } = encryptPayload(JSON.stringify({ at: "token" }), "secret");
    expect(decryptSigningCloudResponse({ result: 0, message: "ok", data, mac }, "secret")).toEqual({
      at: "token",
    });
  });
});
