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
  startOnboardingSchema,
  updateProfileSchema,
  changePasswordSchema,
  initiateEmailChangeSchema,
  verifyEmailChangeSchema,
  resendEmailVerificationSchema,
  verifyEmailSchema,
  resendSignupCodeSchema,
  confirmSignupSchema,
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
router.post(
  "/check-onboarding",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
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
  }
);

/**
 * @swagger
 * /v1/auth/start-onboarding:
 *   post:
 *     summary: Log when user starts onboarding
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role:
 *                 $ref: '#/components/schemas/UserRole'
 *     responses:
 *       200:
 *         description: Onboarding start logged
 */
router.post(
  "/start-onboarding",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = startOnboardingSchema.parse(req.body);
      const result = await authService.startOnboarding(req, req.user!.id, validated.role);

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
router.post(
  "/complete-onboarding",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
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
  }
);

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
 * /v1/auth/refresh-token:
 *   post:
 *     summary: Refresh access token using refresh token from cookies
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: No refresh token or refresh failed
 */
router.post("/refresh-token", async (req: Request, res: Response, next: NextFunction) => {
  const correlationId = res.locals.correlationId;

  try {
    // Delegate to service
    const result = await authService.refreshToken(req, res);

    res.json({
      success: true,
      data: {
        accessToken: result.accessToken,
      },
      correlationId,
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
 * /v1/auth/profile:
 *   patch:
 *     summary: Update current user's profile (name, phone)
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *                 maxLength: 100
 *               lastName:
 *                 type: string
 *                 maxLength: 100
 *               phone:
 *                 type: string
 *                 maxLength: 20
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.patch("/profile", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = updateProfileSchema.parse(req.body);
    const updatedUser = await authService.updateProfile(req, req.user!.id, validated);

    res.json({
      success: true,
      data: { user: updatedUser },
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    next(error instanceof Error ? new AppError(400, "VALIDATION_ERROR", error.message) : error);
  }
});

/**
 * @swagger
 * /v1/auth/change-password:
 *   post:
 *     summary: Change current user's password
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: User's current password
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 description: New password (min 8 chars, must contain uppercase, lowercase, and number)
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid current password or validation error
 */
router.post(
  "/change-password",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = changePasswordSchema.parse(req.body);
      const result = await authService.changePassword(req, req.user!.id, validated);

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
 * /v1/auth/initiate-email-change:
 *   post:
 *     summary: Initiate email change process
 *     description: Sends verification code to new email address. User must verify with current password.
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newEmail, password]
 *             properties:
 *               newEmail:
 *                 type: string
 *                 format: email
 *                 description: New email address
 *               password:
 *                 type: string
 *                 description: Current password to verify identity
 *     responses:
 *       200:
 *         description: Verification code sent to new email
 *       400:
 *         description: Invalid password or email already in use
 */
router.post(
  "/initiate-email-change",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = initiateEmailChangeSchema.parse(req.body);
      const result = await authService.initiateEmailChange(req, req.user!.id, validated);

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
 * /v1/auth/verify-email-change:
 *   post:
 *     summary: Verify email change with code
 *     description: Completes email change by verifying the code sent to new email
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, password]
 *             properties:
 *               code:
 *                 type: string
 *                 description: Verification code from email
 *               password:
 *                 type: string
 *                 description: Current password to verify identity
 *     responses:
 *       200:
 *         description: Email changed successfully
 *       400:
 *         description: Invalid code or password
 */
router.post(
  "/verify-email-change",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = verifyEmailChangeSchema.parse(req.body);
      const result = await authService.verifyEmailChange(req, req.user!.id, validated);

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
 * /v1/auth/resend-email-verification:
 *   post:
 *     summary: Resend email verification code
 *     description: Sends a new verification code to the user's current email (for unverified emails)
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password:
 *                 type: string
 *                 description: Current password to verify identity
 *     responses:
 *       200:
 *         description: Verification code sent successfully
 *       400:
 *         description: Invalid password or email already verified
 */
router.post(
  "/resend-email-verification",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = resendEmailVerificationSchema.parse(req.body);
      const result = await authService.resendEmailVerification(req, req.user!.id, validated);

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
 * /v1/auth/verify-email:
 *   post:
 *     summary: Verify email with code
 *     description: Verifies an unverified email address using the verification code
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, password]
 *             properties:
 *               code:
 *                 type: string
 *                 description: Verification code from email
 *               password:
 *                 type: string
 *                 description: Current password to verify identity
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid code, password, or email already verified
 */
router.post(
  "/verify-email",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = verifyEmailSchema.parse(req.body);
      const result = await authService.verifyEmail(req, req.user!.id, validated);

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
router.post(
  "/switch-role",
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
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
  }
);

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
router.post(
  "/admin/create-user",
  requireAuth,
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
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
  }
);

/**
 * @swagger
 * /v1/auth/resend-signup-code:
 *   post:
 *     summary: Resend signup confirmation code (public)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Confirmation code resent
 */
router.post("/resend-signup-code", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = resendSignupCodeSchema.parse(req.body);

    await authService.resendSignupCode(email);

    res.json({
      success: true,
      data: { message: "Verification code sent" },
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /v1/auth/confirm-signup:
 *   post:
 *     summary: Confirm signup with verification code (public)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Signup confirmed
 */
router.post("/confirm-signup", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, code } = confirmSignupSchema.parse(req.body);

    await authService.confirmSignup(email, code);

    res.json({
      success: true,
      data: { message: "Email confirmed successfully" },
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    next(error);
  }
});

export const authRouter = router;
