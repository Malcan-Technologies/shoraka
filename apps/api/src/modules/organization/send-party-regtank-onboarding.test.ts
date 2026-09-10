import { OnboardingStatus, OrganizationMemberRole, OrganizationType } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";
import type { ApplicationPersonRow } from "@cashsouk/types";
import { mergeCtosPartySupplementDocument, planPersonEmailWrite } from "@cashsouk/types";

const mockCreateIndividualOnboarding = jest.fn();
const mockRenewIndividualOnboardingToken = jest.fn();
const mockSendOnboardingEmail = jest.fn();
const mockPartyFindFirst = jest.fn();
const mockSupplementFindFirst = jest.fn();
const mockSupplementCreate = jest.fn();
const mockSupplementUpdate = jest.fn();
const mockIssuerFindUnique = jest.fn();
const mockLockParty = jest.fn().mockResolvedValue(undefined);
const mockLockSupplement = jest.fn().mockResolvedValue(undefined);

const mockSendMutex: {
  locked: boolean;
  waiters: Array<() => void>;
  runExclusive<T>(fn: () => Promise<T>): Promise<T>;
} = {
  locked: false,
  waiters: [],
  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    await new Promise<void>((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
        return;
      }
      this.waiters.push(resolve);
    });
    try {
      return await fn();
    } finally {
      const next = this.waiters.shift();
      if (next) next();
      else this.locked = false;
    }
  },
};

function mockTxClient() {
  return {
    organizationPartyProfile: {
      findFirst: (...args: unknown[]) => mockPartyFindFirst(...args),
    },
    ctosPartySupplement: {
      findFirst: (...args: unknown[]) => mockSupplementFindFirst(...args),
      create: (...args: unknown[]) => mockSupplementCreate(...args),
      update: (...args: unknown[]) => mockSupplementUpdate(...args),
    },
    issuerOrganization: {
      findUnique: (...args: unknown[]) => mockIssuerFindUnique(...args),
    },
    investorOrganization: {
      findUnique: jest.fn(),
    },
  };
}

jest.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: async (fn: (tx: unknown) => unknown) =>
      mockSendMutex.runExclusive(() => fn(mockTxClient())),
    organizationPartyProfile: {
      findFirst: (...args: unknown[]) => mockPartyFindFirst(...args),
    },
    ctosPartySupplement: {
      findFirst: (...args: unknown[]) => mockSupplementFindFirst(...args),
      create: (...args: unknown[]) => mockSupplementCreate(...args),
      update: (...args: unknown[]) => mockSupplementUpdate(...args),
    },
    issuerOrganization: {
      findUnique: (...args: unknown[]) => mockIssuerFindUnique(...args),
    },
    investorOrganization: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("./repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({
    lockOrganizationPartyProfileForUpdate: (...args: unknown[]) => mockLockParty(...args),
    lockCtosPartySupplementForUpdate: (...args: unknown[]) => mockLockSupplement(...args),
  })),
}));

jest.mock("../auth/repository", () => ({
  AuthRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("@aws-sdk/client-cognito-identity-provider", () => ({
  CognitoIdentityProviderClient: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  AdminUpdateUserAttributesCommand: jest.fn(),
}));

jest.mock("../regtank/api-client", () => ({
  RegTankAPIClient: jest.fn().mockImplementation(() => ({
    createIndividualOnboarding: (...args: unknown[]) => mockCreateIndividualOnboarding(...args),
    renewIndividualOnboardingToken: (...args: unknown[]) => mockRenewIndividualOnboardingToken(...args),
  })),
}));

jest.mock("../../config/regtank", () => ({
  getRegTankIndividualOnboardingOrigin: () => "https://shoraka-onboarding.regtank.com",
}));

jest.mock("../../lib/email/ses", () => ({
  sendOnboardingEmail: (...args: unknown[]) => mockSendOnboardingEmail(...args),
}));

import { OrganizationService } from "./service";

const generatedKey = "user:550e8400-e29b-41d4-a716-446655440000";
const CURRENT_LINK =
  "https://shoraka-onboarding.regtank.com?requestId=LD-CURRENT&formId=1015495&token=OLDTOKEN&language=EN&step=BaseInfo&skipFormPage=false";
const FUTURE_EXPIRY = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const PAST_EXPIRY = new Date(Date.now() - 60 * 1000).toISOString();

function personRow(overrides: Partial<ApplicationPersonRow> = {}): ApplicationPersonRow {
  return {
    matchKey: generatedKey,
    name: "Ali",
    entityType: "INDIVIDUAL",
    roles: ["DIRECTOR"],
    sharePercentage: null,
    status: "",
    action: null,
    screening: null,
    onboarding: { status: "IN_PROGRESS", id: "LD-CURRENT" },
    requestId: "LD-CURRENT",
    requestIdType: null,
    icFrontUrl: null,
    icBackUrl: null,
    email: "ali@example.com",
    ...overrides,
  };
}

function completedOrg() {
  return {
    id: "org-1",
    owner_user_id: "user-1",
    type: OrganizationType.COMPANY,
    onboarding_status: OnboardingStatus.COMPLETED,
    members: [{ user_id: "user-1", role: OrganizationMemberRole.ORGANIZATION_ADMIN }],
  };
}

function partyMaster(overrides: Record<string, unknown> = {}) {
  return {
    id: "party-1",
    party_key: generatedKey,
    email: "ali@example.com",
    identity_number: null,
    name: "Ali",
    ...overrides,
  };
}

function inProgressSupplement(overrides: Record<string, unknown> = {}) {
  return {
    id: "sup-1",
    party_key: generatedKey,
    onboarding_json: {
      requestId: "LD-CURRENT",
      status: "IN_PROGRESS",
      verifyLink: CURRENT_LINK,
      email: "ali@example.com",
      referenceId: "org-1_user550e8400-e29b-41d4-a716-446655440000",
      screening: null,
      ...overrides,
    },
  };
}

describe("Person RegTank send resend and replacement", () => {
  let service: OrganizationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrganizationService();
    jest.spyOn(service, "getOrganization").mockResolvedValue(completedOrg() as never);
    jest.spyOn(service, "getCorporateEntities").mockResolvedValue({
      people: [personRow()],
      directorKycStatus: null,
      ctosPartySupplements: [],
      directors: [],
      shareholders: [],
      corporateShareholders: [],
    });
    mockCreateIndividualOnboarding.mockResolvedValue({
      requestId: "LD-NEW",
      verifyLink: "https://verify.example/new",
      expiredIn: 3600,
      timestamp: "2026-09-10T00:00:00.000Z",
    });
    mockRenewIndividualOnboardingToken.mockResolvedValue({
      requestId: "LD-CURRENT",
      token: "NEWTOKEN",
      expiredIn: 86400,
      timestamp: "2026-09-10T12:00:00.000Z",
    });
    mockSendOnboardingEmail.mockResolvedValue(undefined);
    mockIssuerFindUnique.mockResolvedValue({ director_kyc_status: null });
    mockPartyFindFirst.mockResolvedValue(partyMaster());
    mockSupplementFindFirst.mockResolvedValue(null);
    mockSupplementCreate.mockResolvedValue({ id: "sup-1" });
    mockSupplementUpdate.mockResolvedValue({ id: "sup-1" });
  });

  it("first send creates one RegTank request and stores requestId, verifyLink, and expiry", async () => {
    const result = await service.sendDirectorCtosPartyOnboarding("user-1", "org-1", "issuer", {
      partyKey: generatedKey,
    });
    expect(result.requestId).toBe("LD-NEW");
    expect(mockCreateIndividualOnboarding).toHaveBeenCalledTimes(1);
    expect(mockRenewIndividualOnboardingToken).not.toHaveBeenCalled();
    expect(mockSupplementCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          party_key: generatedKey,
          onboarding_json: expect.objectContaining({
            requestId: "LD-NEW",
            verifyLink: "https://verify.example/new",
            verifyLinkExpiresAt: "2026-09-10T01:00:00.000Z",
            status: "IN_PROGRESS",
          }),
        }),
      })
    );
    expect(mockSendOnboardingEmail).toHaveBeenCalledWith({
      to: "ali@example.com",
      verifyLink: "https://verify.example/new",
    });
  });

  it("same-email resend during IN_PROGRESS reuses the stored request and verifyLink", async () => {
    mockSupplementFindFirst.mockResolvedValue(
      inProgressSupplement({ verifyLinkExpiresAt: FUTURE_EXPIRY })
    );
    const result = await service.sendDirectorCtosPartyOnboarding("user-1", "org-1", "issuer", {
      partyKey: generatedKey,
    });
    expect(result.requestId).toBe("LD-CURRENT");
    expect(mockCreateIndividualOnboarding).not.toHaveBeenCalled();
    expect(mockRenewIndividualOnboardingToken).not.toHaveBeenCalled();
    expect(mockSendOnboardingEmail).toHaveBeenCalledWith({
      to: "ali@example.com",
      verifyLink: CURRENT_LINK,
    });
    expect(mockSupplementUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          onboarding_json: expect.objectContaining({
            requestId: "LD-CURRENT",
            verifyLink: CURRENT_LINK,
            status: "IN_PROGRESS",
          }),
        }),
      })
    );
  });

  it("resends when expiry is unknown and the stored verifyLink still exists", async () => {
    mockSupplementFindFirst.mockResolvedValue(inProgressSupplement());
    const result = await service.sendDirectorCtosPartyOnboarding("user-1", "org-1", "issuer", {
      partyKey: generatedKey,
    });
    expect(result.requestId).toBe("LD-CURRENT");
    expect(mockCreateIndividualOnboarding).not.toHaveBeenCalled();
    expect(mockRenewIndividualOnboardingToken).not.toHaveBeenCalled();
    expect(mockSendOnboardingEmail).toHaveBeenCalledWith({
      to: "ali@example.com",
      verifyLink: CURRENT_LINK,
    });
  });

  it("email change during IN_PROGRESS resets locally then explicit Send creates a replacement request", async () => {
    const afterSend = mergeCtosPartySupplementDocument(null, {
      onboarding: {
        email: "wrong@example.com",
        status: "IN_PROGRESS",
        requestId: "LD-OLD",
        verifyLink: "https://verify.example/old",
      },
    });
    const emailPlan = planPersonEmailWrite({
      currentMasterEmail: "wrong@example.com",
      incomingEmail: "new@example.com",
      supplementRoot: afterSend,
    });
    expect(emailPlan).toMatchObject({ action: "write", pipelineReset: true, screeningReset: true });
    const afterReset = mergeCtosPartySupplementDocument(afterSend, {
      onboarding: { email: "new@example.com" },
      pipelineReset: true,
      screeningReset: true,
    });
    mockPartyFindFirst.mockResolvedValue(partyMaster({ email: "new@example.com" }));
    mockSupplementFindFirst.mockResolvedValue({
      id: "sup-1",
      party_key: generatedKey,
      onboarding_json: afterReset,
    });

    const result = await service.sendDirectorCtosPartyOnboarding("user-1", "org-1", "issuer", {
      partyKey: generatedKey,
    });
    expect(result.requestId).toBe("LD-NEW");
    expect(mockCreateIndividualOnboarding).toHaveBeenCalledTimes(1);
    expect(mockRenewIndividualOnboardingToken).not.toHaveBeenCalled();
    expect(mockSupplementUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          onboarding_json: expect.objectContaining({
            requestId: "LD-NEW",
            verifyLink: "https://verify.example/new",
          }),
        }),
      })
    );
    expect(mockSupplementUpdate.mock.calls[0]?.[0].data.onboarding_json.requestId).not.toBe("LD-OLD");
    expect(afterReset.verifyLinkExpiresAt).toBeUndefined();
  });

  it("does not change party_key when creating a replacement request", async () => {
    mockPartyFindFirst.mockResolvedValue(partyMaster({ email: "new@example.com" }));
    mockSupplementFindFirst.mockResolvedValue({
      id: "sup-1",
      party_key: generatedKey,
      onboarding_json: { email: "new@example.com", requestId: "", status: "", screening: null },
    });
    await service.sendDirectorCtosPartyOnboarding("user-1", "org-1", "issuer", {
      partyKey: generatedKey,
    });
    expect(mockSupplementUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sup-1" },
      })
    );
    expect(mockPartyFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { issuer_organization_id: "org-1", party_key: generatedKey },
      })
    );
  });

  it("rejects WAIT_FOR_APPROVAL replacement through normal Send", async () => {
    jest.spyOn(service, "getCorporateEntities").mockResolvedValue({
      people: [personRow({ onboarding: { status: "WAIT_FOR_APPROVAL", id: "LD-CURRENT" } })],
      directorKycStatus: null,
      ctosPartySupplements: [],
      directors: [],
      shareholders: [],
      corporateShareholders: [],
    });
    mockSupplementFindFirst.mockResolvedValue(
      inProgressSupplement({ status: "WAIT_FOR_APPROVAL" })
    );
    await expect(
      service.sendDirectorCtosPartyOnboarding("user-1", "org-1", "issuer", {
        partyKey: generatedKey,
      })
    ).rejects.toMatchObject({ statusCode: 400, code: "NOT_ALLOWED" });
    expect(mockCreateIndividualOnboarding).not.toHaveBeenCalled();
  });

  it("rejects WAIT_FOR_APPROVAL Person Email edits", () => {
    expect(
      planPersonEmailWrite({
        currentMasterEmail: "ali@example.com",
        incomingEmail: "other@example.com",
        supplementRoot: { status: "WAIT_FOR_APPROVAL", requestId: "LD-CURRENT" },
      }).action
    ).toBe("reject");
  });

  it("renews an expired same-email link, keeps requestId, replaces token, and emails the new link", async () => {
    mockSupplementFindFirst.mockResolvedValue(
      inProgressSupplement({ verifyLinkExpiresAt: PAST_EXPIRY })
    );
    const result = await service.sendDirectorCtosPartyOnboarding("user-1", "org-1", "issuer", {
      partyKey: generatedKey,
    });
    expect(result.requestId).toBe("LD-CURRENT");
    expect(mockCreateIndividualOnboarding).not.toHaveBeenCalled();
    expect(mockRenewIndividualOnboardingToken).toHaveBeenCalledTimes(1);
    expect(mockRenewIndividualOnboardingToken).toHaveBeenCalledWith({
      requestId: "LD-CURRENT",
      email: "ali@example.com",
    });
    const updated = mockSupplementUpdate.mock.calls[0]?.[0].data.onboarding_json as {
      requestId: string;
      verifyLink: string;
      verifyLinkExpiresAt: string;
    };
    expect(updated.requestId).toBe("LD-CURRENT");
    const url = new URL(updated.verifyLink);
    expect(url.searchParams.get("requestId")).toBe("LD-CURRENT");
    expect(url.searchParams.get("token")).toBe("NEWTOKEN");
    expect(url.searchParams.get("formId")).toBe("1015495");
    expect(url.searchParams.get("language")).toBe("EN");
    expect(updated.verifyLinkExpiresAt).toBe("2026-09-11T12:00:00.000Z");
    expect(mockSendOnboardingEmail).toHaveBeenCalledWith({
      to: "ali@example.com",
      verifyLink: updated.verifyLink,
    });
  });

  it("renews when verifyLink is missing and reconstructs the URL from the current request", async () => {
    const json = { ...inProgressSupplement().onboarding_json };
    delete (json as { verifyLink?: string }).verifyLink;
    mockSupplementFindFirst.mockResolvedValue({
      id: "sup-1",
      party_key: generatedKey,
      onboarding_json: { ...json, requestId: "LD-CURRENT", status: "IN_PROGRESS" },
    });
    const result = await service.sendDirectorCtosPartyOnboarding("user-1", "org-1", "issuer", {
      partyKey: generatedKey,
    });
    expect(result.requestId).toBe("LD-CURRENT");
    expect(mockCreateIndividualOnboarding).not.toHaveBeenCalled();
    expect(mockRenewIndividualOnboardingToken).toHaveBeenCalledTimes(1);
    const updated = mockSupplementUpdate.mock.calls[0]?.[0].data.onboarding_json as {
      verifyLink: string;
      requestId: string;
    };
    const url = new URL(updated.verifyLink);
    expect(updated.requestId).toBe("LD-CURRENT");
    expect(url.origin).toBe("https://shoraka-onboarding.regtank.com");
    expect(url.searchParams.get("requestId")).toBe("LD-CURRENT");
    expect(url.searchParams.get("token")).toBe("NEWTOKEN");
    expect(url.searchParams.get("formId")).toBe("1015495");
    expect(url.searchParams.get("step")).toBe("BaseInfo");
    expect(url.searchParams.get("skipFormPage")).toBe("false");
    expect(mockSendOnboardingEmail).toHaveBeenCalledWith({
      to: "ali@example.com",
      verifyLink: updated.verifyLink,
    });
  });

  it("rejects LIVENESS_PASSED and later protected statuses through normal Send", async () => {
    for (const status of ["LIVENESS_PASSED", "PENDING_APPROVAL", "REJECTED", "COMPLETED"]) {
      jest.clearAllMocks();
      service = new OrganizationService();
      jest.spyOn(service, "getOrganization").mockResolvedValue(completedOrg() as never);
      jest.spyOn(service, "getCorporateEntities").mockResolvedValue({
        people: [personRow({ onboarding: { status, id: "LD-CURRENT" } })],
        directorKycStatus: null,
        ctosPartySupplements: [],
        directors: [],
        shareholders: [],
        corporateShareholders: [],
      });
      mockPartyFindFirst.mockResolvedValue(partyMaster());
      mockIssuerFindUnique.mockResolvedValue({ director_kyc_status: null });
      mockSupplementFindFirst.mockResolvedValue(inProgressSupplement({ status }));
      await expect(
        service.sendDirectorCtosPartyOnboarding("user-1", "org-1", "issuer", {
          partyKey: generatedKey,
        })
      ).rejects.toMatchObject({ statusCode: 400, code: "NOT_ALLOWED" });
      expect(mockCreateIndividualOnboarding).not.toHaveBeenCalled();
      expect(mockRenewIndividualOnboardingToken).not.toHaveBeenCalled();
    }
  });

  it("serializes concurrent same-email sends into one RegTank create", async () => {
    let stored: { id: string; party_key: string; onboarding_json: unknown } | null = null;
    mockSupplementFindFirst.mockImplementation(async () => stored);
    mockSupplementCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      stored = {
        id: "sup-1",
        party_key: generatedKey,
        onboarding_json: data.onboarding_json,
      };
      return stored;
    });
    mockSupplementUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      stored = {
        id: "sup-1",
        party_key: generatedKey,
        onboarding_json: data.onboarding_json,
      };
      return stored;
    });
    mockCreateIndividualOnboarding.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      return {
        requestId: "LD-1",
        verifyLink: "https://verify.example/1",
        expiredIn: 3600,
        timestamp: new Date().toISOString(),
      };
    });

    const [first, second] = await Promise.all([
      service.sendDirectorCtosPartyOnboarding("user-1", "org-1", "issuer", { partyKey: generatedKey }),
      service.sendDirectorCtosPartyOnboarding("user-1", "org-1", "issuer", { partyKey: generatedKey }),
    ]);
    expect(mockCreateIndividualOnboarding).toHaveBeenCalledTimes(1);
    expect(first.requestId).toBe("LD-1");
    expect(second.requestId).toBe("LD-1");
    expect(stored?.onboarding_json).toEqual(
      expect.objectContaining({
        requestId: "LD-1",
        verifyLink: "https://verify.example/1",
      })
    );
    const storedExpiry = Date.parse(
      String((stored?.onboarding_json as { verifyLinkExpiresAt?: string }).verifyLinkExpiresAt)
    );
    expect(storedExpiry).toBeGreaterThan(Date.now());
    expect(mockRenewIndividualOnboardingToken).not.toHaveBeenCalled();
  });

  it("serializes concurrent expired-link sends into one renew", async () => {
    let stored: { id: string; party_key: string; onboarding_json: Record<string, unknown> } | null = {
      id: "sup-1",
      party_key: generatedKey,
      onboarding_json: {
        requestId: "LD-CURRENT",
        status: "IN_PROGRESS",
        verifyLink: CURRENT_LINK,
        verifyLinkExpiresAt: PAST_EXPIRY,
        email: "ali@example.com",
        screening: null,
      },
    };
    mockSupplementFindFirst.mockImplementation(async () => stored);
    mockSupplementUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      stored = {
        id: "sup-1",
        party_key: generatedKey,
        onboarding_json: data.onboarding_json as Record<string, unknown>,
      };
      return stored;
    });
    mockRenewIndividualOnboardingToken.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      return {
        requestId: "LD-CURRENT",
        token: "NEWTOKEN",
        expiredIn: 86400,
        timestamp: new Date().toISOString(),
      };
    });

    const [first, second] = await Promise.all([
      service.sendDirectorCtosPartyOnboarding("user-1", "org-1", "issuer", { partyKey: generatedKey }),
      service.sendDirectorCtosPartyOnboarding("user-1", "org-1", "issuer", { partyKey: generatedKey }),
    ]);
    expect(mockRenewIndividualOnboardingToken).toHaveBeenCalledTimes(1);
    expect(mockCreateIndividualOnboarding).not.toHaveBeenCalled();
    expect(first.requestId).toBe("LD-CURRENT");
    expect(second.requestId).toBe("LD-CURRENT");
    expect(stored?.onboarding_json.requestId).toBe("LD-CURRENT");
    expect(new URL(String(stored?.onboarding_json.verifyLink)).searchParams.get("token")).toBe("NEWTOKEN");
  });

  it("locks the Person row before creating or renewing a RegTank request", () => {
    const source = readFileSync(join(__dirname, "service.ts"), "utf8");
    const sendStart = source.indexOf("async sendDirectorCtosPartyOnboarding");
    const sendEnd = source.indexOf("async getCorporateEntitiesPrivileged");
    const sendFn = source.slice(sendStart, sendEnd);
    expect(sendFn).toContain("lockOrganizationPartyProfileForUpdate");
    expect(sendFn).toContain("lockCtosPartySupplementForUpdate");
    expect(sendFn).not.toContain("restartOnboarding");
    expect(sendFn.indexOf("lockOrganizationPartyProfileForUpdate")).toBeLessThan(
      sendFn.indexOf("createIndividualOnboarding")
    );
    expect(sendFn.indexOf("lockOrganizationPartyProfileForUpdate")).toBeLessThan(
      sendFn.indexOf("renewIndividualOnboardingToken")
    );
    expect(sendFn.indexOf("$transaction")).toBeLessThan(sendFn.indexOf("createIndividualOnboarding"));
    expect(sendFn.indexOf("$transaction")).toBeLessThan(sendFn.indexOf("renewIndividualOnboardingToken"));
  });
});
