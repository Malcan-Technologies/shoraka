import { prisma } from "../prisma";
import { withAdvisoryLock } from "./with-advisory-lock";

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
    const first = await withAdvisoryLock(lockKey, async () => {
      const second = await withAdvisoryLock(lockKey, async () => "inner");
      expect(second).toBeNull();
      return "outer";
    });
    expect(first).toBe("outer");
  });
});
