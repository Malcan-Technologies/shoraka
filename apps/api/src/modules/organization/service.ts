import { OrganizationRepository, OrganizationWithMembers } from "./repository";
import {
  CreateOrganizationInput,
  AddMemberInput,
  PortalType,
  UpdateOrganizationProfileInput,
  InviteMemberInput,
  AcceptOrganizationInvitationInput,
  ChangeMemberRoleInput,
  UpdateCorporateInfoInput,
} from "./schemas";
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
import { sendEmail } from "../../lib/email/ses-client";
import { organizationInvitationTemplate } from "../../lib/email/templates";
import { randomBytes } from "crypto";

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
    req: Request,
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

    logger.info({ userId, portalType, orgType, name: input.name }, "Creating organization");

    // Create the organization
    let organization: InvestorOrganization | IssuerOrganization;

    if (portalType === "investor") {
      organization = await this.repository.createInvestorOrganization({
        ownerUserId: userId,
        type: orgType,
        name: input.name,
        registrationNumber: input.registrationNumber,
      });

      // Add owner as member with ORGANIZATION_ADMIN role
      await this.repository.addOrganizationMember({
        userId,
        investorOrganizationId: organization.id,
        role: OrganizationMemberRole.ORGANIZATION_ADMIN,
      });
    } else {
      organization = await this.repository.createIssuerOrganization({
        ownerUserId: userId,
        type: orgType,
        name: input.name,
        registrationNumber: input.registrationNumber,
      });

      // Add owner as member with ORGANIZATION_ADMIN role
      await this.repository.addOrganizationMember({
        userId,
        issuerOrganizationId: organization.id,
        role: OrganizationMemberRole.ORGANIZATION_ADMIN,
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
    const currentAccountArray =
      portalType === "investor" ? user.investor_account : user.issuer_account;

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
      {
        userId,
        role,
        portalType,
        roleAdded: roleNeedsToBeAdded,
        accountArrayLength:
          updateData.investor_account?.set.length || updateData.issuer_account?.set.length,
      },
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

    // Determine the role and portal for logging
    const logRole = portalType === "investor" ? UserRole.INVESTOR : UserRole.ISSUER;
    const logPortal = getPortalFromRole(logRole);

    // Log ONBOARDING_STARTED when the organization is successfully created (the 'Create' submit action)
    const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);
    await this.authRepository.createOnboardingLog({
      userId,
      role: logRole,
      eventType: "ONBOARDING_STARTED",
      portal: logPortal,
      ipAddress,
      userAgent,
      deviceInfo,
      deviceType,
      organizationName: organization.name || undefined,
      investorOrganizationId: portalType === "investor" ? organization.id : undefined,
      issuerOrganizationId: portalType === "issuer" ? organization.id : undefined,
      metadata: {
        organizationId: organization.id,
        organizationType: organization.type,
        organizationName: organization.name,
        role: logRole,
      },
    });

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
    _req: Request,
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

    logger.info({ organizationId, portalType, userId }, "Completing organization onboarding");

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

    logger.info({ organizationId, portalType }, "Organization onboarding completed");

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

      // Note: USER_COMPLETED log is only created when final approval is completed by admin
      // See apps/api/src/modules/admin/service.ts completeFinalApproval()
      logger.info(
        { userId, organizationId, portalType },
        "Organization onboarding status updated to COMPLETED"
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
    const userMember = organization.members.find(
      (m: { user_id: string; role: string }) => m.user_id === userId
    );
    const canManage =
      organization.owner_user_id === userId ||
      userMember?.role === OrganizationMemberRole.ORGANIZATION_ADMIN;

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
      input.role === "ORGANIZATION_ADMIN"
        ? OrganizationMemberRole.ORGANIZATION_ADMIN
        : OrganizationMemberRole.ORGANIZATION_MEMBER;

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
    const userMember = organization.members.find(
      (m: { user_id: string; role: string }) => m.user_id === userId
    );
    const canManage =
      organization.owner_user_id === userId ||
      userMember?.role === OrganizationMemberRole.ORGANIZATION_ADMIN;

    if (!canManage) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to remove members");
    }

    // Cannot remove the owner
    if (targetUserId === organization.owner_user_id) {
      throw new AppError(400, "CANNOT_REMOVE_OWNER", "Cannot remove the organization owner");
    }

    // Check if target is a member
    const targetMember = organization.members.find(
      (m: { user_id: string; role: string }) => m.user_id === targetUserId
    );
    if (!targetMember) {
      throw new AppError(404, "NOT_FOUND", "Member not found in organization");
    }

    // Check if removing last admin
    if (targetMember.role === OrganizationMemberRole.ORGANIZATION_ADMIN) {
      const adminCount = await this.repository.countOrganizationAdmins(organizationId, portalType);
      if (adminCount === 1) {
        throw new AppError(
          400,
          "LAST_ADMIN",
          "Cannot remove - at least one organization admin must remain"
        );
      }
    }

    logger.info({ organizationId, targetUserId }, "Removing member from organization");

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

  /**
   * Update editable profile fields for an organization
   * Only allows updating: phoneNumber, address, bankAccountDetails
   */
  async updateOrganizationProfile(
    userId: string,
    organizationId: string,
    portalType: PortalType,
    input: UpdateOrganizationProfileInput
  ): Promise<{ success: boolean }> {
    // Verify access
    const organization = await this.getOrganization(userId, organizationId, portalType);

    // Only owner can update profile
    if (organization.owner_user_id !== userId) {
      throw new AppError(403, "FORBIDDEN", "Only the organization owner can update profile");
    }

    logger.info(
      { organizationId, portalType, userId, fields: Object.keys(input) },
      "Updating organization profile"
    );

    // Build update data - only include fields that are provided
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};

    if (input.phoneNumber !== undefined) {
      updateData.phone_number = input.phoneNumber;
    }

    if (input.address !== undefined) {
      updateData.address = input.address;
    }

    if (input.bankAccountDetails !== undefined) {
      updateData.bank_account_details = input.bankAccountDetails ?? null;
    }

    // Update the organization
    if (portalType === "investor") {
      await prisma.investorOrganization.update({
        where: { id: organizationId },
        data: updateData as Parameters<typeof prisma.investorOrganization.update>[0]["data"],
      });
    } else {
      await prisma.issuerOrganization.update({
        where: { id: organizationId },
        data: updateData as Parameters<typeof prisma.issuerOrganization.update>[0]["data"],
      });
    }

    logger.info({ organizationId, portalType, userId }, "Organization profile updated");

    return { success: true };
  }

  /**
   * Accept Terms and Conditions for an organization
   */
  async acceptTnc(
    req: Request,
    userId: string,
    organizationId: string,
    portalType: PortalType
  ): Promise<{ success: boolean; tncAccepted: boolean }> {
    // Verify access
    const organization = await this.getOrganization(userId, organizationId, portalType);

    // Only owner can accept T&C
    if (organization.owner_user_id !== userId) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "Only the organization owner can accept Terms and Conditions"
      );
    }

    // Check if already accepted
    if ((organization as { tnc_accepted?: boolean }).tnc_accepted) {
      return { success: true, tncAccepted: true };
    }

    logger.info(
      { organizationId, portalType, userId },
      "Accepting Terms and Conditions for organization"
    );

    // Update the organization's tnc_accepted flag
    if (portalType === "investor") {
      await prisma.investorOrganization.update({
        where: { id: organizationId },
        data: { tnc_accepted: true },
      });
    } else {
      await prisma.issuerOrganization.update({
        where: { id: organizationId },
        data: { tnc_accepted: true },
      });
    }

    // Log the T&C acceptance event
    const { ipAddress, userAgent, deviceInfo, deviceType } = extractRequestMetadata(req);
    const role = portalType === "investor" ? UserRole.INVESTOR : UserRole.ISSUER;
    const portal = getPortalFromRole(role);

    // Get user for logging
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
    });

    if (user) {
      await this.authRepository.createOnboardingLog({
        userId: user.user_id,
        role,
        eventType: "TNC_APPROVED",
        portal,
        ipAddress,
        userAgent,
        deviceInfo,
        deviceType,
        organizationName: organization.name || undefined,
        investorOrganizationId: portalType === "investor" ? organizationId : undefined,
        issuerOrganizationId: portalType === "issuer" ? organizationId : undefined,
        metadata: {
          organizationId,
          organizationType: organization.type,
          organizationName: organization.name,
          role,
        },
      });

      logger.info({ userId, organizationId, portalType, role }, "T&C acceptance event logged");
    }

    return { success: true, tncAccepted: true };
  }

  /**
   * Invite a member to an organization
   */
  async inviteMember(
    userId: string,
    organizationId: string,
    portalType: PortalType,
    input: InviteMemberInput
  ): Promise<{ success: boolean; invitationId: string; emailSent: boolean; invitationUrl?: string; emailError?: string }> {
    // Verify access
    const organization = await this.getOrganization(userId, organizationId, portalType);

    // Only admins can invite members
    const userMember = organization.members.find(
      (m: { user_id: string; role: string }) => m.user_id === userId
    );
    const canManage =
      organization.owner_user_id === userId ||
      userMember?.role === OrganizationMemberRole.ORGANIZATION_ADMIN;

    if (!canManage) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to invite members");
    }

    // Check if user already exists (only if email is provided)
    if (input.email) {
      const targetUser = await this.repository.findUserByEmail(input.email);
      if (targetUser) {
        // Check if already a member
        const isMember =
          portalType === "investor"
            ? await this.repository.isInvestorOrganizationMember(organizationId, targetUser.user_id)
            : await this.repository.isIssuerOrganizationMember(organizationId, targetUser.user_id);

        if (isMember) {
          throw new AppError(400, "ALREADY_MEMBER", "User is already a member of this organization");
        }
      }
    }

    // Use placeholder email if not provided (for link-based invitations)
    const email = input.email?.toLowerCase() || `invitation-${Date.now()}@cashsouk.com`;

    // Generate invitation token
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Create invitation
    let invitation;
    if (portalType === "investor") {
      invitation = await this.repository.createInvestorOrganizationInvitation({
        email,
        role: input.role === "ORGANIZATION_ADMIN"
          ? OrganizationMemberRole.ORGANIZATION_ADMIN
          : OrganizationMemberRole.ORGANIZATION_MEMBER,
        investorOrganizationId: organizationId,
        token,
        expiresAt,
        invitedByUserId: userId,
      });
    } else {
      invitation = await this.repository.createIssuerOrganizationInvitation({
        email,
        role: input.role === "ORGANIZATION_ADMIN"
          ? OrganizationMemberRole.ORGANIZATION_ADMIN
          : OrganizationMemberRole.ORGANIZATION_MEMBER,
        issuerOrganizationId: organizationId,
        token,
        expiresAt,
        invitedByUserId: userId,
      });
    }

    // Send invitation email
    const inviter = await prisma.user.findUnique({
      where: { user_id: userId },
      select: { first_name: true, last_name: true },
    });
    const inviterName = inviter
      ? `${inviter.first_name} ${inviter.last_name}`
      : undefined;

    const portalUrl =
      portalType === "investor"
        ? process.env.INVESTOR_URL || "http://localhost:3002"
        : process.env.ISSUER_URL || "http://localhost:3001";

    const inviteLink = `${portalUrl}/accept-invitation?token=${token}`;
    const orgName = organization.name || "the organization";

    let emailSent = false;
    let emailError: string | undefined;

    // Only send email if email was provided
    if (input.email) {
      try {
        const template = organizationInvitationTemplate(
          inviteLink,
          input.role as OrganizationMemberRole,
          orgName,
          portalType,
          inviterName
        );

        await sendEmail({
          to: input.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
        });

        emailSent = true;
        logger.info({ invitationId: invitation.id, email: input.email, inviteLink }, "Invitation email sent");
      } catch (error) {
        emailError = error instanceof Error ? error.message : String(error);
        logger.error(
          {
            error: emailError,
            invitationId: invitation.id,
            email: input.email,
            inviteLink,
            sesRegion: process.env.SES_REGION || process.env.AWS_REGION,
            emailFrom: process.env.EMAIL_FROM,
          },
          "Failed to send invitation email - invitation URL available for manual sharing"
        );
      }
    }

    return {
      success: true,
      invitationId: invitation.id,
      emailSent,
      invitationUrl: inviteLink,
      emailError: emailError || undefined,
    };
  }

  /**
   * Generate invitation URL without sending email
   */
  async generateMemberInvitationUrl(
    userId: string,
    organizationId: string,
    portalType: PortalType,
    input: { email?: string; role: "ORGANIZATION_ADMIN" | "ORGANIZATION_MEMBER" }
  ): Promise<{ invitationUrl: string; token: string }> {
    // Verify access
    const organization = await this.getOrganization(userId, organizationId, portalType);

    // Only admins can generate invites
    const userMember = organization.members.find(
      (m: { user_id: string; role: string }) => m.user_id === userId
    );
    const canManage =
      organization.owner_user_id === userId ||
      userMember?.role === OrganizationMemberRole.ORGANIZATION_ADMIN;

    if (!canManage) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to generate invitation links");
    }

    // Use placeholder email if not provided (for link-based invitations)
    const email = input.email?.toLowerCase() || `invitation-${Date.now()}@cashsouk.com`;

    // Check if invitation already exists for this email and role
    const existingInvitation =
      portalType === "investor"
        ? await prisma.investorOrganizationInvitation.findFirst({
          where: {
            email,
            role: input.role === "ORGANIZATION_ADMIN"
              ? OrganizationMemberRole.ORGANIZATION_ADMIN
              : OrganizationMemberRole.ORGANIZATION_MEMBER,
            accepted: false,
            expires_at: { gt: new Date() },
            investor_organization_id: organizationId,
          },
          orderBy: { created_at: "desc" },
        })
        : await prisma.issuerOrganizationInvitation.findFirst({
          where: {
            email,
            role: input.role === "ORGANIZATION_ADMIN"
              ? OrganizationMemberRole.ORGANIZATION_ADMIN
              : OrganizationMemberRole.ORGANIZATION_MEMBER,
            accepted: false,
            expires_at: { gt: new Date() },
            issuer_organization_id: organizationId,
          },
          orderBy: { created_at: "desc" },
        });

    let token: string;
    if (existingInvitation) {
      // Reuse existing invitation token
      token = existingInvitation.token;
    } else {
      // Generate secure token
      token = randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      // Create invitation record
      if (portalType === "investor") {
        await this.repository.createInvestorOrganizationInvitation({
          email,
          role: input.role === "ORGANIZATION_ADMIN"
            ? OrganizationMemberRole.ORGANIZATION_ADMIN
            : OrganizationMemberRole.ORGANIZATION_MEMBER,
          investorOrganizationId: organizationId,
          token,
          expiresAt,
          invitedByUserId: userId,
        });
      } else {
        await this.repository.createIssuerOrganizationInvitation({
          email,
          role: input.role === "ORGANIZATION_ADMIN"
            ? OrganizationMemberRole.ORGANIZATION_ADMIN
            : OrganizationMemberRole.ORGANIZATION_MEMBER,
          issuerOrganizationId: organizationId,
          token,
          expiresAt,
          invitedByUserId: userId,
        });
      }
    }

    // Generate invitation URL
    const portalUrl =
      portalType === "investor"
        ? process.env.INVESTOR_URL || "http://localhost:3002"
        : process.env.ISSUER_URL || "http://localhost:3001";

    const inviteUrl = `${portalUrl}/accept-invitation?token=${token}`;

    return { invitationUrl: inviteUrl, token };
  }

  /**
   * Accept an organization invitation
   */
  async acceptInvitation(
    userId: string,
    input: AcceptOrganizationInvitationInput
  ): Promise<{ success: boolean; organizationId: string; portalType: PortalType }> {
    // Find invitation by token
    const invitation = await this.repository.findInvitationByToken(input.token);

    if (!invitation) {
      throw new AppError(404, "INVITATION_NOT_FOUND", "Invalid or expired invitation token");
    }

    if (invitation.accepted) {
      throw new AppError(400, "ALREADY_ACCEPTED", "This invitation has already been accepted");
    }

    if (invitation.expires_at < new Date()) {
      throw new AppError(400, "EXPIRED", "This invitation has expired");
    }

    // Verify email matches
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      select: { email: true },
    });

    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }

    // Check if this is a placeholder email (link-based invitation)
    const isPlaceholderEmail = invitation.email.startsWith('invitation-') && 
                              invitation.email.includes('@cashsouk.com');

    // For non-placeholder invitations, verify email matches
    if (!isPlaceholderEmail && user.email !== invitation.email) {
      throw new AppError(
        403,
        "EMAIL_MISMATCH",
        "This invitation was sent to a different email address"
      );
    }

    // If it's a placeholder email, update it to the real user's email
    if (isPlaceholderEmail) {
      if (invitation.investor_organization_id) {
        await prisma.investorOrganizationInvitation.update({
          where: { id: invitation.id },
          data: { email: user.email },
        });
      } else if (invitation.issuer_organization_id) {
        await prisma.issuerOrganizationInvitation.update({
          where: { id: invitation.id },
          data: { email: user.email },
        });
      }
    }

    // Check if already a member
    if (invitation.investor_organization_id) {
      const isMember = await this.repository.isInvestorOrganizationMember(
        invitation.investor_organization_id,
        userId
      );
      if (isMember) {
        throw new AppError(400, "ALREADY_MEMBER", "You are already a member of this organization");
      }
    } else if (invitation.issuer_organization_id) {
      const isMember = await this.repository.isIssuerOrganizationMember(
        invitation.issuer_organization_id!,
        userId
      );
      if (isMember) {
        throw new AppError(400, "ALREADY_MEMBER", "You are already a member of this organization");
      }
    }

    // Add member to organization
    if (invitation.investor_organization_id) {
      await this.repository.addOrganizationMember({
        userId,
        investorOrganizationId: invitation.investor_organization_id,
        role: invitation.role,
      });
    } else {
      await this.repository.addOrganizationMember({
        userId,
        issuerOrganizationId: invitation.issuer_organization_id!,
        role: invitation.role,
      });
    }

    // Mark invitation as accepted
    await this.repository.acceptInvitation(input.token);

    logger.info(
      {
        userId,
        invitationId: invitation.id,
        organizationId: invitation.investor_organization_id || invitation.issuer_organization_id,
      },
      "Invitation accepted"
    );

    return {
      success: true,
      organizationId: invitation.investor_organization_id || invitation.issuer_organization_id!,
      portalType: invitation.investor_organization_id ? "investor" : "issuer",
    };
  }

  /**
   * Get pending invitations for an organization
   */
  async getPendingInvitations(
    userId: string,
    organizationId: string,
    portalType: PortalType
  ): Promise<Array<{
    id: string;
    email: string;
    role: OrganizationMemberRole;
    expiresAt: Date;
    createdAt: Date;
    invitedBy: {
      firstName: string;
      lastName: string;
      email: string;
    };
  }>> {
    // Verify access
    const organization = await this.getOrganization(userId, organizationId, portalType);

    // Only admins can view invitations
    const userMember = organization.members.find(
      (m: { user_id: string; role: string }) => m.user_id === userId
    );
    const canManage =
      organization.owner_user_id === userId ||
      userMember?.role === OrganizationMemberRole.ORGANIZATION_ADMIN;

    if (!canManage) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to view invitations");
    }

    let invitations;
    if (portalType === "investor") {
      invitations = await this.repository.getInvestorOrganizationInvitations(organizationId);
    } else {
      invitations = await this.repository.getIssuerOrganizationInvitations(organizationId);
    }

    return invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      token: inv.token,
      expiresAt: inv.expires_at,
      createdAt: inv.created_at,
      invitedBy: {
        firstName: inv.invited_by.first_name,
        lastName: inv.invited_by.last_name,
        email: inv.invited_by.email,
      },
    }));
  }

  /**
   * Resend invitation email
   */
  async resendInvitation(
    userId: string,
    organizationId: string,
    portalType: PortalType,
    invitationId: string
  ): Promise<{ success: boolean; emailSent: boolean; emailError?: string; invitationUrl?: string }> {
    // Verify access
    await this.getOrganization(userId, organizationId, portalType);

    // Find invitation
    let invitation;
    if (portalType === "investor") {
      invitation = await prisma.investorOrganizationInvitation.findUnique({
        where: { id: invitationId },
        include: {
          investor_organization: {
            select: { name: true },
          },
          invited_by: {
            select: { first_name: true, last_name: true },
          },
        },
      });
    } else {
      invitation = await prisma.issuerOrganizationInvitation.findUnique({
        where: { id: invitationId },
        include: {
          issuer_organization: {
            select: { name: true },
          },
          invited_by: {
            select: { first_name: true, last_name: true },
          },
        },
      });
    }

    if (!invitation) {
      throw new AppError(404, "NOT_FOUND", "Invitation not found");
    }

    if (invitation.accepted) {
      throw new AppError(400, "ALREADY_ACCEPTED", "This invitation has already been accepted");
    }

    // Send email
    const inviterName = invitation.invited_by
      ? `${invitation.invited_by.first_name} ${invitation.invited_by.last_name}`
      : undefined;

    const portalUrl =
      portalType === "investor"
        ? process.env.INVESTOR_URL || "http://localhost:3002"
        : process.env.ISSUER_URL || "http://localhost:3001";

    const inviteLink = `${portalUrl}/accept-invitation?token=${invitation.token}`;
    const orgName =
      (invitation as any).investor_organization?.name ||
      (invitation as any).issuer_organization?.name ||
      "the organization";

    let emailSent = false;
    try {
      const template = organizationInvitationTemplate(
        inviteLink,
        invitation.role,
        orgName,
        portalType,
        inviterName
      );

      await sendEmail({
        to: invitation.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });

      emailSent = true;
      logger.info({ invitationId }, "Invitation email resent");
    } catch (error) {
      const emailError = error instanceof Error ? error.message : String(error);
      logger.error({ error: emailError, invitationId }, "Failed to resend invitation email");
      return { success: true, emailSent: false, emailError, invitationUrl: inviteLink };
    }

    return { success: true, emailSent, invitationUrl: inviteLink };
  }

  /**
   * Revoke an invitation
   */
  async revokeInvitation(
    userId: string,
    organizationId: string,
    portalType: PortalType,
    invitationId: string
  ): Promise<{ success: boolean }> {
    // Verify access
    await this.getOrganization(userId, organizationId, portalType);

    await this.repository.revokeInvitation(invitationId, portalType);

    logger.info({ invitationId, organizationId }, "Invitation revoked");

    return { success: true };
  }

  /**
   * Leave an organization
   */
  async leaveOrganization(
    userId: string,
    organizationId: string,
    portalType: PortalType
  ): Promise<{ success: boolean }> {
    // Verify access
    const organization = await this.getOrganization(userId, organizationId, portalType);

    // Check if user is a member
    const userMember = organization.members.find(
      (m: { user_id: string; role: string }) => m.user_id === userId
    );

    if (!userMember) {
      throw new AppError(404, "NOT_MEMBER", "You are not a member of this organization");
    }

    // Owner cannot leave - must transfer ownership first
    const isOwner = organization.owner_user_id === userId;
    if (isOwner) {
      throw new AppError(
        400,
        "OWNER_CANNOT_LEAVE",
        "Organization owner cannot leave. Please transfer ownership to another member first."
      );
    }

    // Check if user is admin - must ensure at least 1 admin remains
    const isAdmin = userMember.role === OrganizationMemberRole.ORGANIZATION_ADMIN;
    if (isAdmin) {
      const adminCount = await this.repository.countOrganizationAdmins(organizationId, portalType);
      if (adminCount <= 1) {
        throw new AppError(
          400,
          "LAST_ADMIN",
          "Cannot leave - at least one organization admin must remain. Please promote another member to admin first."
        );
      }
    }

    // Remove member
    if (portalType === "investor") {
      await this.repository.removeInvestorOrganizationMember(organizationId, userId);
    } else {
      await this.repository.removeIssuerOrganizationMember(organizationId, userId);
    }

    logger.info({ userId, organizationId, portalType, wasOwner: isOwner }, "Member left organization");

    return { success: true };
  }

  /**
   * Change member role (promote/demote)
   */
  async changeMemberRole(
    userId: string,
    organizationId: string,
    portalType: PortalType,
    input: ChangeMemberRoleInput
  ): Promise<{ success: boolean }> {
    // Verify access
    const organization = await this.getOrganization(userId, organizationId, portalType);

    // Only admins can change roles
    const userMember = organization.members.find(
      (m: { user_id: string; role: string }) => m.user_id === userId
    );
    const canManage =
      organization.owner_user_id === userId ||
      userMember?.role === OrganizationMemberRole.ORGANIZATION_ADMIN;

    if (!canManage) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to change member roles");
    }

    // Cannot change owner's role
    if (input.userId === organization.owner_user_id) {
      throw new AppError(400, "CANNOT_CHANGE_OWNER", "Cannot change organization owner's role");
    }

    // Cannot demote yourself
    if (input.userId === userId && input.role === "ORGANIZATION_MEMBER") {
      throw new AppError(400, "CANNOT_DEMOTE_SELF", "You cannot demote yourself. Please ask another admin to do so.");
    }

    // Check if target is a member
    const targetMember = organization.members.find(
      (m: { user_id: string }) => m.user_id === input.userId
    );
    if (!targetMember) {
      throw new AppError(404, "NOT_FOUND", "Member not found in organization");
    }

    // If demoting from admin, check if it's the last admin
    if (
      targetMember.role === OrganizationMemberRole.ORGANIZATION_ADMIN &&
      input.role === "ORGANIZATION_MEMBER"
    ) {
      const adminCount = await this.repository.countOrganizationAdmins(organizationId, portalType);
      if (adminCount === 1) {
        throw new AppError(
          400,
          "LAST_ADMIN",
          "Cannot demote - at least one organization admin must remain"
        );
      }
    }

    // Update role
    const newRole =
      input.role === "ORGANIZATION_ADMIN"
        ? OrganizationMemberRole.ORGANIZATION_ADMIN
        : OrganizationMemberRole.ORGANIZATION_MEMBER;

    await this.repository.updateMemberRole(organizationId, input.userId, newRole, portalType);

    logger.info(
      { organizationId, targetUserId: input.userId, newRole },
      "Member role changed"
    );

    return { success: true };
  }

  /**
   * Transfer organization ownership to another member
   */
  async transferOwnership(
    userId: string,
    organizationId: string,
    portalType: PortalType,
    input: { newOwnerId: string }
  ): Promise<{ success: boolean }> {
    // Verify access
    const organization = await this.getOrganization(userId, organizationId, portalType);

    // Only current owner can transfer ownership
    if (organization.owner_user_id !== userId) {
      throw new AppError(403, "FORBIDDEN", "Only the organization owner can transfer ownership");
    }

    // Verify new owner is a member
    const newOwnerMember = organization.members.find(
      (m: { user_id: string }) => m.user_id === input.newOwnerId
    );

    if (!newOwnerMember) {
      throw new AppError(404, "NOT_FOUND", "New owner must be a member of the organization");
    }

    // Cannot transfer to self
    if (input.newOwnerId === userId) {
      throw new AppError(400, "INVALID_TRANSFER", "Cannot transfer ownership to yourself");
    }

    // Update owner_user_id and ensure new owner is an admin
    if (portalType === "investor") {
      await prisma.$transaction([
        // Update organization owner
        prisma.investorOrganization.update({
          where: { id: organizationId },
          data: { owner_user_id: input.newOwnerId },
        }),
        // Ensure new owner has admin role
        prisma.organizationMember.updateMany({
          where: {
            user_id: input.newOwnerId,
            investor_organization_id: organizationId,
          },
          data: {
            role: OrganizationMemberRole.ORGANIZATION_ADMIN,
          },
        }),
      ]);
    } else {
      await prisma.$transaction([
        // Update organization owner
        prisma.issuerOrganization.update({
          where: { id: organizationId },
          data: { owner_user_id: input.newOwnerId },
        }),
        // Ensure new owner has admin role
        prisma.organizationMember.updateMany({
          where: {
            user_id: input.newOwnerId,
            issuer_organization_id: organizationId,
          },
          data: {
            role: OrganizationMemberRole.ORGANIZATION_ADMIN,
          },
        }),
      ]);
    }

    logger.info(
      { organizationId, previousOwner: userId, newOwner: input.newOwnerId, portalType },
      "Ownership transferred"
    );

    return { success: true };
  }

  /**
   * Get corporate entities (directors, shareholders)
   */
  async getCorporateEntities(
    userId: string,
    organizationId: string,
    portalType: PortalType
  ): Promise<{
    directors: Array<Record<string, unknown>>;
    shareholders: Array<Record<string, unknown>>;
    corporateShareholders: Array<Record<string, unknown>>;
  }> {
    // Verify access
    await this.getOrganization(userId, organizationId, portalType);

    let organization;
    if (portalType === "investor") {
      organization = await prisma.investorOrganization.findUnique({
        where: { id: organizationId },
        select: { corporate_entities: true },
      });
    } else {
      organization = await prisma.issuerOrganization.findUnique({
        where: { id: organizationId },
        select: { corporate_entities: true },
      });
    }

    const entities = (organization?.corporate_entities as any) || {};

    return {
      directors: entities.directors || [],
      shareholders: entities.shareholders || [],
      corporateShareholders: entities.corporateShareholders || [],
    };
  }

  /**
   * Update corporate info
   */
  async updateCorporateInfo(
    userId: string,
    organizationId: string,
    portalType: PortalType,
    input: UpdateCorporateInfoInput
  ): Promise<{ success: boolean }> {
    // Verify access
    const organization = await this.getOrganization(userId, organizationId, portalType);

    // Only admins can update corporate info
    const userMember = organization.members.find(
      (m: { user_id: string; role: string }) => m.user_id === userId
    );
    const canManage =
      organization.owner_user_id === userId ||
      userMember?.role === OrganizationMemberRole.ORGANIZATION_ADMIN;

    if (!canManage) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to update corporate info");
    }

    await this.repository.updateCorporateInfo(organizationId, portalType, input);

    logger.info({ organizationId, portalType, userId }, "Corporate info updated");

    return { success: true };
  }
}
