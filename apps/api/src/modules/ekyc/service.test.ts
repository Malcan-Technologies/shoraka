const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockUpsert = jest.fn();
const mockSubmitSigningCloudEkycResult = jest.fn();
const mockGetSigningCloudEkycSession = jest.fn();
const mockResolveIssuerEkycIdentityForOrganization = jest.fn();
const mockUserFindUnique = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    signingCloudEkyc: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}));

jest.mock("./signingcloud-ekyc", () => ({
  getSigningCloudEkycSession: (...args: unknown[]) => mockGetSigningCloudEkycSession(...args),
  submitSigningCloudEkycResult: (...args: unknown[]) => mockSubmitSigningCloudEkycResult(...args),
}));

jest.mock("./resolve-issuer-ekyc-identity", () => {
  const actual = jest.requireActual<typeof import("./resolve-issuer-ekyc-identity")>(
    "./resolve-issuer-ekyc-identity"
  );
  return {
    ...actual,
    resolveIssuerEkycIdentityForOrganization: (...args: unknown[]) =>
      mockResolveIssuerEkycIdentityForOrganization(...args),
  };
});

import { SigningCloudEkycStatus } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { ekycService } from "./service";

describe("EkycService.createSession", () => {
  const userId = "user-1";
  const issuerOrganizationId = "org-issuer-1";
  const confirmedName = "Lucas Deng";

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserFindUnique.mockResolvedValue({ email: "signer@example.com" });
    mockResolveIssuerEkycIdentityForOrganization.mockResolvedValue({
      name: "LUCAS DENG",
      icNumber: "820508105871",
    });
    mockUpdate.mockResolvedValue({});
    mockUpsert.mockResolvedValue({});
    mockGetSigningCloudEkycSession.mockResolvedValue({
      url: "https://sdk.example/ekyc",
      token: "session-token-new",
    });
  });

  it("binds confirmed name and org IC when creating a new session", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await ekycService.createSession(userId, issuerOrganizationId, confirmedName);

    expect(result).toEqual({
      url: "https://sdk.example/ekyc",
      token: "session-token-new",
    });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          confirmed_name: "LUCAS DENG",
          confirmed_ic_number: "820508105871",
        }),
        update: expect.objectContaining({
          confirmed_name: "LUCAS DENG",
          confirmed_ic_number: "820508105871",
        }),
      })
    );
  });

  it("reuses a pending session when confirmed name matches", async () => {
    mockFindUnique.mockResolvedValue({
      status: SigningCloudEkycStatus.pending,
      session_token: "session-token-existing",
      sdk_endpoint: "https://sdk.example/existing",
      confirmed_name: "LUCAS DENG",
      issuer_organization_id: issuerOrganizationId,
      updated_at: new Date(),
    });

    const result = await ekycService.createSession(userId, issuerOrganizationId, confirmedName);

    expect(result).toEqual({
      url: "https://sdk.example/existing",
      token: "session-token-existing",
    });
    expect(mockGetSigningCloudEkycSession).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("rotates the session token when confirmed name changes", async () => {
    mockFindUnique.mockResolvedValue({
      status: SigningCloudEkycStatus.pending,
      session_token: "session-token-existing",
      sdk_endpoint: "https://sdk.example/existing",
      confirmed_name: "OLD NAME",
      issuer_organization_id: issuerOrganizationId,
      updated_at: new Date(),
    });

    const result = await ekycService.createSession(userId, issuerOrganizationId, confirmedName);

    expect(result.token).toBe("session-token-new");
    expect(mockGetSigningCloudEkycSession).toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalled();
  });

  it("always rotates when force is true", async () => {
    mockFindUnique.mockResolvedValue({
      status: SigningCloudEkycStatus.pending,
      session_token: "session-token-existing",
      sdk_endpoint: "https://sdk.example/existing",
      confirmed_name: "LUCAS DENG",
      issuer_organization_id: issuerOrganizationId,
      updated_at: new Date(),
    });

    const result = await ekycService.createSession(userId, issuerOrganizationId, confirmedName, {
      force: true,
    });

    expect(result.token).toBe("session-token-new");
    expect(mockGetSigningCloudEkycSession).toHaveBeenCalled();
  });
});

describe("EkycService.completeSession", () => {
  const sessionToken = "session-token-1";
  const userId = "user-1";
  const issuerOrganizationId = "org-issuer-1";
  const sdkResult = { status: "success", encryptedData: "encrypted-payload" };

  const pendingRecord = {
    user_id: userId,
    issuer_organization_id: issuerOrganizationId,
    confirmed_name: "LUCAS DENG",
    status: SigningCloudEkycStatus.pending,
    completed_at: null,
    user: { email: "signer@example.com" },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdate.mockResolvedValue({});
    mockResolveIssuerEkycIdentityForOrganization.mockResolvedValue({
      name: "LUCAS DENG",
      icNumber: "820508105871",
    });
  });

  it("marks session verified when userVerificationSuccess is true", async () => {
    mockFindUnique.mockResolvedValue(pendingRecord);
    mockSubmitSigningCloudEkycResult.mockResolvedValue({
      userVerificationSuccess: true,
      ekycData: {},
      message: "Success",
      raw: {},
    });

    const result = await ekycService.completeSession(sessionToken, sdkResult);

    expect(result.status).toBe("verified");
    expect(mockResolveIssuerEkycIdentityForOrganization).toHaveBeenCalledWith(
      userId,
      issuerOrganizationId,
      "signer@example.com"
    );
    expect(mockSubmitSigningCloudEkycResult).toHaveBeenCalledWith({
      email: "signer@example.com",
      ekycResult: "encrypted-payload",
      name: "LUCAS DENG",
      icNumber: "820508105871",
      token: sessionToken,
    });
  });

  it("marks session failed with a neutral retry message when userVerificationSuccess is false", async () => {
    mockFindUnique.mockResolvedValue(pendingRecord);
    mockSubmitSigningCloudEkycResult.mockResolvedValue({
      userVerificationSuccess: false,
      ekycData: {},
      message: "Success",
      raw: {},
    });

    const result = await ekycService.completeSession(sessionToken, sdkResult);

    expect(result.status).toBe("failed");
    expect(result.error).toContain("capture a clear photo");
    expect(result.error).toContain("Contact support");
    expect(result.completedAt).toBeNull();
  });

  it("uses stored confirmed name with org IC when submitting", async () => {
    mockFindUnique.mockResolvedValue({
      ...pendingRecord,
      confirmed_name: "LUCAS BIN DENG",
    });
    mockSubmitSigningCloudEkycResult.mockResolvedValue({
      userVerificationSuccess: true,
      ekycData: {},
      message: "Success",
      raw: {},
    });

    await ekycService.completeSession(sessionToken, sdkResult);

    expect(mockSubmitSigningCloudEkycResult).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "LUCAS BIN DENG",
        icNumber: "820508105871",
      })
    );
  });

  it("rejects complete when session has no bound issuer organization", async () => {
    mockFindUnique.mockResolvedValue({
      ...pendingRecord,
      issuer_organization_id: null,
    });

    await expect(ekycService.completeSession(sessionToken, sdkResult)).rejects.toMatchObject({
      code: "EKYC_SESSION_ORG_MISSING",
    });

    expect(mockSubmitSigningCloudEkycResult).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { user_id: userId },
      data: expect.objectContaining({
        status: SigningCloudEkycStatus.error,
      }),
    });
  });

  it("rejects complete when session has no bound confirmed name", async () => {
    mockFindUnique.mockResolvedValue({
      ...pendingRecord,
      confirmed_name: null,
    });

    await expect(ekycService.completeSession(sessionToken, sdkResult)).rejects.toMatchObject({
      code: "EKYC_SESSION_IDENTITY_MISSING",
    });

    expect(mockSubmitSigningCloudEkycResult).not.toHaveBeenCalled();
  });

  it("marks session error when submitResult throws", async () => {
    mockFindUnique.mockResolvedValue(pendingRecord);
    mockSubmitSigningCloudEkycResult.mockRejectedValue(
      new AppError(502, "SIGNINGCLOUD_EKYC_SUBMIT_FAILED", "Submit failed")
    );

    await expect(ekycService.completeSession(sessionToken, sdkResult)).rejects.toThrow(AppError);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { user_id: userId },
      data: expect.objectContaining({
        status: SigningCloudEkycStatus.error,
      }),
    });
  });

  it("returns existing verified session without re-submitting", async () => {
    mockFindUnique.mockResolvedValue({
      ...pendingRecord,
      status: SigningCloudEkycStatus.verified,
      completed_at: new Date("2026-06-16T00:00:00.000Z"),
    });

    const result = await ekycService.completeSession(sessionToken, sdkResult);

    expect(result.status).toBe("verified");
    expect(mockSubmitSigningCloudEkycResult).not.toHaveBeenCalled();
  });
});

describe("EkycService.getIdentityPreview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns resolved identity with full IC for confirmation", async () => {
    mockUserFindUnique.mockResolvedValue({ email: "signer@example.com" });
    mockResolveIssuerEkycIdentityForOrganization.mockResolvedValue({
      name: "LUCAS DENG",
      icNumber: "820508105871",
    });

    await expect(
      ekycService.getIdentityPreview("user-1", "org-issuer-1")
    ).resolves.toEqual({
      name: "LUCAS DENG",
      icNumber: "820508105871",
    });
  });
});

describe("EkycService.getMeStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reports completed only when status is verified", async () => {
    mockFindUnique.mockResolvedValue({
      status: SigningCloudEkycStatus.verified,
      completed_at: new Date("2026-06-16T00:00:00.000Z"),
    });

    await expect(ekycService.getMeStatus("user-1")).resolves.toEqual({
      completed: true,
      completedAt: "2026-06-16T00:00:00.000Z",
    });

    mockFindUnique.mockResolvedValue({
      status: SigningCloudEkycStatus.failed,
      completed_at: null,
    });

    await expect(ekycService.getMeStatus("user-1")).resolves.toEqual({
      completed: false,
      completedAt: null,
    });
  });
});
