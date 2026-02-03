import { ProductRepository } from "./repository";

const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockFindUnique = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    product: {
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      delete: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

describe("ProductRepository", () => {
  const repo = new ProductRepository();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("persists workflow to DB with version 1", async () => {
      const workflow = [
        { id: "financing_type_1", name: "Financing Type", config: { name: "Test", category: "Test", description: "Desc" } },
      ];
      mockCreate.mockResolvedValue({
        id: "prod-123",
        version: 1,
        workflow,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await repo.create({ workflow });

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          version: 1,
          workflow,
        },
      });
      expect(result.workflow).toEqual(workflow);
      expect(result.version).toBe(1);
    });
  });

  describe("update", () => {
    it("keeps version 1 on first update after create (complete workflow with assets)", async () => {
      const workflow = [
        { id: "financing_type_1", name: "Financing Type", config: { name: "Updated", image: { s3_key: "k" } } },
      ];
      mockFindUnique.mockResolvedValue({ version: 1 });
      mockUpdate.mockResolvedValue({
        id: "prod-123",
        version: 1,
        workflow,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await repo.update("prod-123", { workflow });

      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "prod-123" }, select: { version: true } });
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "prod-123" },
        data: { workflow, version: 1 },
      });
      expect(result.version).toBe(1);
    });

    it("increments version when current version is greater than 1", async () => {
      const workflow = [
        { id: "financing_type_1", name: "Financing Type", config: { name: "Updated" } },
      ];
      mockFindUnique.mockResolvedValue({ version: 2 });
      mockUpdate.mockResolvedValue({
        id: "prod-123",
        version: 3,
        workflow,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await repo.update("prod-123", { workflow });

      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "prod-123" }, select: { version: true } });
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "prod-123" },
        data: {
          workflow,
          version: { increment: 1 },
        },
      });
      expect(result.workflow).toEqual(workflow);
    });
  });
});
