import request from "supertest";
import express, { Request, Response, NextFunction } from "express";
import { activityRouter } from "./controller";
import { activityService } from "./service";
import { User } from "@prisma/client";

// Mock the service
jest.mock("./service");
// Mock auth middleware
jest.mock("../../lib/auth/middleware", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { user_id: "user1" } as User;
    next();
  },
}));

describe("ActivityController", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/v1/activities", activityRouter);

    // Error handler mock
    app.use((err: Error & { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
      res.status(err.statusCode || 500).json({
        success: false,
        error: { message: err.message },
      });
    });

    jest.clearAllMocks();
  });

  describe("GET /v1/activities", () => {
    it("should return activities when authenticated", async () => {
      const mockResult = {
        activities: [],
        pagination: { total: 0, page: 1, limit: 10, pages: 0 },
      };

      (activityService.getActivities as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app).get("/v1/activities");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
    });

    it("should return 400 if query validation fails", async () => {
      const response = await request(app)
        .get("/v1/activities")
        .query({ page: "invalid" });

      expect(response.status).toBe(400);
    });
  });
});
