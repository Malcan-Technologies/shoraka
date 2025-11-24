import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminUpdateUserAttributesCommand } from "@aws-sdk/client-cognito-identity-provider";
import { AuthRepository } from "./repository";
import { User, UserRole } from "@prisma/client";
import { formatRolesForCognito } from "../../lib/auth/cognito";
import { extractRequestMetadata } from "../../lib/http/request-utils";
import { Request } from "express";

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION || "ap-southeast-5",
});

const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || "";
const COGNITO_DOMAIN = process.env.NEXT_PUBLIC_COGNITO_DOMAIN || "";

export class AuthService {
  private repository: AuthRepository;

  constructor() {
    this.repository = new AuthRepository();
  }

  /**
   * Sync Cognito user to database after OAuth callback
   * Creates or updates user record and creates access log
   */
  async syncUser(
    req: Request,
    data: {
      cognitoSub: string;
      email: string;
      roles: UserRole[];
      firstName?: string;
      lastName?: string;
      phone?: string;
    }
  ): Promise<{
    user: User;
    requiresOnboarding: {
      investor: boolean;
      issuer: boolean;
    };
  }> {
    const { ipAddress, deviceInfo } = extractRequestMetadata(req);

    // Upsert user in database
    const user = await this.repository.upsertUser({
      cognitoSub: data.cognitoSub,
      cognitoUsername: data.email, // Default to email
      email: data.email,
      emailVerified: true, // If they completed OAuth, email is verified
      roles: data.roles,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
    });

    // Create access log
    await this.repository.createAccessLog({
      userId: user.id,
      eventType: "LOGIN",
      ipAddress,
      deviceInfo,
      success: true,
      metadata: {
        roles: data.roles,
      },
    });

    // Check onboarding status
    const requiresOnboarding = {
      investor: data.roles.includes(UserRole.INVESTOR) && !user.investor_onboarding_completed,
      issuer: data.roles.includes(UserRole.ISSUER) && !user.issuer_onboarding_completed,
    };

    return { user, requiresOnboarding };
  }

  /**
   * Add a role to an existing user
   * Updates both Cognito custom attribute and database
   */
  async addRole(
    req: Request,
    userId: string,
    cognitoSub: string,
    role: UserRole
  ): Promise<User> {
    const { ipAddress, deviceInfo } = extractRequestMetadata(req);

    // Add role in database
    const updatedUser = await this.repository.addRoleToUser(userId, role);

    // Update Cognito custom:roles attribute
    const rolesString = formatRolesForCognito(updatedUser.roles);
    
    const command = new AdminUpdateUserAttributesCommand({
      UserPoolId: COGNITO_USER_POOL_ID,
      Username: cognitoSub,
      UserAttributes: [
        {
          Name: "custom:roles",
          Value: rolesString,
        },
      ],
    });

    await cognitoClient.send(command);

    // Create access log
    await this.repository.createAccessLog({
      userId,
      eventType: "ROLE_ADDED",
      ipAddress,
      deviceInfo,
      success: true,
      metadata: {
        addedRole: role,
        allRoles: updatedUser.roles,
      },
    });

    return updatedUser;
  }

  /**
   * Check if onboarding is completed for a specific role
   */
  async checkOnboarding(userId: string, role: UserRole): Promise<{
    completed: boolean;
    redirectTo?: string;
  }> {
    const user = await this.repository.findUserByCognitoSub(userId);
    
    if (!user) {
      throw new Error("User not found");
    }

    let completed = true;

    if (role === UserRole.INVESTOR) {
      completed = user.investor_onboarding_completed;
    } else if (role === UserRole.ISSUER) {
      completed = user.issuer_onboarding_completed;
    }

    return {
      completed,
      redirectTo: completed ? undefined : "/onboarding",
    };
  }

  /**
   * Mark onboarding as completed for a specific role
   */
  async completeOnboarding(
    req: Request,
    userId: string,
    role: UserRole
  ): Promise<{ success: boolean }> {
    const { ipAddress, deviceInfo } = extractRequestMetadata(req);

    await this.repository.updateOnboardingStatus(userId, role, true);

    // Create access log
    await this.repository.createAccessLog({
      userId,
      eventType: "ONBOARDING_COMPLETED",
      ipAddress,
      deviceInfo,
      success: true,
      metadata: {
        role,
      },
    });

    return { success: true };
  }

  /**
   * Logout user and revoke session
   */
  async logout(
    req: Request,
    userId: string
  ): Promise<{
    success: boolean;
    logoutUrl: string;
  }> {
    const { ipAddress, deviceInfo } = extractRequestMetadata(req);

    // Find active session
    const session = await this.repository.findActiveSession(userId);
    
    if (session) {
      await this.repository.revokeSession(session.id);
    }

    // Create access log
    await this.repository.createAccessLog({
      userId,
      eventType: "LOGOUT",
      ipAddress,
      deviceInfo,
      success: true,
    });

    // Return Cognito logout URL
    const logoutUrl = `${COGNITO_DOMAIN}/logout?client_id=${process.env.COGNITO_CLIENT_ID}&logout_uri=${encodeURIComponent("https://cashsouk.com")}`;

    return {
      success: true,
      logoutUrl,
    };
  }

  /**
   * Get current user profile with session info
   */
  async getCurrentUser(userId: string): Promise<{
    user: User;
    activeRole: UserRole | null;
    sessions: {
      active: number;
    };
  }> {
    const user = await this.repository.findUserByCognitoSub(userId);
    
    if (!user) {
      throw new Error("User not found");
    }

    const activeSession = await this.repository.findActiveSession(user.id);
    const activeSessionsCount = await this.repository.countActiveSessions(user.id);

    return {
      user,
      activeRole: activeSession?.active_role || null,
      sessions: {
        active: activeSessionsCount,
      },
    };
  }

  /**
   * Switch active role in current session
   */
  async switchRole(
    req: Request,
    userId: string,
    role: UserRole
  ): Promise<{
    success: boolean;
    activeRole: UserRole;
  }> {
    const { ipAddress, deviceInfo } = extractRequestMetadata(req);
    const user = await this.repository.findUserByCognitoSub(userId);
    
    if (!user) {
      throw new Error("User not found");
    }

    // Verify user has the role
    if (!user.roles.includes(role)) {
      throw new Error(`User does not have ${role} role`);
    }

    // Update active session
    const session = await this.repository.findActiveSession(user.id);
    
    if (session) {
      await this.repository.updateSessionActiveRole(session.id, role);
    }

    // Create access log
    await this.repository.createAccessLog({
      userId: user.id,
      eventType: "ROLE_SWITCHED",
      ipAddress,
      deviceInfo,
      success: true,
      metadata: {
        newRole: role,
      },
    });

    return {
      success: true,
      activeRole: role,
    };
  }

  /**
   * Create admin user (admin-only function)
   */
  async createAdminUser(data: {
    email: string;
    firstName: string;
    lastName: string;
    tempPassword: string;
  }): Promise<{
    user: User;
    tempPassword: string;
  }> {
    // Create user in Cognito
    const command = new AdminCreateUserCommand({
      UserPoolId: COGNITO_USER_POOL_ID,
      Username: data.email,
      UserAttributes: [
        { Name: "email", Value: data.email },
        { Name: "email_verified", Value: "true" },
        { Name: "custom:roles", Value: UserRole.ADMIN },
      ],
      TemporaryPassword: data.tempPassword,
      MessageAction: "SUPPRESS", // Don't send welcome email (we'll handle it)
    });

    const cognitoResponse = await cognitoClient.send(command);
    const cognitoSub = cognitoResponse.User?.Attributes?.find((attr) => attr.Name === "sub")?.Value;

    if (!cognitoSub) {
      throw new Error("Failed to create Cognito user");
    }

    // Create user in database
    const user = await this.repository.upsertUser({
      cognitoSub,
      cognitoUsername: data.email,
      email: data.email,
      emailVerified: true,
      roles: [UserRole.ADMIN],
      firstName: data.firstName,
      lastName: data.lastName,
    });

    return {
      user,
      tempPassword: data.tempPassword,
    };
  }
}

