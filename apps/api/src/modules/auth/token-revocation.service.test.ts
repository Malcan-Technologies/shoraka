import { AccessTokenRevocationService } from "./token-revocation.service";

describe("AccessTokenRevocationService", () => {
  const existsUnexpired = jest.fn();
  const revokeAndPurgeExpired = jest.fn();
  const deleteExpired = jest.fn();
  const service = new AccessTokenRevocationService({
    existsUnexpired,
    revokeAndPurgeExpired,
    deleteExpired,
  } as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("treats a missing jti as not revoked", async () => {
    await expect(service.isRevoked(undefined)).resolves.toBe(false);
    expect(existsUnexpired).not.toHaveBeenCalled();
  });

  it("looks up unexpired denylist rows by jti", async () => {
    existsUnexpired.mockResolvedValue(true);
    await expect(service.isRevoked("jti-1")).resolves.toBe(true);
    expect(existsUnexpired).toHaveBeenCalledWith("jti-1");
  });

  it("records jti until exp and purges expired rows", async () => {
    revokeAndPurgeExpired.mockResolvedValue(undefined);
    await service.revokeCurrentToken({
      jti: "jti-1",
      userId: "ABCDE",
      exp: 1_700_000_000,
    });
    expect(revokeAndPurgeExpired).toHaveBeenCalledWith(
      expect.objectContaining({
        jti: "jti-1",
        userId: "ABCDE",
        expiresAt: new Date(1_700_000_000 * 1000),
      })
    );
  });

  it("still purges expired rows when the token has no jti", async () => {
    deleteExpired.mockResolvedValue(0);
    await service.revokeCurrentToken({ userId: "ABCDE" });
    expect(revokeAndPurgeExpired).not.toHaveBeenCalled();
    expect(deleteExpired).toHaveBeenCalled();
  });

  it("makes a previously valid jti rejectable after logout recording", async () => {
    const store = new Map<string, Date>();
    const memoryService = new AccessTokenRevocationService({
      existsUnexpired: async (jti: string, now = new Date()) => {
        const expiresAt = store.get(jti);
        return Boolean(expiresAt && expiresAt > now);
      },
      revokeAndPurgeExpired: async (params: { jti: string; expiresAt: Date }) => {
        store.set(params.jti, params.expiresAt);
      },
      deleteExpired: async () => 0,
    } as never);

    await expect(memoryService.isRevoked("jti-live")).resolves.toBe(false);
    await memoryService.revokeCurrentToken({
      jti: "jti-live",
      userId: "ABCDE",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    await expect(memoryService.isRevoked("jti-live")).resolves.toBe(true);
  });
});
