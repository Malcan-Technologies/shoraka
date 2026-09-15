import { OrganizationType } from "@prisma/client";
import { NotificationTypeIds } from "../../notification/registry";

const mockFindByRequestId = jest.fn();
const mockAppendWebhookPayload = jest.fn().mockResolvedValue(undefined);
const mockUpdateStatus = jest.fn().mockResolvedValue({});

jest.mock("../repository", () => ({
  RegTankRepository: jest.fn().mockImplementation(() => ({
    findByRequestId: (...args: unknown[]) => mockFindByRequestId(...args),
    appendWebhookPayload: (...args: unknown[]) => mockAppendWebhookPayload(...args),
    updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
  })),
}));

const mockHandleWebhookUpdate = jest.fn().mockResolvedValue(undefined);
jest.mock("../service", () => ({
  RegTankService: jest.fn().mockImplementation(() => ({
    handleWebhookUpdate: (...args: unknown[]) => mockHandleWebhookUpdate(...args),
  })),
}));

const mockUpdateInvestorOrganizationOnboarding = jest.fn();
jest.mock("../../organization/repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({
    findInvestorOrganizationById: jest.fn(),
    findIssuerOrganizationById: jest.fn(),
    updateInvestorOrganizationOnboarding: (...args: unknown[]) => mockUpdateInvestorOrganizationOnboarding(...args),
    updateIssuerOrganizationOnboarding: jest.fn(),
  })),
}));

jest.mock("../../auth/repository", () => ({
  AuthRepository: jest.fn().mockImplementation(() => ({
    createOnboardingLog: jest.fn(),
  })),
}));

const mockSendTypedAndLogSystem = jest.fn().mockResolvedValue(undefined);
jest.mock("../../notification/service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendTyped: jest.fn(),
    sendTypedAndLogSystem: (...args: unknown[]) => mockSendTypedAndLogSystem(...args),
  })),
}));

jest.mock("../../../lib/prisma", () => ({
  prisma: {
    ctosPartySupplement: { update: jest.fn().mockResolvedValue({}) },
    organizationPartyProfile: { findFirst: jest.fn() },
    issuerOrganization: { findUnique: jest.fn() },
    investorOrganization: { findUnique: jest.fn() },
    organizationMember: { findMany: jest.fn() },
  },
}));

jest.mock("../../organization/ctos-party-supplement-webhook-lookup", () => ({
  findCtosPartySupplementByOnboardingJsonMatch: jest.fn().mockResolvedValue(null),
}));

const mockEnrichApprovedCtosPartySupplement = jest.fn().mockResolvedValue(undefined);
jest.mock("../../organization-profile/regtank-party-seed", () => ({
  enrichApprovedCtosPartySupplement: (...args: unknown[]) => mockEnrichApprovedCtosPartySupplement(...args),
}));

import { prisma } from "../../../lib/prisma";
import { findCtosPartySupplementByOnboardingJsonMatch } from "../../organization/ctos-party-supplement-webhook-lookup";
import { IndividualOnboardingWebhookHandler } from "./individual-onboarding-handler";

function baseOnboardingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "row-1",
    request_id: "LD001-R01",
    reference_id: "REF001",
    status: "IN_PROGRESS",
    onboarding_type: "INDIVIDUAL",
    organization_type: OrganizationType.PERSONAL,
    investor_organization_id: "org-1",
    issuer_organization_id: null,
    portal_type: "investor",
    user_id: "user-1",
    submitted_at: null,
    ...overrides,
  };
}

describe("IndividualOnboardingWebhookHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (findCtosPartySupplementByOnboardingJsonMatch as jest.Mock).mockResolvedValue(null);
    mockEnrichApprovedCtosPartySupplement.mockResolvedValue(undefined);

    (prisma.organizationPartyProfile.findFirst as jest.Mock).mockResolvedValue({
      id: "party-1",
      name: "Jane Doe",
      entity_type: "INDIVIDUAL",
      user_id: "linked-user-1",
    });
    (prisma.issuerOrganization.findUnique as jest.Mock).mockResolvedValue({
      owner_user_id: "owner-1",
    });
    (prisma.investorOrganization.findUnique as jest.Mock).mockResolvedValue({
      owner_user_id: "owner-2",
    });
    // Organisation recipient helper returns owner + *all* organization members.
    // In these tests we model: owner-1 + two member users.
    (prisma.organizationMember.findMany as jest.Mock).mockResolvedValue([
      { user_id: "admin-1" },
      { user_id: "member-1" },
    ]);
  });

  it("immediate exact match performs one lookup", async () => {
    mockFindByRequestId.mockResolvedValue(baseOnboardingRow({ request_id: "LD001-R01", status: "PROCESSING" }));
    const handler = new IndividualOnboardingWebhookHandler();

    await (handler as any).handle({ requestId: "LD001-R01", status: "PROCESSING" });

    expect(mockFindByRequestId).toHaveBeenCalledTimes(1);
    expect(mockFindByRequestId).toHaveBeenCalledWith("LD001-R01");
    expect(mockAppendWebhookPayload).toHaveBeenCalledWith(
      "LD001-R01",
      expect.objectContaining({ requestId: "LD001-R01", status: "PROCESSING" })
    );
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "LD001-R01",
      expect.objectContaining({ status: "PROCESSING" })
    );
  });

  it("first miss then second exact hit processes webhook normally", async () => {
    mockFindByRequestId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(baseOnboardingRow({ request_id: "LD001-R01", status: "PROCESSING" }));
    const handler = new IndividualOnboardingWebhookHandler();

    await (handler as any).handle({
      requestId: "LD001-R01",
      status: "WAIT_FOR_APPROVAL",
      timestamp: "2026-09-08T16:30:00.000Z",
    });

    expect(mockFindByRequestId).toHaveBeenCalledTimes(2);
    expect(mockFindByRequestId).toHaveBeenNthCalledWith(1, "LD001-R01");
    expect(mockFindByRequestId).toHaveBeenNthCalledWith(2, "LD001-R01");
    expect(mockAppendWebhookPayload).toHaveBeenCalledWith(
      "LD001-R01",
      expect.objectContaining({ requestId: "LD001-R01", status: "WAIT_FOR_APPROVAL" })
    );
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "LD001-R01",
      expect.objectContaining({
        status: "WAIT_FOR_APPROVAL",
        submittedAt: new Date("2026-09-08T16:30:00.000Z"),
      })
    );
  });

  it("preserves the first submitted timestamp on duplicate review webhooks", async () => {
    const submittedAt = new Date("2026-09-08T16:30:00.000Z");
    mockFindByRequestId.mockResolvedValue(
      baseOnboardingRow({ status: "WAIT_FOR_APPROVAL", submitted_at: submittedAt })
    );

    const handler = new IndividualOnboardingWebhookHandler() as unknown as {
      handle(payload: { requestId: string; status: string }): Promise<void>;
    };
    await handler.handle({
      requestId: "LD001-R01",
      status: "WAIT_FOR_APPROVAL",
    });

    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "LD001-R01",
      expect.not.objectContaining({ submittedAt: expect.any(Date) })
    );
  });

  it("still missing performs three exact lookups and no mutation", async () => {
    mockFindByRequestId.mockResolvedValue(null);
    const handler = new IndividualOnboardingWebhookHandler();

    await expect(
      (handler as any).handle({ requestId: "LD001-R01", status: "PROCESSING" })
    ).resolves.not.toThrow();

    expect(mockFindByRequestId).toHaveBeenCalledTimes(3);
    expect(mockFindByRequestId).toHaveBeenNthCalledWith(1, "LD001-R01");
    expect(mockFindByRequestId).toHaveBeenNthCalledWith(2, "LD001-R01");
    expect(mockFindByRequestId).toHaveBeenNthCalledWith(3, "LD001-R01");
    expect(mockAppendWebhookPayload).not.toHaveBeenCalled();
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(mockUpdateInvestorOrganizationOnboarding).not.toHaveBeenCalled();
    expect(mockHandleWebhookUpdate).not.toHaveBeenCalled();
  });

  it("never attaches to another requestId row", async () => {
    mockFindByRequestId.mockImplementation(async (requestId: string) =>
      requestId === "LD001-R99" ? baseOnboardingRow({ request_id: "LD001-R99" }) : null
    );
    const handler = new IndividualOnboardingWebhookHandler();

    await expect(
      (handler as any).handle({ requestId: "LD001-R01", status: "PROCESSING" })
    ).resolves.not.toThrow();

    expect(mockFindByRequestId).toHaveBeenCalledTimes(3);
    expect(mockFindByRequestId).toHaveBeenNthCalledWith(1, "LD001-R01");
    expect(mockFindByRequestId).toHaveBeenNthCalledWith(2, "LD001-R01");
    expect(mockFindByRequestId).toHaveBeenNthCalledWith(3, "LD001-R01");
    expect(mockAppendWebhookPayload).not.toHaveBeenCalledWith(
      "LD001-R99",
      expect.anything()
    );
    expect(mockUpdateStatus).not.toHaveBeenCalledWith(
      "LD001-R99",
      expect.anything()
    );
  });

  it("E8: preserves the payload on a CANCELLED row and does not mutate the organization", async () => {
    mockFindByRequestId.mockResolvedValue(baseOnboardingRow({ status: "CANCELLED" }));
    const handler = new IndividualOnboardingWebhookHandler();

    await (handler as any).handle({ requestId: "LD001-R01", status: "APPROVED" });

    expect(mockAppendWebhookPayload).toHaveBeenCalledTimes(1);
    expect(mockAppendWebhookPayload).toHaveBeenCalledWith("LD001-R01", expect.objectContaining({ status: "APPROVED" }));
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(mockUpdateInvestorOrganizationOnboarding).not.toHaveBeenCalled();
    expect(mockHandleWebhookUpdate).not.toHaveBeenCalled();
  });

  it("F12: a liveness webhook cannot mutate a resolved CORPORATE onboarding row (and is not appended)", async () => {
    mockFindByRequestId.mockResolvedValue(
      baseOnboardingRow({ onboarding_type: "CORPORATE", organization_type: OrganizationType.COMPANY })
    );
    const handler = new IndividualOnboardingWebhookHandler();

    await (handler as any).handle({ requestId: "LD001-R01", status: "WAIT_FOR_APPROVAL" });

    expect(mockAppendWebhookPayload).not.toHaveBeenCalled();
    expect(mockUpdateStatus).not.toHaveBeenCalled();
    expect(mockUpdateInvestorOrganizationOnboarding).not.toHaveBeenCalled();
  });

  it("stores exactly one copy of an APPROVED payload (no synthetic duplicate append)", async () => {
    mockFindByRequestId.mockResolvedValue(baseOnboardingRow());
    const handler = new IndividualOnboardingWebhookHandler();

    const payload = { requestId: "LD001-R01", status: "APPROVED", referenceId: "REF001" };
    await (handler as any).handle(payload);

    // The handler appends the one real payload it received; handleWebhookUpdate
    // (mocked here) is the only other place APPROVED is processed, and per item C
    // it no longer appends a synthetic copy.
    expect(mockAppendWebhookPayload).toHaveBeenCalledTimes(1);
    expect(mockAppendWebhookPayload).toHaveBeenCalledWith("LD001-R01", payload);
    expect(mockHandleWebhookUpdate).toHaveBeenCalledTimes(1);
  });

  it("EXPIRED webhook updates matching request row to EXPIRED", async () => {
    mockFindByRequestId.mockResolvedValue(baseOnboardingRow({ request_id: "LD83612-R03", status: "IN_PROGRESS" }));
    const handler = new IndividualOnboardingWebhookHandler();

    await (handler as any).handle({ requestId: "LD83612-R03", status: "EXPIRED" });

    expect(mockAppendWebhookPayload).toHaveBeenCalledWith(
      "LD83612-R03",
      expect.objectContaining({ requestId: "LD83612-R03", status: "EXPIRED" })
    );
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "LD83612-R03",
      expect.objectContaining({ status: "EXPIRED" })
    );
  });

  it("webhook for R03 never mutates R04 row", async () => {
    mockFindByRequestId.mockImplementation(async (requestId: string) =>
      requestId === "LD83612-R03" ? baseOnboardingRow({ request_id: "LD83612-R03" }) : null
    );
    const handler = new IndividualOnboardingWebhookHandler();

    await (handler as any).handle({ requestId: "LD83612-R03", status: "PROCESSING" });

    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "LD83612-R03",
      expect.objectContaining({ status: "PROCESSING" })
    );
    expect(mockUpdateStatus).not.toHaveBeenCalledWith(
      "LD83612-R04",
      expect.anything()
    );
  });

  it("PROCESSING webhook for R04 updates only R04", async () => {
    mockFindByRequestId.mockImplementation(async (requestId: string) =>
      requestId === "LD83612-R04" ? baseOnboardingRow({ request_id: "LD83612-R04" }) : null
    );
    const handler = new IndividualOnboardingWebhookHandler();

    await (handler as any).handle({ requestId: "LD83612-R04", status: "PROCESSING" });

    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "LD83612-R04",
      expect.objectContaining({ status: "PROCESSING" })
    );
    expect(mockUpdateStatus).not.toHaveBeenCalledWith(
      "LD83612-R03",
      expect.anything()
    );
  });

  it("APPROVED party webhook persists status then queries onboarding details", async () => {
    mockFindByRequestId.mockResolvedValue(null);
    (findCtosPartySupplementByOnboardingJsonMatch as jest.Mock).mockResolvedValue({
      id: "sup-1",
      party_key: "user:550e8400-e29b-41d4-a716-446655440000",
      issuer_organization_id: "org-1",
      investor_organization_id: null,
      onboarding_json: { requestId: "LD-PREID-1", status: "IN_PROGRESS" },
    });
    const handler = new IndividualOnboardingWebhookHandler();

    await (handler as any).handle({ requestId: "LD-PREID-1", status: "APPROVED", referenceId: "org-1_user" });

    expect(prisma.ctosPartySupplement.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sup-1" } })
    );
    expect(mockEnrichApprovedCtosPartySupplement).toHaveBeenCalledWith(
      expect.objectContaining({
        portal: "issuer",
        organizationId: "org-1",
        partyKey: "user:550e8400-e29b-41d4-a716-446655440000",
        requestId: "LD-PREID-1",
      })
    );

    // First transition to APPROVED should create persistent notification/email via NotificationService.
    const expectedRecipients = ["owner-1", "admin-1", "member-1", "linked-user-1"];
    expect(mockSendTypedAndLogSystem).toHaveBeenCalledTimes(expectedRecipients.length);
    for (const recipientUserId of expectedRecipients) {
      expect(mockSendTypedAndLogSystem).toHaveBeenCalledWith(
        recipientUserId,
        NotificationTypeIds.KYC_VERIFICATION_COMPLETED,
        {
          partyId: "party-1",
          personName: "Jane Doe",
          portalType: "issuer",
        },
        `party-onboarding:issuer:org-1:party-1:approved:user:${recipientUserId}`
      );
    }
  });

  it("does NOT notify on repeated APPROVED when the previous pipeline was already APPROVED", async () => {
    mockFindByRequestId.mockResolvedValue(null);
    (findCtosPartySupplementByOnboardingJsonMatch as jest.Mock).mockResolvedValue({
      id: "sup-1",
      party_key: "user:550e8400-e29b-41d4-a716-446655440000",
      issuer_organization_id: "org-1",
      investor_organization_id: null,
      onboarding_json: {
        requestId: "LD-PREID-1",
        regtankPipelineStatus: "APPROVED",
        status: "IN_PROGRESS",
      },
    });

    const handler = new IndividualOnboardingWebhookHandler();
    await (handler as any).handle({ requestId: "LD-PREID-1", status: "APPROVED", referenceId: "org-1_user" });

    expect(mockEnrichApprovedCtosPartySupplement).toHaveBeenCalled();
    expect(mockSendTypedAndLogSystem).not.toHaveBeenCalled();
  });

  it("uses KYB terminology for CORPORATE party profiles", async () => {
    (prisma.organizationPartyProfile.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "party-2",
      name: "ACME Holdings",
      entity_type: "CORPORATE",
      user_id: null,
    });

    mockFindByRequestId.mockResolvedValue(null);
    (findCtosPartySupplementByOnboardingJsonMatch as jest.Mock).mockResolvedValue({
      id: "sup-1",
      party_key: "party-key-corp",
      issuer_organization_id: "org-1",
      investor_organization_id: null,
      onboarding_json: { requestId: "LD-PREID-1", status: "IN_PROGRESS" },
    });

    const handler = new IndividualOnboardingWebhookHandler();
    await (handler as any).handle({ requestId: "LD-PREID-1", status: "APPROVED", referenceId: "org-1_user" });

    const expectedRecipients = ["owner-1", "admin-1", "member-1"];
    expect(mockSendTypedAndLogSystem).toHaveBeenCalledTimes(expectedRecipients.length);
    for (const recipientUserId of expectedRecipients) {
      expect(mockSendTypedAndLogSystem).toHaveBeenCalledWith(
        recipientUserId,
        NotificationTypeIds.KYB_VERIFICATION_COMPLETED,
        {
          partyId: "party-2",
          companyName: "ACME Holdings",
          portalType: "issuer",
        },
        `party-onboarding:issuer:org-1:party-2:approved:user:${recipientUserId}`
      );
    }
  });

  it("keeps APPROVED persistence when the follow-up query/seed fails", async () => {
    mockFindByRequestId.mockResolvedValue(null);
    (findCtosPartySupplementByOnboardingJsonMatch as jest.Mock).mockResolvedValue({
      id: "sup-1",
      party_key: "user:550e8400-e29b-41d4-a716-446655440000",
      issuer_organization_id: "org-1",
      investor_organization_id: null,
      onboarding_json: { requestId: "LD-PREID-1" },
    });
    mockEnrichApprovedCtosPartySupplement.mockRejectedValueOnce(new Error("RegTank down"));
    const handler = new IndividualOnboardingWebhookHandler();

    await expect(
      (handler as any).handle({ requestId: "LD-PREID-1", status: "APPROVED" })
    ).resolves.toBeUndefined();
    expect(prisma.ctosPartySupplement.update).toHaveBeenCalled();
  });

  it("ignores a stale /liveness webhook after the Person request was replaced", async () => {
    mockFindByRequestId.mockResolvedValue(null);
    (findCtosPartySupplementByOnboardingJsonMatch as jest.Mock).mockResolvedValue({
      id: "sup-1",
      party_key: "user:550e8400-e29b-41d4-a716-446655440000",
      issuer_organization_id: "org-1",
      investor_organization_id: null,
      onboarding_json: { requestId: "LD-NEW", status: "IN_PROGRESS" },
    });
    const handler = new IndividualOnboardingWebhookHandler();

    await (handler as any).handle({
      requestId: "LD-OLD",
      status: "WAIT_FOR_APPROVAL",
      referenceId: "org-1_user",
    });

    expect(prisma.ctosPartySupplement.update).not.toHaveBeenCalled();
    expect(mockEnrichApprovedCtosPartySupplement).not.toHaveBeenCalled();
  });

  it("accepts the current /liveness webhook", async () => {
    mockFindByRequestId.mockResolvedValue(null);
    (findCtosPartySupplementByOnboardingJsonMatch as jest.Mock).mockResolvedValue({
      id: "sup-1",
      party_key: "user:550e8400-e29b-41d4-a716-446655440000",
      issuer_organization_id: "org-1",
      investor_organization_id: null,
      onboarding_json: { requestId: "LD-NEW", status: "IN_PROGRESS" },
    });
    const handler = new IndividualOnboardingWebhookHandler();

    await (handler as any).handle({
      requestId: "LD-NEW",
      status: "WAIT_FOR_APPROVAL",
      referenceId: "org-1_user",
    });

    expect(prisma.ctosPartySupplement.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sup-1" } })
    );
  });

  it("ignores a pre-restart /liveness webhook", async () => {
    mockFindByRequestId.mockResolvedValue(null);
    (findCtosPartySupplementByOnboardingJsonMatch as jest.Mock).mockResolvedValue({
      id: "sup-1",
      party_key: "user:550e8400-e29b-41d4-a716-446655440000",
      issuer_organization_id: "org-1",
      investor_organization_id: null,
      onboarding_json: { requestId: "LD101", status: "IN_PROGRESS" },
    });
    const handler = new IndividualOnboardingWebhookHandler();

    await (handler as any).handle({
      requestId: "LD100",
      status: "WAIT_FOR_APPROVAL",
      referenceId: "org-1_user",
    });

    expect(prisma.ctosPartySupplement.update).not.toHaveBeenCalled();
  });

  it("accepts the restarted request /liveness webhook", async () => {
    mockFindByRequestId.mockResolvedValue(null);
    (findCtosPartySupplementByOnboardingJsonMatch as jest.Mock).mockResolvedValue({
      id: "sup-1",
      party_key: "user:550e8400-e29b-41d4-a716-446655440000",
      issuer_organization_id: "org-1",
      investor_organization_id: null,
      onboarding_json: { requestId: "LD101", status: "IN_PROGRESS" },
    });
    const handler = new IndividualOnboardingWebhookHandler();

    await (handler as any).handle({
      requestId: "LD101",
      status: "WAIT_FOR_APPROVAL",
      referenceId: "org-1_user",
    });

    expect(prisma.ctosPartySupplement.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sup-1" } })
    );
  });
});
