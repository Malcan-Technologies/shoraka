const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockSubmitSigningCloudEkycResult = jest.fn();
const mockResolveIssuerEkycIdentityForOrganization = jest.fn();
const mockUserFindUnique = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    signingCloudEkyc: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}));

jest.mock("./signingcloud-ekyc", () => ({
  getSigningCloudEkycSession: jest.fn(),
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

describe("EkycService.completeSession", () => {
  const sessionToken = "session-token-1";
  const userId = "user-1";
  const issuerOrganizationId = "org-issuer-1";
  const sdkResult = { status: "success", encryptedData: "encrypted-payload" };

  const pendingRecord = {
    user_id: userId,
    issuer_organization_id: issuerOrganizationId,
    status: SigningCloudEkycStatus.pending,
    completed_at: null,
    user: { email: "signer@example.com" },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdate.mockResolvedValue({});
    mockResolveIssuerEkycIdentityForOrganization.mockResolvedValue({
      name: "AHMAD ALI",
      icNumber: "901212101234",
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
      name: "AHMAD ALI",
      icNumber: "901212101234",
      token: sessionToken,
    });
  });

  it("marks session failed when userVerificationSuccess is false", async () => {
    mockFindUnique.mockResolvedValue(pendingRecord);
    mockSubmitSigningCloudEkycResult.mockResolvedValue({
      userVerificationSuccess: false,
      ekycData: {},
      message: "Success",
      raw: {},
    });

    const result = await ekycService.completeSession(sessionToken, sdkResult);

    expect(result.status).toBe("failed");
    expect(result.error).toContain("could not verify");
    expect(result.completedAt).toBeNull();
  });

  it("uses confirmed identity instead of org resolver when provided", async () => {
    mockFindUnique.mockResolvedValue(pendingRecord);
    mockSubmitSigningCloudEkycResult.mockResolvedValue({
      userVerificationSuccess: true,
      ekycData: {},
      message: "Success",
      raw: {},
    });

    const result = await ekycService.completeSession(sessionToken, sdkResult, {
      confirmedName: "Lucas Deng",
      confirmedIcNumber: "820508105871",
    });

    expect(result.status).toBe("verified");
    expect(mockResolveIssuerEkycIdentityForOrganization).not.toHaveBeenCalled();
    expect(mockSubmitSigningCloudEkycResult).toHaveBeenCalledWith({
      email: "signer@example.com",
      ekycResult: "encrypted-payload",
      name: "LUCAS DENG",
      icNumber: "820508105871",
      token: sessionToken,
    });
  });

  it("returns name/IC mismatch message when confirmed identity fails verification", async () => {
    mockFindUnique.mockResolvedValue(pendingRecord);
    mockSubmitSigningCloudEkycResult.mockResolvedValue({
      userVerificationSuccess: false,
      ekycData: {},
      message: "Success",
      raw: {},
    });

    const result = await ekycService.completeSession(sessionToken, sdkResult, {
      confirmedName: "Lucas Deng",
      confirmedIcNumber: "820508105871",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("full name matches your MyKad");
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

  it("returns resolved identity with masked IC", async () => {
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
      icNumberMasked: "820508•••871",
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
