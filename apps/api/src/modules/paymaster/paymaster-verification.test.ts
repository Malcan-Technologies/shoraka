import {
  PAYMASTER_EXISTING_IDENTITY_IMMUTABLE_MESSAGE,
  PAYMASTER_IDENTITY_IMMUTABLE_CODE,
  PAYMASTER_IDENTITY_IMMUTABLE_MESSAGE,
  PAYMASTER_NOT_VERIFIED_CODE,
  RELATED_PARTY_REQUIRED_CODE,
  VERIFIED_PAYMASTER_MUST_BE_SELECTED_CODE,
} from "@cashsouk/types";

jest.mock("../../lib/prisma", () => ({
  prisma: {
    paymaster: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    issuerPaymasterLink: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    contract: {
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    note: {
      update: jest.fn(),
    },
    application: {
      update: jest.fn(),
    },
    applicationRevision: {
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock("./identity-audit", () => {
  const actual = jest.requireActual("./identity-audit");
  return {
    ...actual,
    writePaymasterIdentityApplicationLog: jest.fn(async () => undefined),
  };
});

import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/http/error-handler";
import { ActivityPortal, ApplicationLogEventType } from "../applications/logs/types";
import { writePaymasterIdentityApplicationLog } from "./identity-audit";
import {
  listIssuerPaymasters,
  lookupPaymasterByRegistration,
  resolvePaymasterFromCustomerDetails,
  verifyPaymaster,
} from "./service";

const issuerOrganizationId = "org-a";
const actorUserId = "A1B2C";
const applicationId = "app-1";
const writeLogMock = writePaymasterIdentityApplicationLog as jest.MockedFunction<
  typeof writePaymasterIdentityApplicationLog
>;

function paymasterRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "pm_verified",
    legal_name: "ABC Trading Sdn Bhd",
    registration_number: "202134567890",
    registration_country: "MY",
    entity_type: "Private Limited Company (Sdn Bhd)",
    verification_status: "VERIFIED",
    verified_at: new Date("2026-06-01T00:00:00.000Z"),
    verified_by_user_id: actorUserId,
    source: "ISSUER_APPLICATION",
    created_at: new Date("2026-01-01T00:00:00.000Z"),
    updated_at: new Date("2026-01-02T00:00:00.000Z"),
    ...overrides,
  };
}

function detailIncludes(row: ReturnType<typeof paymasterRow>) {
  return {
    ...row,
    issuer_links: [],
    assignment_notices: [],
    contracts: [],
    notes: [],
  };
}

function matchingDetails(row: ReturnType<typeof paymasterRow>, extra: Record<string, unknown> = {}) {
  return {
    name: row.legal_name,
    entity_type: row.entity_type,
    ssm_number: row.registration_number,
    country: row.registration_country,
    is_related_party: false,
    ...extra,
  };
}

describe("Paymaster verification and SSM-first reuse", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma)
    );
    (prisma.issuerPaymasterLink.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.issuerPaymasterLink.create as jest.Mock).mockResolvedValue({ id: "link-new" });
    (prisma.issuerPaymasterLink.update as jest.Mock).mockResolvedValue({ id: "link-existing" });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      first_name: "Max",
      last_name: "Admin",
    });
    (prisma.contract.findFirst as jest.Mock).mockResolvedValue({
      originating_application_id: applicationId,
      applications: [{ id: applicationId }],
    });
  });

  it("creates a new Paymaster as UNVERIFIED and writes PAYMASTER_CREATED once", async () => {
    (prisma.paymaster.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.paymaster.create as jest.Mock).mockResolvedValue(
      paymasterRow({
        id: "pm_new",
        verification_status: "UNVERIFIED",
        verified_at: null,
        verified_by_user_id: null,
        registration_number: "202201234567",
        legal_name: "New Co Sdn Bhd",
      })
    );

    const result = await resolvePaymasterFromCustomerDetails({
      issuerOrganizationId,
      actorUserId,
      applicationId,
      contractId: "ctr-1",
      customerDetails: {
        name: "New Co Sdn Bhd",
        entity_type: "Private Limited Company (Sdn Bhd)",
        ssm_number: "202201234567",
        country: "MY",
        is_related_party: false,
      },
    });

    expect(prisma.paymaster.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          verification_status: "UNVERIFIED",
          registration_number: "202201234567",
        }),
      })
    );
    expect(result.paymasterCreated).toBe(true);
    expect(result.issuerLinkCreated).toBe(false);
    expect(prisma.issuerPaymasterLink.create).toHaveBeenCalled();
    expect(writeLogMock).toHaveBeenCalledTimes(1);
    expect(writeLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: ApplicationLogEventType.PAYMASTER_CREATED,
        actorUserId,
        applicationId,
        portal: ActivityPortal.ISSUER,
        paymasterId: "pm_new",
        metadata: expect.objectContaining({
          verification_status: "UNVERIFIED",
          registrationNumber: "202201234567",
        }),
      })
    );
  });

  it("rejects unverified selectedPaymasterId", async () => {
    (prisma.paymaster.findUnique as jest.Mock).mockResolvedValue(
      paymasterRow({ id: "pm_pending", verification_status: "UNVERIFIED" })
    );
    await expect(
      resolvePaymasterFromCustomerDetails({
        issuerOrganizationId,
        selectedPaymasterId: "pm_pending",
        customerDetails: matchingDetails(
          paymasterRow({ id: "pm_pending", verification_status: "UNVERIFIED" })
        ),
      })
    ).rejects.toMatchObject({
      code: PAYMASTER_NOT_VERIFIED_CODE,
    } satisfies Partial<AppError>);
  });

  it("allows verified selectedPaymasterId without a prior issuer link and emits PAYMASTER_LINKED_TO_ISSUER once", async () => {
    const selected = paymasterRow({ id: "pm_global" });
    (prisma.paymaster.findUnique as jest.Mock).mockResolvedValue(selected);

    const result = await resolvePaymasterFromCustomerDetails({
      issuerOrganizationId: "org-b",
      selectedPaymasterId: "pm_global",
      actorUserId,
      applicationId,
      contractId: "ctr-2",
      customerDetails: matchingDetails(selected, { is_related_party: true }),
    });

    expect(result.paymasterId).toBe("pm_global");
    expect(result.paymasterCreated).toBe(false);
    expect(result.issuerLinkCreated).toBe(true);
    expect(result.customerDetails.is_related_party).toBe(true);
    expect(prisma.issuerPaymasterLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          issuer_organization_id: "org-b",
          paymaster_id: "pm_global",
          is_related_party: true,
        }),
      })
    );
    expect(prisma.paymaster.create).not.toHaveBeenCalled();
    expect(writeLogMock).toHaveBeenCalledTimes(1);
    expect(writeLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: ApplicationLogEventType.PAYMASTER_LINKED_TO_ISSUER,
        paymasterId: "pm_global",
      })
    );
  });

  it("does not emit PAYMASTER_LINKED_TO_ISSUER on same-issuer reuse", async () => {
    const selected = paymasterRow();
    (prisma.paymaster.findUnique as jest.Mock).mockResolvedValue(selected);
    (prisma.issuerPaymasterLink.findUnique as jest.Mock).mockResolvedValue({ id: "link-existing" });

    const result = await resolvePaymasterFromCustomerDetails({
      issuerOrganizationId,
      selectedPaymasterId: selected.id,
      actorUserId,
      applicationId,
      customerDetails: matchingDetails(selected),
    });

    expect(result.issuerLinkCreated).toBe(false);
    expect(prisma.issuerPaymasterLink.update).toHaveBeenCalled();
    expect(prisma.issuerPaymasterLink.create).not.toHaveBeenCalled();
    expect(writeLogMock).not.toHaveBeenCalled();
  });

  it("does not emit a second link event on repeated cross-issuer Save", async () => {
    const selected = paymasterRow({ id: "pm_global" });
    (prisma.paymaster.findUnique as jest.Mock).mockResolvedValue(selected);
    (prisma.issuerPaymasterLink.findUnique as jest.Mock).mockResolvedValue({ id: "link-b" });

    await resolvePaymasterFromCustomerDetails({
      issuerOrganizationId: "org-b",
      selectedPaymasterId: "pm_global",
      actorUserId,
      applicationId,
      customerDetails: matchingDetails(selected),
    });
    await resolvePaymasterFromCustomerDetails({
      issuerOrganizationId: "org-b",
      selectedPaymasterId: "pm_global",
      actorUserId,
      applicationId,
      customerDetails: matchingDetails(selected),
    });

    expect(writeLogMock).not.toHaveBeenCalled();
    expect(prisma.issuerPaymasterLink.create).not.toHaveBeenCalled();
  });

  it("rejects a verified SSM match unless the issuer explicitly selects it", async () => {
    (prisma.paymaster.findUnique as jest.Mock).mockResolvedValue(paymasterRow());
    await expect(
      resolvePaymasterFromCustomerDetails({
        issuerOrganizationId,
        customerDetails: matchingDetails(paymasterRow()),
      })
    ).rejects.toMatchObject({
      code: VERIFIED_PAYMASTER_MUST_BE_SELECTED_CODE,
    } satisfies Partial<AppError>);
  });

  it("reuses an unverified Paymaster without creating a duplicate or mismatch", async () => {
    const existing = paymasterRow({
      id: "pm_unverified",
      verification_status: "UNVERIFIED",
      verified_at: null,
      verified_by_user_id: null,
    });
    (prisma.paymaster.findUnique as jest.Mock).mockResolvedValue(existing);
    (prisma.issuerPaymasterLink.findUnique as jest.Mock).mockResolvedValue({ id: "link-existing" });

    const result = await resolvePaymasterFromCustomerDetails({
      issuerOrganizationId,
      actorUserId,
      applicationId,
      customerDetails: matchingDetails(existing),
    });

    expect(prisma.paymaster.create).not.toHaveBeenCalled();
    expect(result.paymasterId).toBe("pm_unverified");
    expect(result.customerDetails.name).toBe(existing.legal_name);
    expect(result.issuerLinkCreated).toBe(false);
    expect(writeLogMock).not.toHaveBeenCalled();
    expect(prisma.paymaster.update).not.toHaveBeenCalled();
  });

  it("rejects conflicting identity on an existing UNVERIFIED Paymaster without mutating the master", async () => {
    const existing = paymasterRow({
      id: "pm_unverified",
      verification_status: "UNVERIFIED",
      verified_at: null,
      verified_by_user_id: null,
    });
    (prisma.paymaster.findUnique as jest.Mock).mockResolvedValue(existing);

    await expect(
      resolvePaymasterFromCustomerDetails({
        issuerOrganizationId,
        customerDetails: {
          name: "Different Name Sdn Bhd",
          entity_type: "Public Limited Company (Bhd)",
          ssm_number: "202134567890",
          country: "SG",
          is_related_party: false,
        },
      })
    ).rejects.toMatchObject({
      code: PAYMASTER_IDENTITY_IMMUTABLE_CODE,
      message: PAYMASTER_EXISTING_IDENTITY_IMMUTABLE_MESSAGE,
    } satisfies Partial<AppError>);
    expect(prisma.paymaster.create).not.toHaveBeenCalled();
    expect(prisma.paymaster.update).not.toHaveBeenCalled();
    expect(writeLogMock).not.toHaveBeenCalled();
  });

  it("rejects conflicting VERIFIED identity without mutating the master", async () => {
    const selected = paymasterRow();
    (prisma.paymaster.findUnique as jest.Mock).mockResolvedValue(selected);

    await expect(
      resolvePaymasterFromCustomerDetails({
        issuerOrganizationId,
        selectedPaymasterId: selected.id,
        customerDetails: {
          name: "Wrong Name Sdn Bhd",
          entity_type: "Partnership",
          ssm_number: selected.registration_number,
          country: "SG",
          is_related_party: false,
        },
      })
    ).rejects.toMatchObject({
      code: PAYMASTER_IDENTITY_IMMUTABLE_CODE,
      message: PAYMASTER_IDENTITY_IMMUTABLE_MESSAGE,
    } satisfies Partial<AppError>);
    expect(prisma.paymaster.update).not.toHaveBeenCalled();
    expect(writeLogMock).not.toHaveBeenCalled();
  });

  it("requires an explicit related-party answer", async () => {
    await expect(
      resolvePaymasterFromCustomerDetails({
        issuerOrganizationId,
        customerDetails: {
          name: "ABC Trading Sdn Bhd",
          entity_type: "Private Limited Company (Sdn Bhd)",
          ssm_number: "202134567890",
          country: "MY",
        },
      })
    ).rejects.toMatchObject({
      code: RELATED_PARTY_REQUIRED_CODE,
    } satisfies Partial<AppError>);
  });

  it("keeps related-party issuer-specific on a new link", async () => {
    const selected = paymasterRow({ id: "pm_global" });
    (prisma.paymaster.findUnique as jest.Mock).mockResolvedValue(selected);
    await resolvePaymasterFromCustomerDetails({
      issuerOrganizationId: "org-b",
      selectedPaymasterId: "pm_global",
      customerDetails: matchingDetails(selected, { is_related_party: true }),
    });
    expect(prisma.issuerPaymasterLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ is_related_party: true }),
      })
    );
  });

  it("preserves Admin-set large private company on customer_details rebuild", async () => {
    const existing = paymasterRow({ id: "pm_unverified", verification_status: "UNVERIFIED" });
    (prisma.paymaster.findUnique as jest.Mock).mockResolvedValue(existing);
    (prisma.issuerPaymasterLink.findUnique as jest.Mock).mockResolvedValue({ id: "link-existing" });

    const result = await resolvePaymasterFromCustomerDetails({
      issuerOrganizationId,
      previousLargePrivateCompany: true,
      customerDetails: matchingDetails(existing),
    });

    expect(result.customerDetails.is_large_private_company).toBe(true);
  });

  it("lookup returns master identity only", async () => {
    (prisma.paymaster.findUnique as jest.Mock).mockResolvedValue(paymasterRow());
    const result = await lookupPaymasterByRegistration("202134567890");
    expect(result.status).toBe("FOUND_VERIFIED");
    expect(result.paymaster).toEqual({
      id: "pm_verified",
      legalName: "ABC Trading Sdn Bhd",
      registrationNumber: "202134567890",
      registrationCountry: "MY",
      entityType: "Private Limited Company (Sdn Bhd)",
      verificationStatus: "VERIFIED",
    });
    expect(JSON.stringify(result)).not.toMatch(/issuer/i);
  });

  it("lookup reports unverified and not found without creating rows", async () => {
    (prisma.paymaster.findUnique as jest.Mock)
      .mockResolvedValueOnce(paymasterRow({ verification_status: "UNVERIFIED" }))
      .mockResolvedValueOnce(null);
    await expect(lookupPaymasterByRegistration("202134567890")).resolves.toMatchObject({
      status: "FOUND_UNVERIFIED",
    });
    await expect(lookupPaymasterByRegistration("202201234567")).resolves.toEqual({
      status: "NOT_FOUND",
      paymaster: null,
    });
    expect(prisma.paymaster.create).not.toHaveBeenCalled();
  });

  it("lists only verified issuer-linked Paymasters", async () => {
    (prisma.issuerPaymasterLink.findMany as jest.Mock).mockResolvedValue([
      {
        is_related_party: false,
        last_used_at: new Date("2026-07-01T00:00:00.000Z"),
        paymaster: paymasterRow({ id: "pm_linked" }),
      },
    ]);
    const rows = await listIssuerPaymasters(issuerOrganizationId);
    expect(prisma.issuerPaymasterLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          issuer_organization_id: issuerOrganizationId,
          paymaster: { verification_status: "VERIFIED" },
        },
      })
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("pm_linked");
  });

  it("verifyPaymaster sets verified_at and writes PAYMASTER_VERIFIED once without approving an application", async () => {
    const unverified = paymasterRow({
      id: "pm_pending",
      verification_status: "UNVERIFIED",
      verified_at: null,
      verified_by_user_id: null,
    });
    const verified = {
      ...unverified,
      verification_status: "VERIFIED",
      verified_at: new Date("2026-09-01T00:00:00.000Z"),
      verified_by_user_id: actorUserId,
    };
    (prisma.paymaster.findUnique as jest.Mock)
      .mockResolvedValueOnce(unverified)
      .mockResolvedValueOnce(detailIncludes(verified));
    (prisma.paymaster.update as jest.Mock).mockResolvedValue(verified);

    const detail = await verifyPaymaster({
      paymasterId: "pm_pending",
      actorUserId,
      applicationId,
    });
    expect(prisma.paymaster.update).toHaveBeenCalledWith({
      where: { id: "pm_pending" },
      data: {
        verification_status: "VERIFIED",
        verified_at: expect.any(Date),
        verified_by_user_id: actorUserId,
      },
    });
    expect(detail.verificationStatus).toBe("VERIFIED");
    expect(writeLogMock).toHaveBeenCalledTimes(1);
    expect(writeLogMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        eventType: ApplicationLogEventType.PAYMASTER_VERIFIED,
        portal: ActivityPortal.ADMIN,
        metadata: expect.objectContaining({
          previous_status: "UNVERIFIED",
          new_status: "VERIFIED",
        }),
      })
    );
    expect(prisma.application.update).not.toHaveBeenCalled();
    expect(prisma.note.update).not.toHaveBeenCalled();
    expect(prisma.applicationRevision.update).not.toHaveBeenCalled();
  });

  it("does not emit PAYMASTER_VERIFIED on an idempotent second verify", async () => {
    const verified = paymasterRow();
    (prisma.paymaster.findUnique as jest.Mock)
      .mockResolvedValueOnce(verified)
      .mockResolvedValueOnce(detailIncludes(verified));

    await verifyPaymaster({ paymasterId: verified.id, actorUserId, applicationId });
    expect(prisma.paymaster.update).not.toHaveBeenCalled();
    expect(writeLogMock).not.toHaveBeenCalled();
  });
});

describe("Paymaster identity writers stay notification-free and separate from approval", () => {
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");

  it("does not send Paymaster notifications from create, link, or verify", () => {
    const src = [
      readFileSync(join(__dirname, "service.ts"), "utf8"),
      readFileSync(join(__dirname, "identity-audit.ts"), "utf8"),
      readFileSync(join(__dirname, "controller.ts"), "utf8"),
      readFileSync(join(__dirname, "activity.ts"), "utf8"),
    ].join("\n");
    expect(src).not.toMatch(/sendTyped|NotificationService|createInternal/);
  });

  it("does not verify a Paymaster when an application or section is approved", () => {
    const adminSrc = readFileSync(join(__dirname, "../admin/service.ts"), "utf8");
    expect(adminSrc).not.toMatch(/verifyPaymaster/);
    expect(adminSrc).not.toMatch(/verification_status:\s*"VERIFIED"/);
  });
});
