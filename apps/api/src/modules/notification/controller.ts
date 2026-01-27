import { Router, Request, Response, NextFunction } from "express";
import { NotificationService } from "./service";
import { AppError } from "../../lib/http/error-handler";
import { requireAuth, requireRole } from "../../lib/auth/middleware";
import {
  NotificationFiltersSchema,
  UpdatePreferenceSchema,
  UpdateNotificationTypeSchema,
  AdminSendNotificationSchema,
  CreateNotificationGroupSchema,
  UpdateNotificationGroupSchema,
} from "./schemas";
import { UserRole } from "@prisma/client";

const router = Router();
const notificationService = new NotificationService();

/**
 * @swagger
 * /v1/notifications:
 *   get:
 *     summary: Get user's notifications (paginated)
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: read
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: category
 *         schema:
 *           $ref: '#/components/schemas/NotificationCategory'
 *       - in: query
 *         name: priority
 *         schema:
 *           $ref: '#/components/schemas/NotificationPriority'
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of notifications
 */
router.get("/", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = NotificationFiltersSchema.parse(req.query);
    const result = await notificationService.getUserNotifications(req.user!.user_id, filters);

    res.json({
      success: true,
      data: result,
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    next(error instanceof Error ? new AppError(400, "VALIDATION_ERROR", error.message) : error);
  }
});

/**
 * @swagger
 * /v1/notifications/unread-count:
 *   get:
 *     summary: Get unread count for badge
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count
 */
router.get("/unread-count", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await notificationService.getUnreadCount(req.user!.user_id);

    res.json({
      success: true,
      data: { count },
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /v1/notifications/:id/read:
 *   patch:
 *     summary: Mark notification as read
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 */
router.patch("/:id/read", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await notificationService.markAsRead(req.params.id, req.user!.user_id);

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
 * /v1/notifications/read-all:
 *   patch:
 *     summary: Mark all notifications as read
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
router.patch("/read-all", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await notificationService.markAllAsRead(req.user!.user_id);

    res.json({
      success: true,
      data: { count },
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /v1/notifications/preferences:
 *   get:
 *     summary: Get user notification preferences
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User preferences
 */
router.get("/preferences", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await notificationService.getUserPreferences(req.user!.user_id);

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
 * /v1/notifications/preferences/:typeId:
 *   put:
 *     summary: Update preference for specific type
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: typeId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               enabled_platform:
 *                 type: boolean
 *               enabled_email:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Preference updated
 */
router.put("/preferences/:typeId", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = UpdatePreferenceSchema.parse(req.body);
    const result = await notificationService.updateUserPreference(req.user!.user_id, req.params.typeId, validated);

    res.json({
      success: true,
      data: result,
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    next(error instanceof Error ? new AppError(400, "VALIDATION_ERROR", error.message) : error);
  }
});

/**
 * @swagger
 * /v1/notifications/admin/types:
 *   get:
 *     summary: Get all notification types (Admin)
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All notification types
 */
router.get("/admin/types", requireAuth, requireRole(UserRole.ADMIN), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await notificationService.getAllNotificationTypes();
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
 * /v1/notifications/admin/types/:id:
 *   patch:
 *     summary: Update notification type (Admin)
 *     tags: [Notifications]
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
 *             $ref: '#/components/schemas/UpdateNotificationType'
 *     responses:
 *       200:
 *         description: Notification type updated
 */
router.patch("/admin/types/:id", requireAuth, requireRole(UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = UpdateNotificationTypeSchema.parse(req.body);
    const result = await notificationService.updateNotificationType(req.params.id, validated);
    res.json({
      success: true,
      data: result,
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    next(error instanceof Error ? new AppError(400, "VALIDATION_ERROR", error.message) : error);
  }
});

/**
 * @swagger
 * /v1/notifications/admin/send:
 *   post:
 *     summary: Send custom notification to users (Admin)
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminSendNotification'
 *     responses:
 *       200:
 *         description: Notifications sent
 */
router.post("/admin/send", requireAuth, requireRole(UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = AdminSendNotificationSchema.parse(req.body);
    const result = await notificationService.sendBulkNotification(validated);
    res.json({
      success: true,
      data: result,
      correlationId: res.locals.correlationId,
    });
    } catch (error) {
    next(error instanceof Error ? new AppError(400, "VALIDATION_ERROR", error.message) : error);
  }
});

/**
 * @swagger
 * /v1/notifications/admin/groups:
 *   get:
 *     summary: Get all notification groups (Admin)
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of groups
 *   post:
 *     summary: Create a notification group (Admin)
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateNotificationGroup'
 *     responses:
 *       201:
 *         description: Group created
 */
router.get("/admin/groups", requireAuth, requireRole(UserRole.ADMIN), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const groups = await notificationService.getAllNotificationGroups();
    res.json({
      success: true,
      data: groups,
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/admin/groups", requireAuth, requireRole(UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = CreateNotificationGroupSchema.parse(req.body);
    const group = await notificationService.createNotificationGroup(validated);
    res.status(201).json({
      success: true,
      data: group,
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    next(error instanceof Error ? new AppError(400, "VALIDATION_ERROR", error.message) : error);
  }
});

/**
 * @swagger
 * /v1/notifications/admin/groups/:id:
 *   patch:
 *     summary: Update a notification group (Admin)
 *     tags: [Notifications]
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
 *             $ref: '#/components/schemas/UpdateNotificationGroup'
 *     responses:
 *       200:
 *         description: Group updated
 *   delete:
 *     summary: Delete a notification group (Admin)
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Group deleted
 */
router.patch("/admin/groups/:id", requireAuth, requireRole(UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = UpdateNotificationGroupSchema.parse(req.body);
    const group = await notificationService.updateNotificationGroup(req.params.id, validated);
    res.json({
      success: true,
      data: group,
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    next(error instanceof Error ? new AppError(400, "VALIDATION_ERROR", error.message) : error);
  }
});

router.delete("/admin/groups/:id", requireAuth, requireRole(UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await notificationService.deleteNotificationGroup(req.params.id);
    res.json({
      success: true,
      message: "Group deleted successfully",
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    next(error);
  }
});

export const notificationRouter = router;
