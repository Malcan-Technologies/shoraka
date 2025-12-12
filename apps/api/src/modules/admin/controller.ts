import { Router, Request, Response, NextFunction } from "express";
import { AdminService } from "./service";
import { AppError } from "../../lib/http/error-handler";
import { requireRole } from "../../lib/auth/middleware";
import { UserRole } from "@prisma/client";
import {
  getUsersQuerySchema,
  getAccessLogsQuerySchema,
  updateUserRolesSchema,
  updateUserKycSchema,
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

      const updatedUser = await adminService.updateUserRoles(req, id, validated, req.user.id);

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
 * /v1/admin/users/:id/kyc:
 *   patch:
 *     summary: Update user KYC status (admin only)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 */
router.patch(
  "/users/:id/kyc",
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const validated = updateUserKycSchema.parse(req.body);

      if (!req.user) {
        throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
      }

      const updatedUser = await adminService.updateUserKyc(req, id, validated, req.user.id);

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
              error instanceof Error ? error.message : "Failed to update KYC status"
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

      const updatedUser = await adminService.updateUserOnboarding(req, id, validated, req.user.id);

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

      const updatedUser = await adminService.updateUserProfile(req, id, validated, req.user.id);

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

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="access-logs-${new Date().toISOString().split("T")[0]}.csv"`
        );
        res.send(csvContent);
      } else {
        // JSON format
        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="access-logs-${new Date().toISOString().split("T")[0]}.json"`
        );
        res.json({
          success: true,
          data: { logs },
          correlationId: res.locals.correlationId,
        });
      }
    } catch (error) {
      next(error instanceof Error ? new AppError(400, "VALIDATION_ERROR", error.message) : error);
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

      const result = await adminService.updateAdminRole(req, id, validated, req.user.id);

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

      const result = await adminService.deactivateAdmin(req, id, req.user.id);

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

      const result = await adminService.reactivateAdmin(req, id, req.user.id);

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

      const result = await adminService.generateInvitationUrl(validated, req.user.id);

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

      const result = await adminService.inviteAdmin(req, validated, req.user.id);

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

      const result = await adminService.generateInvitationUrl(validated, req.user.id);

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
router.post(
  "/accept-invitation",
  async (req: Request, res: Response, next: NextFunction) => {
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
  }
);

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

      const result = await adminService.resendInvitation(req, id, req.user.id);

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

      await adminService.revokeInvitation(req, id, req.user.id);

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

export const adminRouter = router;
