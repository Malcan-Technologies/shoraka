import {
  PAYMASTER_NOT_VERIFIED_CODE,
  RELATED_PARTY_REQUIRED_CODE,
  VERIFIED_PAYMASTER_MUST_BE_SELECTED_CODE,
} from "@cashsouk/types";

jest.mock("../../lib/prisma", () => ({
  prisma: {
    paymaster: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    issuerPaymasterLink: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    paymasterMismatch: {
      create: jest.fn(),
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
  },
}));

import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/http/error-handler";
import {
  listIssuerPaymasters,
  lookupPaymasterByRegistration,
  resolvePaymasterFromCustomerDetails,
  verifyPaymaster,
} from "./service";

const issuerOrganizationId = "org-a";
const actorUserId = "A1B2C";

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
    mismatch_pending: false,
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
    mismatches: [],
    assignment_notices: [],
    contracts: [],
    notes: [],
  };
}

describe("Paymaster verification and SSM-first reuse", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.issuerPaymasterLink.upsert as jest.Mock).mockResolvedValue({});
    (prisma.paymasterMismatch.create as jest.Mock).mockResolvedValue({});
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      first_name: "Max",
      last_name: "Admin",
    });
  });

  it("creates a new Paymaster as UNVERIFIED", async () => {
    (prisma.paymaster.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.paymaster.create as jest.Mock).mockResolvedValue(
      paymasterRow({
        id: "pm_new",
        verification_status: "UNVERIFIED",
        verified_at: null,
        verified_by_user_id: null,
      })
    );

    const result = await resolvePaymasterFromCustomerDetails({
      issuerOrganizationId,
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
    expect(result.paymasterId).toBe("pm_new");
    expect(result.customerDetails.is_related_party).toBe(false);
  });

  it("rejects unverified selectedPaymasterId", async () => {
    (prisma.paymaster.findUnique as jest.Mock).mockResolvedValue(
      paymasterRow({ id: "pm_pending", verification_status: "UNVERIFIED" })
    );
    await expect(
      resolvePaymasterFromCustomerDetails({
        issuerOrganizationId,
        selectedPaymasterId: "pm_pending",
        customerDetails: {
          name: "Pending Co",
          entity_type: "Private Limited Company (Sdn Bhd)",
          ssm_number: "202134567890",
          country: "MY",
          is_related_party: false,
        },
      })
    ).rejects.toMatchObject({
      code: PAYMASTER_NOT_VERIFIED_CODE,
    } satisfies Partial<AppError>);
  });

  it("allows verified selectedPaymasterId without a prior issuer link", async () => {
    const selected = paymasterRow({ id: "pm_global" });
    (prisma.paymaster.findUnique as jest.Mock).mockResolvedValue(selected);

    const result = await resolvePaymasterFromCustomerDetails({
      issuerOrganizationId: "org-b",
      selectedPaymasterId: "pm_global",
      customerDetails: {
        name: selected.legal_name,
        entity_type: selected.entity_type,
        ssm_number: selected.registration_number,
        country: selected.registration_country,
        is_related_party: true,
      },
    });

    expect(result.paymasterId).toBe("pm_global");
    expect(result.customerDetails.name).toBe(selected.legal_name);
    expect(result.customerDetails.is_related_party).toBe(true);
    expect(prisma.issuerPaymasterLink.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          issuer_organization_id: "org-b",
          paymaster_id: "pm_global",
          is_related_party: true,
        }),
      })
    );
    expect(prisma.paymaster.create).not.toHaveBeenCalled();
  });

  it("rejects a verified SSM match unless the issuer explicitly selects it", async () => {
    (prisma.paymaster.findUnique as jest.Mock).mockResolvedValue(paymasterRow());
    await expect(
      resolvePaymasterFromCustomerDetails({
        issuerOrganizationId,
        customerDetails: {
          name: "ABC Trading Sdn Bhd",
          entity_type: "Private Limited Company (Sdn Bhd)",
          ssm_number: "202134567890",
          country: "MY",
          is_related_party: false,
        },
      })
    ).rejects.toMatchObject({
      code: VERIFIED_PAYMASTER_MUST_BE_SELECTED_CODE,
    } satisfies Partial<AppError>);
  });

  it("reuses an unverified Paymaster without creating a duplicate", async () => {
    const existing = paymasterRow({
      id: "pm_unverified",
      verification_status: "UNVERIFIED",
      verified_at: null,
      verified_by_user_id: null,
    });
    (prisma.paymaster.findUnique as jest.Mock).mockResolvedValue(existing);

    const result = await resolvePaymasterFromCustomerDetails({
      issuerOrganizationId,
      customerDetails: {
        name: "Different Name Sdn Bhd",
        entity_type: "Public Limited Company (Bhd)",
        ssm_number: "202134567890",
        country: "SG",
        is_related_party: false,
      },
    });

    expect(prisma.paymaster.create).not.toHaveBeenCalled();
    expect(result.paymasterId).toBe("pm_unverified");
    expect(result.customerDetails.name).toBe(existing.legal_name);
    expect(result.customerDetails.country).toBe(existing.registration_country);
    expect(result.mismatchCreated).toBe(true);
    expect(prisma.paymaster.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { mismatch_pending: true },
      })
    );
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

  it("preserves Admin-set large private company on customer_details rebuild", async () => {
    const existing = paymasterRow({ id: "pm_unverified", verification_status: "UNVERIFIED" });
    (prisma.paymaster.findUnique as jest.Mock).mockResolvedValue(existing);

    const result = await resolvePaymasterFromCustomerDetails({
      issuerOrganizationId,
      previousLargePrivateCompany: true,
      customerDetails: {
        name: existing.legal_name,
        entity_type: existing.entity_type,
        ssm_number: existing.registration_number,
        country: existing.registration_country,
        is_related_party: false,
      },
    });

    expect(result.customerDetails.is_large_private_company).toBe(true);
  });

  it("does not overwrite verified master identity from a conflicting payload", async () => {
    const selected = paymasterRow();
    (prisma.paymaster.findUnique as jest.Mock).mockResolvedValue(selected);

    const result = await resolvePaymasterFromCustomerDetails({
      issuerOrganizationId,
      selectedPaymasterId: selected.id,
      customerDetails: {
        name: "Wrong Name Sdn Bhd",
        entity_type: "Partnership",
        ssm_number: selected.registration_number,
        country: "SG",
        is_related_party: false,
      },
    });

    expect(result.customerDetails.name).toBe(selected.legal_name);
    expect(result.customerDetails.entity_type).toBe(selected.entity_type);
    expect(result.customerDetails.country).toBe(selected.registration_country);
    expect(result.mismatchCreated).toBe(true);
    expect(prisma.paymaster.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ legal_name: "Wrong Name Sdn Bhd" }),
      })
    );
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

  it("verifyPaymaster sets verified_at and verified_by without approving an application", async () => {
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

    const detail = await verifyPaymaster({ paymasterId: "pm_pending", actorUserId });
    expect(prisma.paymaster.update).toHaveBeenCalledWith({
      where: { id: "pm_pending" },
      data: {
        verification_status: "VERIFIED",
        verified_at: expect.any(Date),
        verified_by_user_id: actorUserId,
      },
    });
    expect(detail.verificationStatus).toBe("VERIFIED");
    expect(detail.verifiedByUserId).toBe(actorUserId);
    expect(detail.verifiedAt).toBeTruthy();
    expect(prisma.application.update).not.toHaveBeenCalled();
    expect(prisma.note.update).not.toHaveBeenCalled();
    expect(prisma.applicationRevision.update).not.toHaveBeenCalled();
  });
});
