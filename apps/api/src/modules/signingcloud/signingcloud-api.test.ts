import { decryptSigningCloudResponse } from "../../lib/signingcloud/crypto";
import {
  extractSigningUrlFromManualSigningResponse,
  signingCloudAccessTokenTtlMs,
  isSigningCloudSealFieldEnabled,
  autoSignContract,
  uploadSignerStampImage,
  assertAutomaticSignsetJson,
} from "./signingcloud-api";
import { SigningCloudProviderError } from "./signingcloud-errors";

describe("extractSigningUrlFromManualSigningResponse", () => {
  it("reads nested previewurl", () => {
    expect(
      extractSigningUrlFromManualSigningResponse({
        data: { previewurl: "https://sign.example/session" },
      })
    ).toBe("https://sign.example/session");
  });

  it("returns null when no URL is present", () => {
    expect(extractSigningUrlFromManualSigningResponse({ result: 0 })).toBeNull();
  });
});

describe("signingCloudAccessTokenTtlMs", () => {
  const prev = process.env.SC_ACCESS_TOKEN_TTL_MS;

  afterEach(() => {
    if (prev === undefined) delete process.env.SC_ACCESS_TOKEN_TTL_MS;
    else process.env.SC_ACCESS_TOKEN_TTL_MS = prev;
  });

  it("defaults to 25 minutes", () => {
    delete process.env.SC_ACCESS_TOKEN_TTL_MS;
    expect(signingCloudAccessTokenTtlMs()).toBe(25 * 60 * 1000);
  });

  it("honours a valid override", () => {
    process.env.SC_ACCESS_TOKEN_TTL_MS = "120000";
    expect(signingCloudAccessTokenTtlMs()).toBe(120000);
  });
});

describe("isSigningCloudSealFieldEnabled", () => {
  const prev = process.env.SC_ENABLE_SEAL_FIELD;

  afterEach(() => {
    if (prev === undefined) delete process.env.SC_ENABLE_SEAL_FIELD;
    else process.env.SC_ENABLE_SEAL_FIELD = prev;
  });

  it("defaults to enabled when unset", () => {
    delete process.env.SC_ENABLE_SEAL_FIELD;
    expect(isSigningCloudSealFieldEnabled()).toBe(true);
  });

  it("stays enabled for any value other than false", () => {
    process.env.SC_ENABLE_SEAL_FIELD = "true";
    expect(isSigningCloudSealFieldEnabled()).toBe(true);
    process.env.SC_ENABLE_SEAL_FIELD = "1";
    expect(isSigningCloudSealFieldEnabled()).toBe(true);
    process.env.SC_ENABLE_SEAL_FIELD = "";
    expect(isSigningCloudSealFieldEnabled()).toBe(true);
  });

  it("disables only when set to false", () => {
    process.env.SC_ENABLE_SEAL_FIELD = "false";
    expect(isSigningCloudSealFieldEnabled()).toBe(false);
    process.env.SC_ENABLE_SEAL_FIELD = "FALSE";
    expect(isSigningCloudSealFieldEnabled()).toBe(false);
    process.env.SC_ENABLE_SEAL_FIELD = " False ";
    expect(isSigningCloudSealFieldEnabled()).toBe(false);
  });
});

describe("mixed signing local provider guards", () => {
  const cfg = { baseUrl: "https://sc.example", apiKey: "k", apiSecret: "s" };

  it("rejects an empty stamp without sending image hex", async () => {
    await expect(
      uploadSignerStampImage({
        cfg,
        accessToken: "t",
        signerEmail: "a@b.c",
        imageBytes: Buffer.alloc(0),
        contentType: "image/png",
      })
    ).rejects.toMatchObject({ code: "MISSING_IMAGE" });
  });

  it("sends stamp bytes as img hex and accepts Success with no encrypted payload", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      url: "https://sc.example/signserver/v1/user/stampimg",
      headers: { get: () => "application/json" },
      text: async () => JSON.stringify({ result: 0, message: "Success" }),
    });
    const previousFetch = global.fetch;
    global.fetch = fetchMock as typeof fetch;
    try {
      await expect(
        uploadSignerStampImage({
          cfg: { ...cfg, apiSecret: "secret-for-tests" },
          accessToken: "t",
          signerEmail: "a@b.c",
          imageBytes: png,
          contentType: "image/png",
        })
      ).resolves.toEqual({});
    } finally {
      global.fetch = previousFetch;
    }
    const init = fetchMock.mock.calls[0]?.[1] as { body: string };
    const params = new URLSearchParams(init.body);
    const decrypted = decryptSigningCloudResponse<Record<string, unknown>>(
      { result: 0, message: "", data: params.get("data") ?? "", mac: params.get("mac") ?? "" },
      "secret-for-tests"
    );
    expect(decrypted).toEqual({
      email: "a@b.c",
      img: png.toString("hex"),
      imgtype: "png",
    });
    expect(decrypted).not.toHaveProperty("stampimg");
  });

  it("rejects a missing automatic-sign keyword", async () => {
    await expect(
      autoSignContract({
        cfg,
        accessToken: "t",
        contractnum: "1",
        signerEmail: "ops@cashsouk.com",
        keyword: "  ",
        signatureImageBytes: Buffer.from("png"),
        widthPx: 100,
        heightPx: 40,
      })
    ).rejects.toBeInstanceOf(SigningCloudProviderError);
  });

  it.each([78, 96])("treats /signature/auto result %s as alreadySigned", async (result) => {
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      url: "https://sc.example/signserver/v1/contract/signature/auto",
      headers: { get: () => "application/json" },
      text: async () => JSON.stringify({ result, message: "" }),
    });
    const previousFetch = global.fetch;
    global.fetch = fetchMock as typeof fetch;
    try {
      await expect(
        autoSignContract({
          cfg,
          accessToken: "t",
          contractnum: "ABC",
          signerEmail: "ops@cashsouk.com",
          keyword: "CASHSOUK_FA_AGENT_1",
          signatureImageBytes: Buffer.from("png"),
          widthPx: 80,
          heightPx: 30,
        })
      ).resolves.toEqual({ alreadySigned: true, raw: null });
    } finally {
      global.fetch = previousFetch;
    }
  });

  it("sends signkeyword, datekeyword, and date format on /signature/auto", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const fetchMock = jest.fn().mockResolvedValue({
      status: 200,
      url: "https://sc.example/signserver/v1/contract/signature/auto",
      headers: { get: () => "application/json" },
      text: async () => JSON.stringify({ result: 0, message: "Success" }),
    });
    const previousFetch = global.fetch;
    global.fetch = fetchMock as typeof fetch;
    try {
      await expect(
        autoSignContract({
          cfg: { ...cfg, apiSecret: "secret-for-tests" },
          accessToken: "t",
          contractnum: "ABC",
          signerEmail: "ops@cashsouk.com",
          keyword: "CASHSOUK_FA_SPAISHA_SIGN",
          dateKeyword: "CASHSOUK_FA_SPAISHA_DATE",
          dateFormat: "dd/MM/yyyy",
          signatureImageBytes: png,
          widthPx: 80,
          heightPx: 30,
        })
      ).resolves.toEqual({ alreadySigned: false, raw: {} });
    } finally {
      global.fetch = previousFetch;
    }
    const url = fetchMock.mock.calls[0]?.[0] as string;
    const init = fetchMock.mock.calls[0]?.[1] as { body: string };
    const params = new URLSearchParams(init.body);
    const decrypted = decryptSigningCloudResponse<Record<string, unknown>>(
      { result: 0, message: "", data: params.get("data") ?? "", mac: params.get("mac") ?? "" },
      "secret-for-tests"
    );
    expect(url).toContain("/signserver/v1/contract/signature/auto?");
    expect(url).toContain("signkeyword=CASHSOUK_FA_SPAISHA_SIGN");
    expect(url).toContain("datekeyword=CASHSOUK_FA_SPAISHA_DATE");
    expect(params.get("signkeyword")).toBe("CASHSOUK_FA_SPAISHA_SIGN");
    expect(params.get("datekeyword")).toBe("CASHSOUK_FA_SPAISHA_DATE");
    expect(params.get("dateformat")).toBe("dd/MM/yyyy");
    expect(decrypted).toMatchObject({
      contractnum: "ABC",
      signerInfo: {
        email: "ops@cashsouk.com",
        keyword: "CASHSOUK_FA_SPAISHA_SIGN",
        signkeyword: "CASHSOUK_FA_SPAISHA_SIGN",
        scSignkeyword: "CASHSOUK_FA_SPAISHA_SIGN",
        datekeyword: "CASHSOUK_FA_SPAISHA_DATE",
        dateformat: "dd/MM/yyyy",
      },
      signkeyword: "CASHSOUK_FA_SPAISHA_SIGN",
      datekeyword: "CASHSOUK_FA_SPAISHA_DATE",
      dateformat: "dd/MM/yyyy",
      signimg: png.toString("hex"),
      imgwidth: 80,
      imgheight: 30,
    });
  });
});

describe("assertAutomaticSignsetJson", () => {
  it("rejects an empty automatic signset before file2", () => {
    expect(() => assertAutomaticSignsetJson("[]")).toThrow(/Missing signature attribute/);
    expect(() => assertAutomaticSignsetJson(undefined)).toThrow(/Missing signature attribute/);
  });

  it("accepts a sign field", () => {
    expect(
      assertAutomaticSignsetJson(
        JSON.stringify([{ fieldtype: "sign", top: 100, left: 40, width: 120, height: 36, pageindex: 1 }])
      )
    ).toContain("sign");
  });

  it("rounds fractional coordinates so file2 does not 404", () => {
    expect(
      JSON.parse(
        assertAutomaticSignsetJson(
          JSON.stringify([
            {
              fieldtype: "sign",
              top: 145.2,
              left: 78.6,
              width: 120.4,
              height: 36.1,
              pageindex: 44.2,
            },
          ])
        )
      )
    ).toEqual([
      { fieldtype: "sign", top: 145, left: 79, width: 120, height: 36, pageindex: 44 },
    ]);
  });
});
