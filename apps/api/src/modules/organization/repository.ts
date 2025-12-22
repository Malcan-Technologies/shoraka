import { prisma } from "../../lib/prisma";
import {
  InvestorOrganization,
  IssuerOrganization,
  OrganizationMember,
  OrganizationType,
  OnboardingStatus,
  OrganizationMemberRole,
} from "@prisma/client";

export type OrganizationWithMembers = (InvestorOrganization | IssuerOrganization) & {
  members: (OrganizationMember & {
    user: {
      user_id: string;
      email: string;
      first_name: string;
      last_name: string;
    };
  })[];
};

export class OrganizationRepository {
  /**
   * Create an investor organization
   * 
   * Note: Personal accounts start with IN_PROGRESS when user clicks "Yes, create Personal Account".
   * Company accounts start with PENDING. Status is updated via RegTank webhooks:
   * - IN_PROGRESS → PENDING_APPROVAL (when liveness test completes)
   * - PENDING_APPROVAL → COMPLETED (when RegTank approves)
   */
  async createInvestorOrganization(data: {
    ownerUserId: string;
    type: OrganizationType;
    name?: string;
    registrationNumber?: string;
  }): Promise<InvestorOrganization> {
    return prisma.investorOrganization.create({
      data: {
        owner_user_id: data.ownerUserId,
        type: data.type,
        name: data.name,
        registration_number: data.registrationNumber,
        // Personal accounts: IN_PROGRESS when user clicks "Yes, create Personal Account"
        // Company accounts: PENDING (will be updated when onboarding starts)
        onboarding_status: data.type === OrganizationType.PERSONAL 
          ? OnboardingStatus.IN_PROGRESS 
          : OnboardingStatus.PENDING,
      },
    });
  }

  /**
   * Create an issuer organization
   * 
   * Note: Personal accounts start with IN_PROGRESS when user clicks "Yes, create Personal Account".
   * Company accounts start with PENDING. Status is updated via RegTank webhooks:
   * - IN_PROGRESS → PENDING_APPROVAL (when liveness test completes)
   * - PENDING_APPROVAL → COMPLETED (when RegTank approves)
   */
  async createIssuerOrganization(data: {
    ownerUserId: string;
    type: OrganizationType;
    name?: string;
    registrationNumber?: string;
  }): Promise<IssuerOrganization> {
    return prisma.issuerOrganization.create({
      data: {
        owner_user_id: data.ownerUserId,
        type: data.type,
        name: data.name,
        registration_number: data.registrationNumber,
        // Personal accounts: IN_PROGRESS when user clicks "Yes, create Personal Account"
        // Company accounts: PENDING (will be updated when onboarding starts)
        onboarding_status: data.type === OrganizationType.PERSONAL 
          ? OnboardingStatus.IN_PROGRESS 
          : OnboardingStatus.PENDING,
      },
    });
  }

  /**
   * Add a member to an organization
   */
  async addOrganizationMember(data: {
    userId: string;
    investorOrganizationId?: string;
    issuerOrganizationId?: string;
    role: OrganizationMemberRole;
  }): Promise<OrganizationMember> {
    return prisma.organizationMember.create({
      data: {
        user_id: data.userId,
        investor_organization_id: data.investorOrganizationId,
        issuer_organization_id: data.issuerOrganizationId,
        role: data.role,
      },
    });
  }

  /**
   * Find investor organization by ID
   */
  async findInvestorOrganizationById(id: string): Promise<OrganizationWithMembers | null> {
    return prisma.investorOrganization.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                user_id: true,
                email: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Find issuer organization by ID
   */
  async findIssuerOrganizationById(id: string): Promise<OrganizationWithMembers | null> {
    return prisma.issuerOrganization.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                user_id: true,
                email: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * List all investor organizations for a user (as owner or member)
   */
  async listInvestorOrganizationsForUser(userId: string): Promise<OrganizationWithMembers[]> {
    return prisma.investorOrganization.findMany({
      where: {
        OR: [
          { owner_user_id: userId },
          { members: { some: { user_id: userId } } },
        ],
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                user_id: true,
                email: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: "asc" },
    });
  }

  /**
   * List all issuer organizations for a user (as owner or member)
   */
  async listIssuerOrganizationsForUser(userId: string): Promise<OrganizationWithMembers[]> {
    return prisma.issuerOrganization.findMany({
      where: {
        OR: [
          { owner_user_id: userId },
          { members: { some: { user_id: userId } } },
        ],
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                user_id: true,
                email: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: "asc" },
    });
  }

  /**
   * Check if user has a personal investor organization
   */
  async hasPersonalInvestorOrganization(userId: string): Promise<boolean> {
    const count = await prisma.investorOrganization.count({
      where: {
        owner_user_id: userId,
        type: OrganizationType.PERSONAL,
      },
    });
    return count > 0;
  }

  /**
   * Check if user has a personal issuer organization
   */
  async hasPersonalIssuerOrganization(userId: string): Promise<boolean> {
    const count = await prisma.issuerOrganization.count({
      where: {
        owner_user_id: userId,
        type: OrganizationType.PERSONAL,
      },
    });
    return count > 0;
  }

  /**
   * Update investor organization onboarding status
   */
  async updateInvestorOrganizationOnboarding(
    id: string,
    status: OnboardingStatus
  ): Promise<InvestorOrganization> {
    return prisma.investorOrganization.update({
      where: { id },
      data: {
        onboarding_status: status,
        onboarded_at: status === OnboardingStatus.COMPLETED ? new Date() : null,
      },
    });
  }

  /**
   * Update issuer organization onboarding status
   */
  async updateIssuerOrganizationOnboarding(
    id: string,
    status: OnboardingStatus
  ): Promise<IssuerOrganization> {
    return prisma.issuerOrganization.update({
      where: { id },
      data: {
        onboarding_status: status,
        onboarded_at: status === OnboardingStatus.COMPLETED ? new Date() : null,
      },
    });
  }

  /**
   * Find user by email
   */
  async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: {
        user_id: true,
        email: true,
        first_name: true,
        last_name: true,
      },
    });
  }

  /**
   * Check if user is already a member of an investor organization
   */
  async isInvestorOrganizationMember(organizationId: string, userId: string): Promise<boolean> {
    const count = await prisma.organizationMember.count({
      where: {
        investor_organization_id: organizationId,
        user_id: userId,
      },
    });
    return count > 0;
  }

  /**
   * Check if user is already a member of an issuer organization
   */
  async isIssuerOrganizationMember(organizationId: string, userId: string): Promise<boolean> {
    const count = await prisma.organizationMember.count({
      where: {
        issuer_organization_id: organizationId,
        user_id: userId,
      },
    });
    return count > 0;
  }

  /**
   * Remove member from investor organization
   */
  async removeInvestorOrganizationMember(organizationId: string, userId: string): Promise<void> {
    await prisma.organizationMember.deleteMany({
      where: {
        investor_organization_id: organizationId,
        user_id: userId,
      },
    });
  }

  /**
   * Remove member from issuer organization
   */
  async removeIssuerOrganizationMember(organizationId: string, userId: string): Promise<void> {
    await prisma.organizationMember.deleteMany({
      where: {
        issuer_organization_id: organizationId,
        user_id: userId,
      },
    });
  }

  /**
   * Get organization member
   */
  async getOrganizationMember(
    organizationId: string,
    userId: string,
    portalType: "investor" | "issuer"
  ): Promise<OrganizationMember | null> {
    if (portalType === "investor") {
      return prisma.organizationMember.findFirst({
        where: {
          investor_organization_id: organizationId,
          user_id: userId,
        },
      });
    }
    return prisma.organizationMember.findFirst({
      where: {
        issuer_organization_id: organizationId,
        user_id: userId,
      },
    });
  }
}

