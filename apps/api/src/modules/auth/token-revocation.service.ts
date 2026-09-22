import { RevokedAccessTokenRepository } from "./revoked-access-token.repository";

export class AccessTokenRevocationService {
  constructor(private readonly repository = new RevokedAccessTokenRepository()) {}

  async isRevoked(jti: string | undefined): Promise<boolean> {
    if (!jti) return false;
    return this.repository.existsUnexpired(jti);
  }

  async revokeCurrentToken(params: { jti?: string; userId: string; exp?: number }): Promise<void> {
    const now = new Date();
    if (!params.jti || typeof params.exp !== "number") {
      await this.repository.deleteExpired(now);
      return;
    }

    await this.repository.revokeAndPurgeExpired({
      jti: params.jti,
      userId: params.userId,
      expiresAt: new Date(params.exp * 1000),
      now,
    });
  }
}

export const accessTokenRevocationService = new AccessTokenRevocationService();
