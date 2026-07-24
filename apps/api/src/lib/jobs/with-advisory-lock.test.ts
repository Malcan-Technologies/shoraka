import { PrismaClient } from "@prisma/client";
import { prisma } from "../prisma";
import { closeAdvisoryLockPool, withAdvisoryLock } from "./with-advisory-lock";

const describeIntegration = process.env.DATABASE_URL ? describe : describe.skip;

describeIntegration("withAdvisoryLock", () => {
  let dbAvailable = false;

  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbAvailable = true;
    } catch {
      dbAvailable = false;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await closeAdvisoryLockPool();
  });

  it("runs fn when lock is acquired", async () => {
    if (!dbAvailable) return;

    const lockKey = 9_999_001;
    const result = await withAdvisoryLock(lockKey, async () => "ok");
    expect(result).toBe("ok");
  });

  it("returns null when lock is already held", async () => {
    if (!dbAvailable) return;

    const lockKey = 9_999_002;
    const locker = new PrismaClient();
    try {
      const rows = await locker.$queryRaw<{ pg_try_advisory_lock: boolean }[]>`
        SELECT pg_try_advisory_lock(${lockKey})
      `;
      expect(rows[0]?.pg_try_advisory_lock).toBe(true);
      const callback = jest.fn(async () => "inner");
      const second = await withAdvisoryLock(lockKey, callback);
      expect(second).toBeNull();
      expect(callback).not.toHaveBeenCalled();
    } finally {
      await locker.$queryRaw`SELECT pg_advisory_unlock(${lockKey})`;
      await locker.$disconnect();
    }
  });

  it("releases lock when callback throws", async () => {
    if (!dbAvailable) return;

    const lockKey = 9_999_003;
    await expect(
      withAdvisoryLock(lockKey, async () => {
        throw new Error("callback failure");
      })
    ).rejects.toThrow("callback failure");

    const afterError = await withAdvisoryLock(lockKey, async () => "ok-after-error");
    expect(afterError).toBe("ok-after-error");
  });

  it("propagates database errors", async () => {
    const failingPool = {
      connect: jest.fn().mockRejectedValue(new Error("db unavailable")),
    };

    await expect(withAdvisoryLock(9_999_004, async () => "ok", failingPool)).rejects.toThrow(
      "db unavailable"
    );
  });
});
