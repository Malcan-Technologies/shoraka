import { OrganizationRepository, OrganizationWithMembers } from "./repository";
import { CreateOrganizationInput, AddMemberInput, PortalType } from "./schemas";
import {
  OrganizationType,
  OnboardingStatus,
  OrganizationMemberRole,
  InvestorOrganization,
  IssuerOrganization,
} from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";

export class OrganizationService {
  private repository: OrganizationRepository;

  constructor() {
    this.repository = new OrganizationRepository();
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
    const isMember = organization.members.some((m) => m.user_id === userId);
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
    const userMember = organization.members.find((m) => m.user_id === userId);
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
        ? await this.repository.isInvestorOrganizationMember(organizationId, targetUser.id)
        : await this.repository.isIssuerOrganizationMember(organizationId, targetUser.id);

    if (isMember) {
      throw new AppError(400, "ALREADY_MEMBER", "User is already a member of this organization");
    }

    const role =
      input.role === "DIRECTOR"
        ? OrganizationMemberRole.DIRECTOR
        : OrganizationMemberRole.MEMBER;

    logger.info(
      { organizationId, targetUserId: targetUser.id, role },
      "Adding member to organization"
    );

    // Add the member
    if (portalType === "investor") {
      await this.repository.addOrganizationMember({
        userId: targetUser.id,
        investorOrganizationId: organizationId,
        role,
      });
    } else {
      await this.repository.addOrganizationMember({
        userId: targetUser.id,
        issuerOrganizationId: organizationId,
        role,
      });
    }

    return {
      success: true,
      member: {
        id: targetUser.id,
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
    const userMember = organization.members.find((m) => m.user_id === userId);
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
    const targetMember = organization.members.find((m) => m.user_id === targetUserId);
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

