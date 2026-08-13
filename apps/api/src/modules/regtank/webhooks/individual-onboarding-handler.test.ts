import { OrganizationType } from "@prisma/client";

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
const mockFindInvestorOrganizationById = jest.fn();
jest.mock("../../organization/repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({
    findInvestorOrganizationById: (...args: unknown[]) => mockFindInvestorOrganizationById(...args),
    findIssuerOrganizationById: jest.fn(),
    updateInvestorOrganizationOnboarding: (...args: unknown[]) => mockUpdateInvestorOrganizationOnboarding(...args),
    updateIssuerOrganizationOnboarding: jest.fn(),
  })),
}));

jest.mock("../../notification/service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendTyped: jest.fn(),
  })),
}));

let investorOrg: Record<string, unknown> = {
  onboarding_status: "PENDING",
  onboarding_approved: false,
  type: OrganizationType.PERSONAL,
  name: "Ada",
};
const auditCreates: Array<{ data: { event_type: string } }> = [];
let updateChain = Promise.resolve();

function matchesWhere(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  for (const [key, expected] of Object.entries(where)) {
    if (key === "id") continue;
    const actual = row[key];
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      const clause = expected as Record<string, unknown>;
      if (Array.isArray(clause.in) && !clause.in.includes(actual)) return false;
      if (Array.isArray(clause.notIn) && clause.notIn.includes(actual)) return false;
      if ("not" in clause && actual === clause.not) return false;
      continue;
    }
    if (actual !== expected) return false;
  }
  return true;
}

function serializedUpdateMany({
  where,
  data,
}: {
  where: Record<string, unknown>;
  data: Record<string, unknown>;
}) {
  const run = async () => {
    if (!matchesWhere(investorOrg, where)) return { count: 0 };
    investorOrg = { ...investorOrg, ...data };
    return { count: 1 };
  };
  const next = updateChain.then(run, run);
  updateChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

const txClient = {
  investorOrganization: { updateMany: serializedUpdateMany },
  onboardingAuditLog: {
    create: (args: { data: { event_type: string } }) => {
      auditCreates.push(args);
      return Promise.resolve({});
    },
  },
  user: {
    findUnique: jest.fn(() =>
      Promise.resolve({ first_name: "Ada", last_name: "Admin", email: "ada@example.com" })
    ),
  },
};

jest.mock("../../../lib/prisma", () => ({
  prisma: {
    ctosPartySupplement: { update: jest.fn() },
    user: txClient.user,
    onboardingAuditLog: txClient.onboardingAuditLog,
    investorOrganization: { updateMany: serializedUpdateMany },
    $transaction: async (fn: (tx: typeof txClient) => Promise<unknown>) => fn(txClient),
  },
}));

jest.mock("../../organization/ctos-party-supplement-webhook-lookup", () => ({
  findCtosPartySupplementByOnboardingJsonMatch: jest.fn().mockResolvedValue(null),
}));

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
    ...overrides,
  };
}

describe("IndividualOnboardingWebhookHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    investorOrg = {
      onboarding_status: "PENDING",
      onboarding_approved: false,
      type: OrganizationType.PERSONAL,
      name: "Ada",
    };
    auditCreates.length = 0;
    updateChain = Promise.resolve();
    mockFindInvestorOrganizationById.mockImplementation(async () => ({
      id: "org-1",
      type: OrganizationType.PERSONAL,
      onboarding_status: investorOrg.onboarding_status,
      onboarding_approved: investorOrg.onboarding_approved,
      name: "Ada",
    }));
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

    await (handler as any).handle({ requestId: "LD001-R01", status: "WAIT_FOR_APPROVAL" });

    expect(mockFindByRequestId).toHaveBeenCalledTimes(2);
    expect(mockFindByRequestId).toHaveBeenNthCalledWith(1, "LD001-R01");
    expect(mockFindByRequestId).toHaveBeenNthCalledWith(2, "LD001-R01");
    expect(mockAppendWebhookPayload).toHaveBeenCalledWith(
      "LD001-R01",
      expect.objectContaining({ requestId: "LD001-R01", status: "WAIT_FOR_APPROVAL" })
    );
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      "LD001-R01",
      expect.objectContaining({ status: "WAIT_FOR_APPROVAL" })
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

  it("duplicate LIVENESS_PASSED writes one ONBOARDING_STATUS_CHANGED", async () => {
    mockFindByRequestId.mockResolvedValue(baseOnboardingRow());
    const handler = new IndividualOnboardingWebhookHandler();
    const payload = {
      requestId: "LD001-R01",
      status: "LIVENESS_PASSED",
      type: "INDIVIDUAL",
    };

    await (handler as any).handle(payload);
    await (handler as any).handle(payload);

    const statusChanged = auditCreates.filter((row) => row.data.event_type === "ONBOARDING_STATUS_CHANGED");
    expect(investorOrg.onboarding_status).toBe("PENDING_APPROVAL");
    expect(statusChanged).toHaveLength(1);
  });

  it("liveness then WAIT_FOR_APPROVAL writes one ONBOARDING_STATUS_CHANGED", async () => {
    mockFindByRequestId.mockResolvedValue(baseOnboardingRow());
    const handler = new IndividualOnboardingWebhookHandler();

    await (handler as any).handle({
      requestId: "LD001-R01",
      status: "LIVENESS_PASSED",
      type: "INDIVIDUAL",
    });
    await (handler as any).handle({
      requestId: "LD001-R01",
      status: "WAIT_FOR_APPROVAL",
      type: "INDIVIDUAL",
    });

    const statusChanged = auditCreates.filter((row) => row.data.event_type === "ONBOARDING_STATUS_CHANGED");
    expect(investorOrg.onboarding_status).toBe("PENDING_APPROVAL");
    expect(statusChanged).toHaveLength(1);
  });

  it("concurrent identical LIVENESS_PASSED writes one ONBOARDING_STATUS_CHANGED", async () => {
    mockFindByRequestId.mockResolvedValue(baseOnboardingRow());
    const handler = new IndividualOnboardingWebhookHandler();
    const payload = {
      requestId: "LD001-R01",
      status: "LIVENESS_PASSED",
      type: "INDIVIDUAL",
    };

    await Promise.all([(handler as any).handle(payload), (handler as any).handle(payload)]);

    expect(investorOrg.onboarding_status).toBe("PENDING_APPROVAL");
    expect(auditCreates.filter((row) => row.data.event_type === "ONBOARDING_STATUS_CHANGED")).toHaveLength(1);
  });

  it("duplicate REJECTED writes one ONBOARDING_REJECTED", async () => {
    mockFindByRequestId.mockResolvedValue(baseOnboardingRow());
    const handler = new IndividualOnboardingWebhookHandler();
    const payload = {
      requestId: "LD001-R01",
      status: "REJECTED",
      type: "INDIVIDUAL",
    };

    await (handler as any).handle(payload);
    await (handler as any).handle(payload);

    expect(investorOrg.onboarding_status).toBe("REJECTED");
    expect(auditCreates.filter((row) => row.data.event_type === "ONBOARDING_REJECTED")).toHaveLength(1);
  });

  it("concurrent identical REJECTED writes one ONBOARDING_REJECTED", async () => {
    mockFindByRequestId.mockResolvedValue(baseOnboardingRow());
    const handler = new IndividualOnboardingWebhookHandler();
    const payload = {
      requestId: "LD001-R01",
      status: "REJECTED",
      type: "INDIVIDUAL",
    };

    await Promise.all([(handler as any).handle(payload), (handler as any).handle(payload)]);

    expect(investorOrg.onboarding_status).toBe("REJECTED");
    expect(auditCreates.filter((row) => row.data.event_type === "ONBOARDING_REJECTED")).toHaveLength(1);
  });
});
