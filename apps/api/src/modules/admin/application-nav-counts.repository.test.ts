const mockQueryRaw = jest.fn();
const mockProductFindMany = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
    product: {
      findMany: (...args: unknown[]) => mockProductFindMany(...args),
    },
  },
}));

import { AdminRepository } from "./repository";

describe("AdminRepository.getApplicationNavCounts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryRaw.mockResolvedValue([]);
    mockProductFindMany.mockResolvedValue([]);
  });

  it("excludes archived applications from the grouped counts", async () => {
    await new AdminRepository().getApplicationNavCounts();

    const sql = mockQueryRaw.mock.calls[0]?.[0] as { strings?: readonly string[] };
    const text = Array.isArray(sql?.strings) ? sql.strings.join(" ") : String(sql);
    expect(text).toContain("WHERE status::text <>");
    expect(text).toContain("FROM applications");
  });
});
