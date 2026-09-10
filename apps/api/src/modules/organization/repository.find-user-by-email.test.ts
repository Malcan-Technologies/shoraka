const mockFindFirst = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

import { OrganizationRepository } from "./repository";

describe("OrganizationRepository.findUserByEmail", () => {
  const repository = new OrganizationRepository();

  beforeEach(() => {
    mockFindFirst.mockReset();
  });

  it("looks up existing users with trim, lowercase, and case-insensitive match", async () => {
    mockFindFirst.mockResolvedValueOnce({
      user_id: "AAAAA",
      email: "Darren@Example.com",
      first_name: "Darren",
      last_name: "Lee",
    });
    await repository.findUserByEmail("  Darren@Example.com ");
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { email: { equals: "darren@example.com", mode: "insensitive" } },
      select: {
        user_id: true,
        email: true,
        first_name: true,
        last_name: true,
      },
    });
  });

  it("does not query when the normalized email is empty", async () => {
    await expect(repository.findUserByEmail("   ")).resolves.toBeNull();
    expect(mockFindFirst).not.toHaveBeenCalled();
  });
});
