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
  regtank_onboarding?: {
    status: string;
    verify_link: string | null;
    request_id: string;
  } | null;
  // Approval workflow flags
  onboarding_approved: boolean;
  aml_approved: boolean;
  tnc_accepted: boolean;
  deposit_received?: boolean; // Only for investor organizations
  ssm_approved?: boolean; // Only for investor organizations
  ssm_checked?: boolean; // Only for issuer organizations
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
        onboarding_status:
          data.type === OrganizationType.PERSONAL
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
        onboarding_status:
          data.type === OrganizationType.PERSONAL
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
    const org = await prisma.investorOrganization.findUnique({
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
        regtank_onboarding: {
          orderBy: { created_at: "desc" },
          take: 1,
          select: {
            status: true,
            verify_link: true,
            request_id: true,
          },
        },
      },
    });

    if (!org) return null;

    return {
      ...org,
      regtank_onboarding: org.regtank_onboarding[0] || null,
    } as OrganizationWithMembers;
  }

  /**
   * Find issuer organization by ID
   */
  async findIssuerOrganizationById(id: string): Promise<OrganizationWithMembers | null> {
    const org = await prisma.issuerOrganization.findUnique({
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
        regtank_onboarding: {
          orderBy: { created_at: "desc" },
          take: 1,
          select: {
            status: true,
            verify_link: true,
            request_id: true,
          },
        },
      },
    });

    if (!org) return null;

    return {
      ...org,
      regtank_onboarding: org.regtank_onboarding[0] || null,
    } as OrganizationWithMembers;
  }

  /**
   * List all investor organizations for a user (as owner or member)
   */
  async listInvestorOrganizationsForUser(userId: string): Promise<OrganizationWithMembers[]> {
    const organizations = await prisma.investorOrganization.findMany({
      where: {
        OR: [{ owner_user_id: userId }, { members: { some: { user_id: userId } } }],
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
        regtank_onboarding: {
          orderBy: { created_at: "desc" },
          take: 1,
          select: {
            status: true,
            verify_link: true,
            request_id: true,
          },
        },
      },
      orderBy: { created_at: "asc" },
    });

    return organizations.map((org) => ({
      ...org,
      regtank_onboarding: org.regtank_onboarding[0] || null,
    })) as OrganizationWithMembers[];
  }

  /**
   * List all issuer organizations for a user (as owner or member)
   */
  async listIssuerOrganizationsForUser(userId: string): Promise<OrganizationWithMembers[]> {
    const organizations = await prisma.issuerOrganization.findMany({
      where: {
        OR: [{ owner_user_id: userId }, { members: { some: { user_id: userId } } }],
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
        regtank_onboarding: {
          orderBy: { created_at: "desc" },
          take: 1,
          select: {
            status: true,
            verify_link: true,
            request_id: true,
          },
        },
      },
      orderBy: { created_at: "asc" },
    });

    return organizations.map((org) => ({
      ...org,
      regtank_onboarding: org.regtank_onboarding[0] || null,
    })) as OrganizationWithMembers[];
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
    const updateData: {
      onboarding_status: OnboardingStatus;
      onboarded_at: Date | null;
      onboarding_approved?: boolean;
    } = {
      onboarding_status: status,
      onboarded_at: status === OnboardingStatus.COMPLETED ? new Date() : null,
    };

    // Set onboarding_approved to true when status is PENDING_APPROVAL
    if (status === OnboardingStatus.PENDING_APPROVAL) {
      updateData.onboarding_approved = true;
    }

    return prisma.investorOrganization.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Update issuer organization onboarding status
   */
  async updateIssuerOrganizationOnboarding(
    id: string,
    status: OnboardingStatus
  ): Promise<IssuerOrganization> {
    const updateData: {
      onboarding_status: OnboardingStatus;
      onboarded_at: Date | null;
      onboarding_approved?: boolean;
    } = {
      onboarding_status: status,
      onboarded_at: status === OnboardingStatus.COMPLETED ? new Date() : null,
    };

    // Set onboarding_approved to true when status is PENDING_APPROVAL
    if (status === OnboardingStatus.PENDING_APPROVAL) {
      updateData.onboarding_approved = true;
    }

    return prisma.issuerOrganization.update({
      where: { id },
      data: updateData,
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

  /**
   * Count organization admins
   */
  async countOrganizationAdmins(
    organizationId: string,
    portalType: "investor" | "issuer"
  ): Promise<number> {
    const where =
      portalType === "investor"
        ? {
            investor_organization_id: organizationId,
            role: OrganizationMemberRole.ORGANIZATION_ADMIN,
          }
        : {
            issuer_organization_id: organizationId,
            role: OrganizationMemberRole.ORGANIZATION_ADMIN,
          };

    return prisma.organizationMember.count({ where });
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    organizationId: string,
    userId: string,
    role: OrganizationMemberRole,
    portalType: "investor" | "issuer"
  ): Promise<OrganizationMember> {
    if (portalType === "investor") {
      const member = await prisma.organizationMember.findFirstOrThrow({
        where: {
          investor_organization_id: organizationId,
          user_id: userId,
        },
      });
      return prisma.organizationMember.update({
        where: { id: member.id },
        data: { role },
      });
    } else {
      const member = await prisma.organizationMember.findFirstOrThrow({
        where: {
          issuer_organization_id: organizationId,
          user_id: userId,
        },
      });
      return prisma.organizationMember.update({
        where: { id: member.id },
        data: { role },
      });
    }
  }

  /**
   * Create investor organization invitation
   */
  async createInvestorOrganizationInvitation(data: {
    email: string;
    role: OrganizationMemberRole;
    investorOrganizationId: string;
    token: string;
    expiresAt: Date;
    invitedByUserId: string;
  }) {
    return prisma.investorOrganizationInvitation.create({
      data: {
        email: data.email,
        role: data.role,
        investor_organization_id: data.investorOrganizationId,
        token: data.token,
        expires_at: data.expiresAt,
        invited_by_user_id: data.invitedByUserId,
      },
    });
  }

  /**
   * Create issuer organization invitation
   */
  async createIssuerOrganizationInvitation(data: {
    email: string;
    role: OrganizationMemberRole;
    issuerOrganizationId: string;
    token: string;
    expiresAt: Date;
    invitedByUserId: string;
  }) {
    return prisma.issuerOrganizationInvitation.create({
      data: {
        email: data.email,
        role: data.role,
        issuer_organization_id: data.issuerOrganizationId,
        token: data.token,
        expires_at: data.expiresAt,
        invited_by_user_id: data.invitedByUserId,
      },
    });
  }

  /**
   * Find invitation by token
   */
  async findInvitationByToken(token: string): Promise<{
    id: string;
    email: string;
    role: OrganizationMemberRole;
    investor_organization_id: string | null;
    issuer_organization_id: string | null;
    expires_at: Date;
    accepted: boolean;
  } | null> {
    const investorInv = await prisma.investorOrganizationInvitation.findUnique({
      where: { token },
      select: {
        id: true,
        email: true,
        role: true,
        investor_organization_id: true,
        expires_at: true,
        accepted: true,
      },
    });

    if (investorInv) {
      return {
        ...investorInv,
        issuer_organization_id: null,
      };
    }

    const issuerInv = await prisma.issuerOrganizationInvitation.findUnique({
      where: { token },
      select: {
        id: true,
        email: true,
        role: true,
        issuer_organization_id: true,
        expires_at: true,
        accepted: true,
      },
    });

    if (issuerInv) {
      return {
        ...issuerInv,
        investor_organization_id: null,
      };
    }

    return null;
  }

  /**
   * Mark invitation as accepted
   */
  async acceptInvitation(token: string): Promise<void> {
    const investorInv = await prisma.investorOrganizationInvitation.findUnique({
      where: { token },
    });

    if (investorInv) {
      await prisma.investorOrganizationInvitation.update({
        where: { token },
        data: { accepted: true, accepted_at: new Date() },
      });
      return;
    }

    const issuerInv = await prisma.issuerOrganizationInvitation.findUnique({
      where: { token },
    });

    if (issuerInv) {
      await prisma.issuerOrganizationInvitation.update({
        where: { token },
        data: { accepted: true, accepted_at: new Date() },
      });
    }
  }

  /**
   * Get pending invitations for investor organization
   */
  async getInvestorOrganizationInvitations(organizationId: string) {
    return prisma.investorOrganizationInvitation.findMany({
      where: {
        investor_organization_id: organizationId,
        accepted: false,
        expires_at: { gt: new Date() },
      },
      include: {
        invited_by: {
          select: {
            user_id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });
  }

  /**
   * Get pending invitations for issuer organization
   */
  async getIssuerOrganizationInvitations(organizationId: string) {
    return prisma.issuerOrganizationInvitation.findMany({
      where: {
        issuer_organization_id: organizationId,
        accepted: false,
        expires_at: { gt: new Date() },
      },
      include: {
        invited_by: {
          select: {
            user_id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });
  }

  /**
   * Revoke invitation
   */
  async revokeInvitation(invitationId: string, portalType: "investor" | "issuer"): Promise<void> {
    if (portalType === "investor") {
      await prisma.investorOrganizationInvitation.delete({
        where: { id: invitationId },
      });
    } else {
      await prisma.issuerOrganizationInvitation.delete({
        where: { id: invitationId },
      });
    }
  }

  /**
   * Update corporate info
   */
  async updateCorporateInfo(
    organizationId: string,
    portalType: "investor" | "issuer",
    data: {
      tinNumber?: string | null;
      industry?: string | null;
      entityType?: string | null;
      businessName?: string | null;
      numberOfEmployees?: number | null;
      ssmRegisterNumber?: string | null;
      businessAddress?: {
        line1?: string | null;
        line2?: string | null;
        city?: string | null;
        postalCode?: string | null;
        state?: string | null;
        country?: string | null;
      } | null;
      registeredAddress?: {
        line1?: string | null;
        line2?: string | null;
        city?: string | null;
        postalCode?: string | null;
        state?: string | null;
        country?: string | null;
      } | null;
    }
  ) {
    const corporateData = {
      basicInfo: {
        ...(data.tinNumber !== undefined && { tinNumber: data.tinNumber }),
        ...(data.industry !== undefined && { industry: data.industry }),
        ...(data.entityType !== undefined && { entityType: data.entityType }),
        ...(data.businessName !== undefined && { businessName: data.businessName }),
        ...(data.numberOfEmployees !== undefined && {
          numberOfEmployees: data.numberOfEmployees,
        }),
        ...(data.ssmRegisterNumber !== undefined && {
          ssmRegisterNumber: data.ssmRegisterNumber,
        }),
      },
    };

    if (portalType === "investor") {
      const existing = await prisma.investorOrganization.findUnique({
        where: { id: organizationId },
        select: { corporate_onboarding_data: true },
      });

      const existingData = (existing?.corporate_onboarding_data as any) || {};
      const existingAddresses = existingData.addresses || {};
      
      const mergedData = {
        basicInfo: { ...existingData.basicInfo, ...corporateData.basicInfo },
        addresses: {
          // Merge business address if provided, otherwise keep existing
          business: data.businessAddress !== undefined 
            ? data.businessAddress 
            : (existingAddresses.business || existingAddresses.businessAddress || null),
          // Merge registered address if provided, otherwise keep existing
          registered: data.registeredAddress !== undefined 
            ? data.registeredAddress 
            : (existingAddresses.registered || existingAddresses.registeredAddress || null),
        },
      };

      return prisma.investorOrganization.update({
        where: { id: organizationId },
        data: { corporate_onboarding_data: mergedData },
      });
    } else {
      const existing = await prisma.issuerOrganization.findUnique({
        where: { id: organizationId },
        select: { corporate_onboarding_data: true },
      });

      const existingData = (existing?.corporate_onboarding_data as any) || {};
      const existingAddresses = existingData.addresses || {};
      
      const mergedData = {
        basicInfo: { ...existingData.basicInfo, ...corporateData.basicInfo },
        addresses: {
          // Merge business address if provided, otherwise keep existing
          business: data.businessAddress !== undefined 
            ? data.businessAddress 
            : (existingAddresses.business || existingAddresses.businessAddress || null),
          // Merge registered address if provided, otherwise keep existing
          registered: data.registeredAddress !== undefined 
            ? data.registeredAddress 
            : (existingAddresses.registered || existingAddresses.registeredAddress || null),
        },
      };

      return prisma.issuerOrganization.update({
        where: { id: organizationId },
        data: { corporate_onboarding_data: mergedData },
      });
    }
  }

  /**
   * Check if an investor organization with the same name already exists (case-insensitive, COMPANY type only)
   */
  async investorOrganizationNameExists(name: string): Promise<boolean> {
    const existing = await prisma.investorOrganization.findFirst({
      where: {
        type: OrganizationType.COMPANY,
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    });
    return !!existing;
  }

  /**
   * Check if an issuer organization with the same name already exists (case-insensitive, COMPANY type only)
   */
  async issuerOrganizationNameExists(name: string): Promise<boolean> {
    const existing = await prisma.issuerOrganization.findFirst({
      where: {
        type: OrganizationType.COMPANY,
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    });
    return !!existing;
  }

}
