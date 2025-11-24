import { Router, Request, Response, NextFunction } from "express";
import { AuthService } from "./service";
import { AppError } from "../../lib/http/error-handler";
import { requireAuth, requireRole } from "../../lib/auth/middleware";
import { UserRole } from "@prisma/client";
import {
  syncUserSchema,
  addRoleSchema,
  checkOnboardingSchema,
  completeOnboardingSchema,
  switchRoleSchema,
  createAdminUserSchema,
  type SyncUserInput,
  type CreateAdminUserInput,
} from "./schemas";

const router = Router();
const authService = new AuthService();

/**
 * @swagger
 * /v1/auth/sync-user:
 *   post:
 *     summary: Sync Cognito user to database after OAuth callback
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cognitoSub, email, roles]
 *             properties:
 *               cognitoSub:
 *                 type: string
 *                 description: Cognito user UUID from token
 *               email:
 *                 type: string
 *                 format: email
 *               roles:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/UserRole'
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: User synced successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     requiresOnboarding:
 *                       type: object
 *                       properties:
 *                         investor:
 *                           type: boolean
 *                         issuer:
 *                           type: boolean
 */
router.post("/sync-user", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = syncUserSchema.parse(req.body) as SyncUserInput;
    const result = await authService.syncUser(req, validated);
    
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
 * /v1/auth/add-role:
 *   post:
 *     summary: Add additional role to user
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 $ref: '#/components/schemas/UserRole'
 *     responses:
 *       200:
 *         description: Role added successfully
 */
router.post("/add-role", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = addRoleSchema.parse(req.body);
    const user = await authService.addRole(req, req.user!.id, req.cognitoSub!, validated.role);
    
    res.json({
      success: true,
      data: {
        user,
        roles: user.roles,
      },
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    next(error instanceof Error ? new AppError(400, "VALIDATION_ERROR", error.message) : error);
  }
});

/**
 * @swagger
 * /v1/auth/check-onboarding:
 *   post:
 *     summary: Check if onboarding is completed for a role
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 $ref: '#/components/schemas/UserRole'
 *     responses:
 *       200:
 *         description: Onboarding status
 */
router.post("/check-onboarding", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = checkOnboardingSchema.parse(req.body);
    const result = await authService.checkOnboarding(req.user!.id, validated.role);
    
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
 * /v1/auth/complete-onboarding:
 *   post:
 *     summary: Mark onboarding as completed for a role
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 $ref: '#/components/schemas/UserRole'
 *     responses:
 *       200:
 *         description: Onboarding completed
 */
router.post("/complete-onboarding", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = completeOnboardingSchema.parse(req.body);
    const result = await authService.completeOnboarding(req, req.user!.id, validated.role);
    
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
 * /v1/auth/logout:
 *   post:
 *     summary: Logout user and revoke session
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post("/logout", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.logout(req, req.user!.id);
    
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
 * /v1/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 */
router.get("/me", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.getCurrentUser(req.cognitoSub!);
    
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
 * /v1/auth/switch-role:
 *   post:
 *     summary: Switch active role in current session
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [role]
 *             properties:
 *               role:
 *                 $ref: '#/components/schemas/UserRole'
 *     responses:
 *       200:
 *         description: Role switched successfully
 */
router.post("/switch-role", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = switchRoleSchema.parse(req.body);
    const result = await authService.switchRole(req, req.cognitoSub!, validated.role);
    
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
 * /v1/auth/admin/create-user:
 *   post:
 *     summary: Create admin user (admin only)
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, firstName, lastName, tempPassword]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               tempPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       201:
 *         description: Admin user created
 */
router.post("/admin/create-user", requireAuth, requireRole(UserRole.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = createAdminUserSchema.parse(req.body) as CreateAdminUserInput;
    const result = await authService.createAdminUser(validated);
    
    res.status(201).json({
      success: true,
      data: result,
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    next(error instanceof Error ? new AppError(400, "VALIDATION_ERROR", error.message) : error);
  }
});

export const authRouter = router;

