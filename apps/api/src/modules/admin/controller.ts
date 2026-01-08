import { Router, Request, Response, NextFunction } from "express";
import { AdminService } from "./service";
import { AppError } from "../../lib/http/error-handler";
import { requireRole } from "../../lib/auth/middleware";
import { UserRole } from "@prisma/client";
import {
  getUsersQuerySchema,
  getAccessLogsQuerySchema,
  updateUserRolesSchema,
  updateUserOnboardingSchema,
  updateUserProfileSchema,
  updateUserIdSchema,
  exportAccessLogsQuerySchema,
  getAdminUsersQuerySchema,
  updateAdminRoleSchema,
  inviteAdminSchema,
  acceptInvitationSchema,
  getSecurityLogsQuerySchema,
  getPendingInvitationsQuerySchema,
  getOnboardingLogsQuerySchema,
  exportOnboardingLogsQuerySchema,
  exportSecurityLogsQuerySchema,
  resetOnboardingSchema,
  getOrganizationsQuerySchema,
  getOnboardingApplicationsQuerySchema,
  updateSophisticatedStatusSchema,
} from "./schemas";

const router = Router();
const adminService = new AdminService();

/**
 * @swagger
 * /v1/admin/users:
 *   get:
 *     summary: List users with pagination and filters (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: role
 *         schema:
 *           $ref: '#/components/schemas/UserRole'
 *       - in: query
 *         name: kycVerified
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Users list with pagination
 */
router.get(
  "/users",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = getUsersQuerySchema.parse(req.query);
      const result = await adminService.listUsers(validated);

      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error instanceof Error ? new AppError(400, "VALIDATION_ERROR", error.message) : error);
    }
  }
);

/**
 * @swagger
 * /v1/admin/users/:id:
 *   get:
 *     summary: Get user by ID (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 */
router.get(
  "/users/:id",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = await adminService.getUserById(id);

      if (!user) {
        throw new AppError(404, "NOT_FOUND", "User not found");
      }

      res.json({
        success: true,
        data: { user },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(
        error instanceof AppError
          ? error
          : new AppError(500, "INTERNAL_ERROR", "Failed to fetch user")
      );
    }
  }
);

/**
 * @swagger
 * /v1/admin/users/:id/roles:
 *   patch:
 *     summary: Update user roles (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 */
router.patch(
  "/users/:id/roles",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const validated = updateUserRolesSchema.parse(req.body);

      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      const updatedUser = await adminService.updateUserRoles(req, id, validated, req.user.user_id);

      res.json({
        success: true,
        data: { user: updatedUser },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(
        error instanceof AppError
          ? error
          : new AppError(
              400,
              "VALIDATION_ERROR",
              error instanceof Error ? error.message : "Failed to update user roles"
            )
      );
    }
  }
);

/**
 * @swagger
 * /v1/admin/users/:id/onboarding:
 *   patch:
 *     summary: Update user onboarding status (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 */
router.patch(
  "/users/:id/onboarding",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const validated = updateUserOnboardingSchema.parse(req.body);

      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      const updatedUser = await adminService.updateUserOnboarding(
        req,
        id,
        validated,
        req.user.user_id
      );

      res.json({
        success: true,
        data: { user: updatedUser },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(
        error instanceof AppError
          ? error
          : new AppError(
              400,
              "VALIDATION_ERROR",
              error instanceof Error ? error.message : "Failed to update onboarding status"
            )
      );
    }
  }
);

/**
 * @swagger
 * /v1/admin/users/:id/profile:
 *   patch:
 *     summary: Update user profile (name, phone) (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 */
router.patch(
  "/users/:id/profile",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const validated = updateUserProfileSchema.parse(req.body);

      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      const updatedUser = await adminService.updateUserProfile(
        req,
        id,
        validated,
        req.user.user_id
      );

      res.json({
        success: true,
        data: { user: updatedUser },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(
        error instanceof AppError
          ? error
          : new AppError(
              400,
              "VALIDATION_ERROR",
              error instanceof Error ? error.message : "Failed to update user profile"
            )
      );
    }
  }
);

/**
 * @swagger
 * /v1/admin/dashboard/stats:
 *   get:
 *     summary: Get dashboard statistics (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics including user counts and trends
 */
router.get(
  "/dashboard/stats",
  requireRole(UserRole.ADMIN),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await adminService.getDashboardStats();

      res.json({
        success: true,
        data: stats,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(
        error instanceof AppError
          ? error
          : new AppError(500, "INTERNAL_ERROR", "Failed to fetch dashboard statistics")
      );
    }
  }
);

/**
 * @swagger
 * /v1/admin/organizations:
 *   get:
 *     summary: List all organizations with pagination and filters (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: portal
 *         schema:
 *           type: string
 *           enum: [investor, issuer]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [PERSONAL, COMPANY]
 *       - in: query
 *         name: onboardingStatus
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED]
 *     responses:
 *       200:
 *         description: Organizations list with pagination
 */
router.get(
  "/organizations",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = getOrganizationsQuerySchema.parse(req.query);
      const result = await adminService.getOrganizations(validated);

      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error instanceof Error ? new AppError(400, "VALIDATION_ERROR", error.message) : error);
    }
  }
);

/**
 * @swagger
 * /v1/admin/organizations/{portal}/{id}:
 *   get:
 *     summary: Get organization details by portal type and ID (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: portal
 *         required: true
 *         schema:
 *           type: string
 *           enum: [investor, issuer]
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Organization details
 *       404:
 *         description: Organization not found
 */
router.get(
  "/organizations/:portal/:id",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { portal, id } = req.params;

      if (portal !== "investor" && portal !== "issuer") {
        throw new AppError(400, "VALIDATION_ERROR", "Portal must be 'investor' or 'issuer'");
      }

      const result = await adminService.getOrganizationDetail(portal, id);

      if (!result) {
        throw new AppError(404, "NOT_FOUND", "Organization not found");
      }

      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(
        error instanceof AppError
          ? error
          : error instanceof Error
            ? new AppError(400, "VALIDATION_ERROR", error.message)
            : error
      );
    }
  }
);

/**
 * @swagger
 * /v1/admin/organizations/investor/{id}/sophisticated-status:
 *   patch:
 *     summary: Update sophisticated investor status (admin only)
 *     description: Manually update the sophisticated investor classification for an investor organization
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Investor organization ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isSophisticatedInvestor
 *             properties:
 *               isSophisticatedInvestor:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Organization not found
 */
router.patch(
  "/organizations/investor/:id/sophisticated-status",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const validated = updateSophisticatedStatusSchema.parse(req.body);
      const adminUserId = res.locals.userId as string | undefined;

      const result = await adminService.updateSophisticatedStatus(
        id,
        validated.isSophisticatedInvestor,
        validated.reason,
        adminUserId
      );

      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(
        error instanceof AppError
          ? error
          : error instanceof Error
            ? new AppError(400, "VALIDATION_ERROR", error.message)
            : error
      );
    }
  }
);

/**
 * @swagger
 * /v1/admin/access-logs:
 *   get:
 *     summary: List access logs with pagination and filters (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 */
router.get(
  "/access-logs",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = getAccessLogsQuerySchema.parse(req.query);
      const result = await adminService.listAccessLogs(validated);

      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error instanceof Error ? new AppError(400, "VALIDATION_ERROR", error.message) : error);
    }
  }
);

/**
 * @swagger
 * /v1/admin/access-logs/export:
 *   get:
 *     summary: Export access logs as CSV or JSON (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 */
router.get(
  "/access-logs/export",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = exportAccessLogsQuerySchema.parse(req.query);
      const { format, ...filterParams } = validated;

      const logs = await adminService.exportAccessLogs(filterParams);

      if (format === "csv") {
        // Generate CSV
        const headers = [
          "Timestamp",
          "User",
          "Email",
          "Event Type",
          "IP Address",
          "Device",
          "Status",
          "Metadata",
        ];
        const rows = logs.map((log) => [
          log.created_at.toISOString(),
          `${log.user.first_name} ${log.user.last_name}`,
          log.user.email,
          log.event_type,
          log.ip_address || "",
          log.device_type || "",
          log.success ? "Success" : "Failed",
          JSON.stringify(log.metadata || {}),
        ]);

        const csvContent = [
          headers.join(","),
          ...rows.map((row) =>
            row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
          ),
        ].join("\n");

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="access-logs-${new Date().toISOString().split("T")[0]}.csv"`
        );
        res.send(Buffer.from(csvContent, "utf-8"));
      } else {
        // JSON format - return raw JSON array, not wrapped in API response
        const jsonData = logs.map((log) => ({
          id: log.id,
          user_id: log.user_id,
          user: {
            first_name: log.user.first_name,
            last_name: log.user.last_name,
            email: log.user.email,
            roles: log.user.roles,
          },
          event_type: log.event_type,
          portal: log.portal,
          ip_address: log.ip_address,
          user_agent: log.user_agent,
          device_info: log.device_info,
          device_type: log.device_type,
          success: log.success,
          metadata: log.metadata,
          created_at: log.created_at.toISOString(),
        }));

        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="access-logs-${new Date().toISOString().split("T")[0]}.json"`
        );
        res.json(jsonData); // Return raw JSON array, not wrapped
      }
    } catch (error) {
      next(error instanceof Error ? new AppError(400, "VALIDATION_ERROR", error.message) : error);
    }
  }
);

/**
 * @swagger
 * /v1/admin/access-logs/:id:
 *   get:
 *     summary: Get access log by ID (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 */
router.get(
  "/access-logs/:id",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const log = await adminService.getAccessLogById(id);

      if (!log) {
        throw new AppError(404, "NOT_FOUND", "Access log not found");
      }

      res.json({
        success: true,
        data: { log },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(
        error instanceof AppError
          ? error
          : new AppError(500, "INTERNAL_ERROR", "Failed to fetch access log")
      );
    }
  }
);

/**
 * @swagger
 * /v1/admin/users/{id}/user-id:
 *   patch:
 *     summary: Update a user's 5-letter ID (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId:
 *                 type: string
 *                 pattern: ^[A-Z]{5}$
 *     responses:
 *       200:
 *         description: User ID updated successfully
 *       404:
 *         description: User not found
 *       409:
 *         description: User ID already assigned to another user
 */
router.patch(
  "/users/:id/user-id",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const validated = updateUserIdSchema.parse(req.body);

      const result = await adminService.updateUserId(id, validated.userId);

      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /v1/admin/admin-users:
 *   get:
 *     summary: Get admin users list (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 */
router.get(
  "/admin-users",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = getAdminUsersQuerySchema.parse(req.query);
      const result = await adminService.getAdminUsers(validated);

      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error instanceof Error ? new AppError(400, "VALIDATION_ERROR", error.message) : error);
    }
  }
);

/**
 * @swagger
 * /v1/admin/admin-users/:id/role:
 *   put:
 *     summary: Update admin role description (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 */
router.put(
  "/admin-users/:id/role",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const validated = updateAdminRoleSchema.parse(req.body);

      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      const result = await adminService.updateAdminRole(req, id, validated, req.user.user_id);

      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /v1/admin/admin-users/:id/deactivate:
 *   put:
 *     summary: Deactivate admin user (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 */
router.put(
  "/admin-users/:id/deactivate",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      const result = await adminService.deactivateAdmin(req, id, req.user.user_id);

      res.json({
        success: true,
        data: { user: result },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /v1/admin/admin-users/:id/reactivate:
 *   put:
 *     summary: Reactivate admin user (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 */
router.put(
  "/admin-users/:id/reactivate",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      const result = await adminService.reactivateAdmin(req, id, req.user.user_id);

      res.json({
        success: true,
        data: { user: result },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /v1/admin/invite/generate-url:
 *   post:
 *     summary: Generate invitation URL without sending email (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 */
router.post(
  "/invite/generate-url",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = inviteAdminSchema.parse(req.body);

      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      const result = await adminService.generateInvitationUrl(validated, req.user.user_id);

      res.json({
        success: true,
        data: { inviteUrl: result.inviteUrl },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /v1/admin/invite:
 *   post:
 *     summary: Invite admin user (admin only, sends email if email provided)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 */
router.post(
  "/invite",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = inviteAdminSchema.parse(req.body);

      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      const result = await adminService.inviteAdmin(req, validated, req.user.user_id);

      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /v1/admin/generate-invite-link:
 *   post:
 *     summary: Generate invitation link without sending email (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 */
router.post(
  "/generate-invite-link",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = inviteAdminSchema.parse(req.body);

      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      const result = await adminService.generateInvitationUrl(validated, req.user.user_id);

      res.json({
        success: true,
        data: { inviteUrl: result.inviteUrl },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /v1/admin/accept-invitation:
 *   post:
 *     summary: Accept admin invitation (public endpoint)
 *     tags: [Admin]
 */
router.post("/accept-invitation", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = acceptInvitationSchema.parse(req.body);
    const result = await adminService.acceptInvitation(req, validated);

    res.json({
      success: true,
      data: result,
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /v1/admin/security-logs:
 *   get:
 *     summary: Get security logs (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 */
router.get(
  "/security-logs",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = getSecurityLogsQuerySchema.parse(req.query);
      const result = await adminService.getSecurityLogs(validated);

      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error instanceof Error ? new AppError(400, "VALIDATION_ERROR", error.message) : error);
    }
  }
);

/**
 * @swagger
 * /v1/admin/security-logs/export:
 *   get:
 *     summary: Export security logs as CSV or JSON (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 */
router.get(
  "/security-logs/export",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = exportSecurityLogsQuerySchema.parse(req.query);
      const { format, ...filterParams } = validated;

      const logs = await adminService.exportSecurityLogs(filterParams);

      if (format === "csv") {
        const headers = [
          "Timestamp",
          "User",
          "Email",
          "Event Type",
          "IP Address",
          "Device",
          "Metadata",
        ];
        const rows = logs.map(
          (log: {
            created_at: Date;
            user: { first_name: string; last_name: string; email: string };
            event_type: string;
            ip_address: string | null;
            device_info: string | null;
            metadata: unknown;
          }) => [
            log.created_at.toISOString(),
            `${log.user.first_name} ${log.user.last_name}`,
            log.user.email,
            log.event_type,
            log.ip_address || "",
            log.device_info || "",
            JSON.stringify(log.metadata || {}),
          ]
        );

        const csvContent = [
          headers.join(","),
          ...rows.map((row: string[]) =>
            row.map((cell: string) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
          ),
        ].join("\n");

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="security-logs-${new Date().toISOString().split("T")[0]}.csv"`
        );
        res.send(Buffer.from(csvContent, "utf-8"));
      } else {
        const jsonData = logs.map(
          (log: {
            id: string;
            user_id: string;
            user: { first_name: string; last_name: string; email: string; roles: UserRole[] };
            event_type: string;
            ip_address: string | null;
            user_agent: string | null;
            device_info: string | null;
            metadata: unknown;
            created_at: Date;
          }) => ({
            id: log.id,
            user_id: log.user_id,
            user: {
              first_name: log.user.first_name,
              last_name: log.user.last_name,
              email: log.user.email,
              roles: log.user.roles,
            },
            event_type: log.event_type,
            ip_address: log.ip_address,
            user_agent: log.user_agent,
            device_info: log.device_info,
            metadata: log.metadata,
            created_at: log.created_at.toISOString(),
          })
        );

        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="security-logs-${new Date().toISOString().split("T")[0]}.json"`
        );
        res.json(jsonData);
      }
    } catch (error) {
      next(error instanceof Error ? new AppError(400, "VALIDATION_ERROR", error.message) : error);
    }
  }
);

/**
 * @swagger
 * /v1/admin/onboarding-logs:
 *   get:
 *     summary: Get onboarding logs with pagination and filters (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 */
router.get(
  "/onboarding-logs",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = getOnboardingLogsQuerySchema.parse(req.query);
      const result = await adminService.listOnboardingLogs(validated);

      res.json({
        success: true,
        data: {
          logs: result.logs,
          pagination: {
            page: validated.page,
            pageSize: validated.pageSize,
            totalCount: result.total,
            totalPages: Math.ceil(result.total / validated.pageSize),
          },
        },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /v1/admin/onboarding-logs/export:
 *   get:
 *     summary: Export onboarding logs as CSV or JSON (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 */
router.get(
  "/onboarding-logs/export",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = exportOnboardingLogsQuerySchema.parse(req.query);
      const { format, ...filterParams } = validated;

      const logs = await adminService.exportOnboardingLogs(filterParams);

      if (format === "csv") {
        const headers = [
          "Timestamp",
          "User",
          "Email",
          "Role",
          "Event Type",
          "Portal",
          "IP Address",
          "Device",
          "Metadata",
        ];
        const rows = logs.map((log) => [
          log.created_at.toISOString(),
          `${log.user.first_name} ${log.user.last_name}`,
          log.user.email,
          log.role,
          log.event_type,
          log.portal || "",
          log.ip_address || "",
          log.device_type || "",
          JSON.stringify(log.metadata || {}),
        ]);

        const csvContent = [
          headers.join(","),
          ...rows.map((row) =>
            row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
          ),
        ].join("\n");

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="onboarding-logs-${new Date().toISOString().split("T")[0]}.csv"`
        );
        res.send(Buffer.from(csvContent, "utf-8"));
      } else {
        const jsonData = logs.map((log) => ({
          id: log.id,
          user_id: log.user_id,
          user: {
            first_name: log.user.first_name,
            last_name: log.user.last_name,
            email: log.user.email,
            roles: log.user.roles,
          },
          role: log.role,
          event_type: log.event_type,
          portal: log.portal,
          ip_address: log.ip_address,
          user_agent: log.user_agent,
          device_info: log.device_info,
          device_type: log.device_type,
          metadata: log.metadata,
          created_at: log.created_at.toISOString(),
        }));

        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="onboarding-logs-${new Date().toISOString().split("T")[0]}.json"`
        );
        res.json(jsonData);
      }
    } catch (error) {
      next(error instanceof Error ? new AppError(400, "VALIDATION_ERROR", error.message) : error);
    }
  }
);

/**
 * @swagger
 * /v1/admin/onboarding-logs/:id:
 *   get:
 *     summary: Get onboarding log by ID (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 */
router.get(
  "/onboarding-logs/:id",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const log = await adminService.getOnboardingLogById(id);

      if (!log) {
        throw new AppError(404, "NOT_FOUND", "Onboarding log not found");
      }

      res.json({
        success: true,
        data: { log },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /v1/admin/invitations/pending:
 *   get:
 *     summary: Get pending admin invitations (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 */
router.get(
  "/invitations/pending",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = getPendingInvitationsQuerySchema.parse(req.query);
      const result = await adminService.getPendingInvitations(validated);

      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error instanceof Error ? new AppError(400, "VALIDATION_ERROR", error.message) : error);
    }
  }
);

/**
 * @swagger
 * /v1/admin/invitations/{token}/resend:
 *   post:
 *     summary: Resend admin invitation email (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 */
router.post(
  "/invitations/:id/resend",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      const result = await adminService.resendInvitation(req, id, req.user.user_id);

      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /v1/admin/invitations/:id/revoke:
 *   delete:
 *     summary: Revoke/delete a pending invitation (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 */
router.delete(
  "/invitations/:id/revoke",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      await adminService.revokeInvitation(req, id, req.user.user_id);

      res.json({
        success: true,
        data: { message: "Invitation revoked successfully" },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /v1/admin/users/:id/reset-onboarding:
 *   post:
 *     summary: Reset onboarding for a user (admin only, temporary feature for testing)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 */
router.post(
  "/users/:id/reset-onboarding",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const validated = resetOnboardingSchema.parse(req.body);

      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      const updatedUser = await adminService.resetOnboarding(req, id, validated, req.user.user_id);

      res.json({
        success: true,
        data: { user: updatedUser },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /v1/admin/onboarding-applications:
 *   get:
 *     summary: List onboarding applications for approval queue (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: portal
 *         schema:
 *           type: string
 *           enum: [investor, issuer]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [PERSONAL, COMPANY]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING_SSM_REVIEW, PENDING_ONBOARDING, PENDING_APPROVAL, PENDING_AML, APPROVED, REJECTED, EXPIRED]
 *     responses:
 *       200:
 *         description: Onboarding applications list with pagination
 */
router.get(
  "/onboarding-applications",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = getOnboardingApplicationsQuerySchema.parse(req.query);
      const result = await adminService.listOnboardingApplications(validated);

      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error instanceof Error ? new AppError(400, "VALIDATION_ERROR", error.message) : error);
    }
  }
);

/**
 * @swagger
 * /v1/admin/onboarding-applications/pending-count:
 *   get:
 *     summary: Get count of onboarding applications requiring admin action
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Count of pending applications
 */
router.get(
  "/onboarding-applications/pending-count",
  requireRole(UserRole.ADMIN),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminService.getPendingApprovalCount();

      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /v1/admin/onboarding-applications/{id}:
 *   get:
 *     summary: Get a single onboarding application by ID (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Onboarding application ID
 *     responses:
 *       200:
 *         description: Onboarding application details
 *       404:
 *         description: Application not found
 */
router.get(
  "/onboarding-applications/:id",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const application = await adminService.getOnboardingApplicationById(id);

      if (!application) {
        throw new AppError(404, "NOT_FOUND", "Onboarding application not found");
      }

      res.json({
        success: true,
        data: { application },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(
        error instanceof AppError
          ? error
          : new AppError(500, "INTERNAL_ERROR", "Failed to fetch onboarding application")
      );
    }
  }
);

/**
 * @swagger
 * /v1/admin/onboarding-applications/:id/restart:
 *   post:
 *     summary: Restart a user's onboarding via RegTank restart API (admin only)
 *     description: |
 *       Calls RegTank restart endpoint to create a new onboarding record with a new requestId.
 *       The old record is marked as CANCELLED and the organization status is reset to PENDING.
 *       The user will receive a new verification link to complete onboarding.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Onboarding application ID (internal UUID, not RegTank requestId)
 *     responses:
 *       200:
 *         description: Restart successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 verifyLink:
 *                   type: string
 *                   description: New verification link for the user
 *                 newRequestId:
 *                   type: string
 *                   description: New RegTank requestId
 *       400:
 *         description: Invalid state (onboarding cannot be restarted in current status)
 *       404:
 *         description: Onboarding not found
 */
router.post(
  "/onboarding-applications/:id/restart",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      const result = await adminService.restartOnboarding(req, id, req.user.user_id);

      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /admin/onboarding-applications/:id/complete-final-approval
 * Complete final approval for an onboarding application
 * Marks the organization as fully onboarded after all prerequisite checks are complete
 */
router.post(
  "/onboarding-applications/:id/complete-final-approval",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!id) {
        throw new AppError(400, "VALIDATION_ERROR", "Onboarding ID is required");
      }

      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      const result = await adminService.completeFinalApproval(req, id, req.user.user_id);

      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /admin/onboarding-applications/:id/approve-ssm
 * Approve SSM verification for a company organization
 * Sets ssm_approved = true for the organization
 */
router.post(
  "/onboarding-applications/:id/approve-ssm",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!id) {
        throw new AppError(400, "VALIDATION_ERROR", "Onboarding ID is required");
      }

      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      const result = await adminService.approveSsmVerification(req, id, req.user.user_id);

      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /admin/onboarding-applications/:id/refresh-corporate-status
 * Refresh corporate onboarding status by fetching latest director KYC statuses from RegTank
 */
router.post(
  "/onboarding-applications/:id/refresh-corporate-status",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      if (!id) {
        throw new AppError(400, "VALIDATION_ERROR", "Onboarding ID is required");
      }

      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      const result = await adminService.refreshCorporateOnboardingStatus(req, id, req.user.user_id);

      res.json({
        success: true,
        data: result,
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  }
);

export const adminRouter = router;
