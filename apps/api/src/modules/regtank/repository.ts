import { prisma } from "../../lib/prisma";
import { RegTankOnboarding, OrganizationType } from "@prisma/client";

export type RegTankOnboardingWithRelations = RegTankOnboarding & {
  user: {
    user_id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  investor_organization?: {
    id: string;
    name: string | null;
    type: OrganizationType;
  } | null;
  issuer_organization?: {
    id: string;
    name: string | null;
    type: OrganizationType;
  } | null;
};

export class RegTankRepository {
  /**
   * Create a new RegTank onboarding record
   */
  async createOnboarding(data: {
    userId: string;
    organizationId?: string;
    organizationType: OrganizationType;
    portalType: string;
    requestId: string;
    referenceId: string;
    onboardingType: string;
    verifyLink?: string;
    verifyLinkExpiresAt?: Date;
    status: string;
    substatus?: string;
    regtankResponse?: any;
  }): Promise<RegTankOnboarding> {
    // Set the appropriate organization ID field based on portal type
    const investorOrgId = data.portalType === "investor" ? data.organizationId : null;
    const issuerOrgId = data.portalType === "issuer" ? data.organizationId : null;

    return prisma.regTankOnboarding.create({
      data: {
        user_id: data.userId,
        investor_organization_id: investorOrgId,
        issuer_organization_id: issuerOrgId,
        organization_type: data.organizationType,
        portal_type: data.portalType,
        request_id: data.requestId,
        reference_id: data.referenceId,
        onboarding_type: data.onboardingType,
        verify_link: data.verifyLink,
        verify_link_expires_at: data.verifyLinkExpiresAt,
        status: data.status,
        substatus: data.substatus,
        regtank_response: data.regtankResponse,
      },
    });
  }

  /**
   * Find onboarding by RegTank's requestId
   */
  async findByRequestId(
    requestId: string
  ): Promise<RegTankOnboardingWithRelations | null> {
    return prisma.regTankOnboarding.findUnique({
      where: { request_id: requestId },
      include: {
        user: {
          select: {
            user_id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
        investor_organization: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        issuer_organization: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });
  }

  /**
   * Find onboarding by our internal referenceId
   */
  async findByReferenceId(
    referenceId: string
  ): Promise<RegTankOnboardingWithRelations | null> {
    return prisma.regTankOnboarding.findUnique({
      where: { reference_id: referenceId },
      include: {
        user: {
          select: {
            user_id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
        investor_organization: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        issuer_organization: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });
  }

  /**
   * Find onboarding by organization ID
   */
  async findByOrganizationId(
    organizationId: string,
    portalType: "investor" | "issuer"
  ): Promise<RegTankOnboardingWithRelations | null> {
    const whereClause = portalType === "investor"
      ? { investor_organization_id: organizationId }
      : { issuer_organization_id: organizationId };

    return prisma.regTankOnboarding.findFirst({
      where: whereClause,
      include: {
        user: {
          select: {
            user_id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
        investor_organization: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        issuer_organization: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });
  }

  /**
   * Update onboarding status
   */
  async updateStatus(
    requestId: string,
    data: {
      status: string;
      substatus?: string;
      verifyLink?: string;
      verifyLinkExpiresAt?: Date;
      submittedAt?: Date;
      completedAt?: Date;
    }
  ): Promise<RegTankOnboarding> {
    return prisma.regTankOnboarding.update({
      where: { request_id: requestId },
      data: {
        status: data.status,
        substatus: data.substatus,
        verify_link: data.verifyLink,
        verify_link_expires_at: data.verifyLinkExpiresAt,
        submitted_at: data.submittedAt,
        completed_at: data.completedAt,
      },
    });
  }

  /**
   * Append webhook payload to the webhook_payloads array
   */
  async appendWebhookPayload(
    requestId: string,
    payload: any
  ): Promise<RegTankOnboarding> {
    const existing = await prisma.regTankOnboarding.findUnique({
      where: { request_id: requestId },
      select: { webhook_payloads: true },
    });

    const currentPayloads = (existing?.webhook_payloads as any[]) || [];
    const updatedPayloads = [...currentPayloads, payload];

    return prisma.regTankOnboarding.update({
      where: { request_id: requestId },
      data: {
        webhook_payloads: updatedPayloads,
      },
    });
  }

  /**
   * Find pending onboardings (awaiting completion)
   */
  async findPendingOnboardings(): Promise<RegTankOnboarding[]> {
    return prisma.regTankOnboarding.findMany({
      where: {
        status: {
          in: ["PENDING", "IN_PROGRESS"],
        },
      },
      orderBy: { created_at: "desc" },
    });
  }

  /**
   * Find onboardings by user ID
   */
  async findByUserId(userId: string): Promise<RegTankOnboarding[]> {
    return prisma.regTankOnboarding.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
    });
  }

  /**
   * Find active onboarding by user ID and portal type
   * Returns the most recent active onboarding that hasn't expired
   */
  async findActiveOnboardingByUserId(
    userId: string,
    portalType: "investor" | "issuer"
  ): Promise<RegTankOnboardingWithRelations | null> {
    const now = new Date();
    return prisma.regTankOnboarding.findFirst({
      where: {
        user_id: userId,
        portal_type: portalType,
        status: {
          in: ["IN_PROGRESS", "FORM_FILLING", "LIVENESS_PASSED", "PENDING_APPROVAL"],
        },
        verify_link: {
          not: null,
        },
        verify_link_expires_at: {
          gt: now,
        },
      },
      include: {
        user: {
          select: {
            user_id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
        investor_organization: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        issuer_organization: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });
  }

  /**
   * Update RegTank response data
   */
  async updateRegTankResponse(
    requestId: string,
    response: any
  ): Promise<RegTankOnboarding> {
    return prisma.regTankOnboarding.update({
      where: { request_id: requestId },
      data: {
        regtank_response: response,
      },
    });
  }
}

