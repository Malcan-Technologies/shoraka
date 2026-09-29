import * as fs from "fs";
import * as path from "path";
import request from "supertest";
import express, { NextFunction, Request, Response } from "express";

const mockFindAll = jest.fn();
const mockFindById = jest.fn();

jest.mock("./repository", () => ({
  ProductRepository: jest.fn().mockImplementation(() => ({
    findAll: (...args: unknown[]) => mockFindAll(...args),
    findById: (...args: unknown[]) => mockFindById(...args),
  })),
}));
jest.mock("./product-family", () => ({
  getLockedProductCodes: jest.fn().mockResolvedValue(new Set<string>()),
}));
jest.mock("../../lib/prisma", () => ({ prisma: {} }));

import { productsRouter } from "./controller";

const CONTROLLER = fs.readFileSync(path.join(__dirname, "controller.ts"), "utf8");

function appWith(permissions: string[]) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.user = { user_id: "admin-1", roles: ["ADMIN"] } as unknown as Request["user"];
    req.admin = { user_id: "admin-1" } as unknown as Request["admin"];
    req.adminRoleKey = "TEST_ROLE";
    req.adminPermissions = permissions as Request["adminPermissions"];
    next();
  });
  app.use("/v1/products", productsRouter);
  app.use((err: Error & { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.statusCode || 500).json({ success: false, error: { message: err.message } });
  });
  return app;
}

describe("products read permissions (application navigation)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const product = {
      id: "prod-1",
      product_code: null,
      created_at: new Date("2026-01-01T00:00:00.000Z"),
      updated_at: new Date("2026-01-01T00:00:00.000Z"),
    };
    mockFindAll.mockResolvedValue({ products: [product], total: 1 });
    mockFindById.mockResolvedValue(product);
  });

  it.each([["products.view"], ["applications.view"]])(
    "allows %s to list and read products",
    async (permission) => {
      const app = appWith([permission]);
      expect((await request(app).get("/v1/products")).status).toBe(200);
      expect((await request(app).get("/v1/products/prod-1")).status).toBe(200);
    }
  );

  it("denies product reads without products.view or applications.view", async () => {
    const app = appWith(["notes.view", "applications.manage"]);
    expect((await request(app).get("/v1/products")).status).toBe(403);
    expect((await request(app).get("/v1/products/prod-1")).status).toBe(403);
    expect(mockFindAll).not.toHaveBeenCalled();
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it("does not let applications.view or products.view write products", async () => {
    const app = appWith(["applications.view", "products.view"]);
    expect((await request(app).post("/v1/products").send({})).status).toBe(403);
    expect((await request(app).patch("/v1/products/prod-1").send({})).status).toBe(403);
    expect((await request(app).delete("/v1/products/prod-1")).status).toBe(403);
  });

  it("keeps every product write route on products.manage", () => {
    const writes = [...CONTROLLER.matchAll(/router\.(post|patch|put|delete)\(\s*"([^"]+)",\s*([^,]+),/g)];
    expect(writes.length).toBeGreaterThanOrEqual(4);
    for (const [, method, route, guard] of writes) {
      expect(`${method} ${route} ${guard.trim()}`).toBe(
        `${method} ${route} requirePermission("products.manage")`
      );
    }
    expect(CONTROLLER).toContain(
      'requireAnyPermission("products.view", "applications.view")'
    );
  });
});
