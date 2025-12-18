import { OrganizationRepository, OrganizationWithMembers } from "./repository";
import { CreateOrganizationInput, AddMemberInput, PortalType } from "./schemas";
import {
  OrganizationType,
  OnboardingStatus,
  OrganizationMemberRole,
  InvestorOrganization,
  IssuerOrganization,
  UserRole,
} from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import { prisma } from "../../lib/prisma";
import {
  CognitoIdentityProviderClient,
  AdminUpdateUserAttributesCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { formatRolesForCognito } from "../../lib/auth/cognito";
import { Request } from "express";
import { extractRequestMetadata } from "../../lib/http/request-utils";
import { getPortalFromRole } from "../../lib/role-detector";
import { AuthRepository } from "../auth/repository";

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || "ap-southeast-5",
});
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || "";

export class OrganizationService {
  private repository: OrganizationRepository;
  private authRepository: AuthRepository;

  constructor() {
    this.repository = new OrganizationRepository();
    this.authRepository = new AuthRepository();
  }

  /**
   * Create a new organization for the specified portal type
   */
  async createOrganization(
    userId: string,
    portalType: PortalType,
    input: CreateOrganizationInput
  ): Promise<InvestorOrganization | IssuerOrganization> {
    const orgType =
      input.type === "PERSONAL" ? OrganizationType.PERSONAL : OrganizationType.COMPANY;

    // Enforce personal organization limit
    if (orgType === OrganizationType.PERSONAL) {
      const hasPersonal =
        portalType === "investor"
          ? await this.repository.hasPersonalInvestorOrganization(userId)
          : await this.repository.hasPersonalIssuerOrganization(userId);

      if (hasPersonal) {
        throw new AppError(
          400,
          "PERSONAL_ORG_EXISTS",
          "You already have a personal account. You can only create company accounts."
        );
      }
    }

    // Company organizations require a name
    if (orgType === OrganizationType.COMPANY && !input.name) {
      throw new AppError(400, "NAME_REQUIRED", "Company name is required for company accounts.");
    }

    logger.info(
      { userId, portalType, orgType, name: input.name },
      "Creating organization"
    );

    // Create the organization
    let organization: InvestorOrganization | IssuerOrganization;

    if (portalType === "investor") {
      organization = await this.repository.createInvestorOrganization({
        ownerUserId: userId,
        type: orgType,
        name: input.name,
        registrationNumber: input.registrationNumber,
      });

      // Add owner as member with OWNER role
      await this.repository.addOrganizationMember({
        userId,
        investorOrganizationId: organization.id,
        role: OrganizationMemberRole.OWNER,
      });
    } else {
      organization = await this.repository.createIssuerOrganization({
        ownerUserId: userId,
        type: orgType,
        name: input.name,
        registrationNumber: input.registrationNumber,
      });

      // Add owner as member with OWNER role
      await this.repository.addOrganizationMember({
        userId,
        issuerOrganizationId: organization.id,
        role: OrganizationMemberRole.OWNER,
      });
    }

    logger.info(
      { organizationId: organization.id, portalType },
      "Organization created successfully"
    );

    // Update user: add role if not present, and append 'temp' to account array
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
    });

    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    // Determine the role based on portal type
    const role = portalType === "investor" ? UserRole.INVESTOR : UserRole.ISSUER;

    // Add role if not present
    const roleNeedsToBeAdded = !user.roles.includes(role);
    const updatedRoles = roleNeedsToBeAdded ? [...user.roles, role] : user.roles;
    
    // Get current account array and append a new 'temp' entry
    const currentAccountArray = portalType === "investor" ? user.investor_account : user.issuer_account;
    
    const updateData: {
      roles: UserRole[];
      investor_account?: { set: string[] };
      issuer_account?: { set: string[] };
    } = {
      roles: updatedRoles,
    };

    if (portalType === "investor") {
      // Append a new 'temp' to the array (one per organization)
      updateData.investor_account = { set: [...currentAccountArray, "temp"] };
    } else {
      // Append a new 'temp' to the array (one per organization)
      updateData.issuer_account = { set: [...currentAccountArray, "temp"] };
    }

    await prisma.user.update({
      where: { user_id: userId },
      data: updateData,
    });

    logger.info(
      { userId, role, portalType, roleAdded: roleNeedsToBeAdded, accountArrayLength: updateData.investor_account?.set.length || updateData.issuer_account?.set.length },
      "User roles and account arrays updated after organization creation"
    );

    // Update Cognito custom:roles attribute if role was added
    if (roleNeedsToBeAdded && user.cognito_sub) {
      try {
        const rolesString = formatRolesForCognito(updatedRoles);

        const command = new AdminUpdateUserAttributesCommand({
          UserPoolId: COGNITO_USER_POOL_ID,
          Username: user.cognito_sub,
          UserAttributes: [
            {
              Name: "custom:roles",
              Value: rolesString,
            },
          ],
        });

        await cognitoClient.send(command);
        logger.info({ userId, updatedRoles }, "Cognito roles updated successfully");
      } catch (error) {
        logger.warn(
          { error: error instanceof Error ? error.message : String(error), userId },
          "Failed to update Cognito custom:roles attribute"
        );
      }
    }

    return organization;
  }

  /**
   * List all organizations for a user for the specified portal type
   */
  async listOrganizations(
    userId: string,
    portalType: PortalType
  ): Promise<OrganizationWithMembers[]> {
    if (portalType === "investor") {
      return this.repository.listInvestorOrganizationsForUser(userId);
    }
    return this.repository.listIssuerOrganizationsForUser(userId);
  }

  /**
   * Get a single organization by ID
   */
  async getOrganization(
    userId: string,
    organizationId: string,
    portalType: PortalType
  ): Promise<OrganizationWithMembers> {
    const organization =
      portalType === "investor"
        ? await this.repository.findInvestorOrganizationById(organizationId)
        : await this.repository.findIssuerOrganizationById(organizationId);

    if (!organization) {
      throw new AppError(404, "NOT_FOUND", "Organization not found");
    }

    // Check if user has access (is owner or member)
    const isMember = organization.members.some((m: { user_id: string }) => m.user_id === userId);
    const isOwner = organization.owner_user_id === userId;

    if (!isMember && !isOwner) {
      throw new AppError(403, "FORBIDDEN", "You do not have access to this organization");
    }

    return organization;
  }

  /**
   * Complete onboarding for an organization
   * For now, this immediately marks the org as completed.
   * In the future, this will be triggered by RegTank webhook.
   */
  async completeOnboarding(
    req: Request,
    userId: string,
    organizationId: string,
    portalType: PortalType
  ): Promise<InvestorOrganization | IssuerOrganization> {
    // Verify access
    const organization = await this.getOrganization(userId, organizationId, portalType);

    // Only owner can complete onboarding
    if (organization.owner_user_id !== userId) {
      throw new AppError(403, "FORBIDDEN", "Only the organization owner can complete onboarding");
    }

    // Check if already completed
    if (organization.onboarding_status === OnboardingStatus.COMPLETED) {
      throw new AppError(400, "ALREADY_COMPLETED", "Onboarding is already completed");
    }

    logger.info(
      { organizationId, portalType, userId },
      "Completing organization onboarding"
    );

    const updatedOrg =
      portalType === "investor"
        ? await this.repository.updateInvestorOrganizationOnboarding(
            organizationId,
            OnboardingStatus.COMPLETED
          )
        : await this.repository.updateIssuerOrganizationOnboarding(
            organizationId,
            OnboardingStatus.COMPLETED
          );

    logger.info(
      { organizationId, portalType },
      "Organization onboarding completed"
    );

    // Update user's account array: replace 'temp' with organization ID
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
    });

    if (user) {
      const accountArrayField = portalType === "investor" ? "investor_account" : "issuer_account";
      const currentArray = portalType === "investor" ? user.investor_account : user.issuer_account;
      
      // Find the first 'temp' and replace it with the organization ID
      const tempIndex = currentArray.indexOf("temp");
      if (tempIndex !== -1) {
        const updatedArray = [...currentArray];
        updatedArray[tempIndex] = organizationId;

        await prisma.user.update({
          where: { user_id: userId },
          data: {
            [accountArrayField]: { set: updatedArray },
          },
        });

        logger.info(
          { userId, organizationId, portalType, accountArray: updatedArray },
          "User account array updated with organization ID"
        );
      } else {
        logger.warn(
          { userId, organizationId, portalType, currentArray },
          "No 'temp' placeholder found in user account array"
        );
      }

      // Log onboarding completion event
      const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);
      const role = portalType === "investor" ? UserRole.INVESTOR : UserRole.ISSUER;
      const portal = getPortalFromRole(role);

      await this.authRepository.createOnboardingLog({
        userId: user.user_id,
        role,
        eventType: "ONBOARDING_COMPLETED",
        portal,
        ipAddress,
        userAgent,
        deviceInfo,
        deviceType,
        metadata: {
          organizationId,
          organizationType: organization.type,
          organizationName: organization.name,
          role,
          roles: user.roles,
        },
      });

      logger.info(
        { userId, organizationId, portalType, role },
        "Onboarding completion event logged"
      );
    }

    return updatedOrg;
  }

  /**
   * Add a member (director or regular member) to an organization
   */
  async addMember(
    userId: string,
    organizationId: string,
    portalType: PortalType,
    input: AddMemberInput
  ): Promise<{ success: boolean; member: { id: string; email: string; role: string } }> {
    // Verify access
    const organization = await this.getOrganization(userId, organizationId, portalType);

    // Only owner or directors can add members
    const userMember = organization.members.find((m: { user_id: string; role: string }) => m.user_id === userId);
    const canManage =
      organization.owner_user_id === userId ||
      userMember?.role === OrganizationMemberRole.OWNER ||
      userMember?.role === OrganizationMemberRole.DIRECTOR;

    if (!canManage) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to add members");
    }

    // Find user by email
    const targetUser = await this.repository.findUserByEmail(input.email);
    if (!targetUser) {
      throw new AppError(404, "USER_NOT_FOUND", "No user found with this email address");
    }

    // Check if user is already a member
    const isMember =
      portalType === "investor"
        ? await this.repository.isInvestorOrganizationMember(organizationId, targetUser.user_id)
        : await this.repository.isIssuerOrganizationMember(organizationId, targetUser.user_id);

    if (isMember) {
      throw new AppError(400, "ALREADY_MEMBER", "User is already a member of this organization");
    }

    const role =
      input.role === "DIRECTOR"
        ? OrganizationMemberRole.DIRECTOR
        : OrganizationMemberRole.MEMBER;

    logger.info(
      { organizationId, targetUserId: targetUser.user_id, role },
      "Adding member to organization"
    );

    // Add the member
    if (portalType === "investor") {
      await this.repository.addOrganizationMember({
        userId: targetUser.user_id,
        investorOrganizationId: organizationId,
        role,
      });
    } else {
      await this.repository.addOrganizationMember({
        userId: targetUser.user_id,
        issuerOrganizationId: organizationId,
        role,
      });
    }

    return {
      success: true,
      member: {
        id: targetUser.user_id,
        email: targetUser.email,
        role: input.role,
      },
    };
  }

  /**
   * Remove a member from an organization
   */
  async removeMember(
    userId: string,
    organizationId: string,
    targetUserId: string,
    portalType: PortalType
  ): Promise<{ success: boolean }> {
    // Verify access
    const organization = await this.getOrganization(userId, organizationId, portalType);

    // Only owner or directors can remove members
    const userMember = organization.members.find((m: { user_id: string; role: string }) => m.user_id === userId);
    const canManage =
      organization.owner_user_id === userId ||
      userMember?.role === OrganizationMemberRole.OWNER ||
      userMember?.role === OrganizationMemberRole.DIRECTOR;

    if (!canManage) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to remove members");
    }

    // Cannot remove the owner
    if (targetUserId === organization.owner_user_id) {
      throw new AppError(400, "CANNOT_REMOVE_OWNER", "Cannot remove the organization owner");
    }

    // Check if target is a member
    const targetMember = organization.members.find((m: { user_id: string }) => m.user_id === targetUserId);
    if (!targetMember) {
      throw new AppError(404, "NOT_FOUND", "Member not found in organization");
    }

    logger.info(
      { organizationId, targetUserId },
      "Removing member from organization"
    );

    if (portalType === "investor") {
      await this.repository.removeInvestorOrganizationMember(organizationId, targetUserId);
    } else {
      await this.repository.removeIssuerOrganizationMember(organizationId, targetUserId);
    }

    return { success: true };
  }

  /**
   * Check if user has any onboarded organizations
   */
  async hasOnboardedOrganization(userId: string, portalType: PortalType): Promise<boolean> {
    const organizations = await this.listOrganizations(userId, portalType);
    return organizations.some((org) => org.onboarding_status === OnboardingStatus.COMPLETED);
  }

  /**
   * Check if user has a personal organization already
   */
  async hasPersonalOrganization(userId: string, portalType: PortalType): Promise<boolean> {
    if (portalType === "investor") {
      return this.repository.hasPersonalInvestorOrganization(userId);
    }
    return this.repository.hasPersonalIssuerOrganization(userId);
  }
}

