import { prisma } from "../../lib/prisma";

export class RevokedAccessTokenRepository {
  async existsUnexpired(jti: string, now = new Date()): Promise<boolean> {
    const row = await prisma.revokedAccessToken.findUnique({
      where: { jti },
      select: { expires_at: true },
    });
    return Boolean(row && row.expires_at > now);
  }

  async revokeAndPurgeExpired(params: {
    jti: string;
    userId: string;
    expiresAt: Date;
    now?: Date;
  }): Promise<void> {
    const now = params.now ?? new Date();
    await prisma.$transaction([
      prisma.revokedAccessToken.deleteMany({
        where: { expires_at: { lt: now } },
      }),
      prisma.revokedAccessToken.upsert({
        where: { jti: params.jti },
        create: {
          jti: params.jti,
          user_id: params.userId,
          expires_at: params.expiresAt,
        },
        update: {
          user_id: params.userId,
          expires_at: params.expiresAt,
        },
      }),
    ]);
  }

  async deleteExpired(now = new Date()): Promise<number> {
    const result = await prisma.revokedAccessToken.deleteMany({
      where: { expires_at: { lt: now } },
    });
    return result.count;
  }
}
