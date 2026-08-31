import { legalDocumentTypeLabel } from "@cashsouk/types";
import { legalExternalAcceptanceAdminService } from "./external-acceptance-admin-service";
import {
  exportLegalExternalAcceptancesQuerySchema,
  listLegalExternalAcceptancesQuerySchema,
} from "./external-acceptance-admin-schemas";

jest.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    legalExternalAcceptance: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    issuerOrganization: { findMany: jest.fn(), findUnique: jest.fn() },
  },
}));

import { prisma } from "../../lib/prisma";

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "ext-1",
    legal_document_version_id: "ver-1",
    legal_document_id: "ld-1",
    document_type: "GUARANTOR_WARNING_STATEMENT",
    version_number: 1,
    document_hash: "abc",
    party_name: "Siti",
    party_email: "siti@example.com",
    party_ic_number: "900101015432",
    party_role: "guarantor",
    source_type: "SIGNING_RECIPIENT",
    source_id: "rec-1",
    status: "ACCEPTED",
    opened_at: new Date("2026-08-01T00:00:00Z"),
    opened_ip_address: "198.51.100.10",
    opened_user_agent: "OpenAgent/1.0",
    opened_device_info: "desktop",
    accepted_at: new Date("2026-08-01T01:00:00Z"),
    accepted_ip_address: "203.0.113.20",
    accepted_user_agent: "AcceptAgent/2.0",
    accepted_device_info: "desktop",
    acknowledgement_text: "I have read and understood this warning statement.",
    created_at: new Date("2026-08-01T00:00:00Z"),
    envelope_id: "env-1",
    application_id: "app-1",
    organization_id: "org-1",
    version: {
      file_name: "warning.pdf",
      file_hash: "abc",
      version: 1,
      status: "PUBLISHED",
      content_type: "application/pdf",
      file_size: 2048,
      legal_document: {
        id: "ld-1",
        type: "GUARANTOR_WARNING_STATEMENT",
        title: "Guarantor Warning Statement",
      },
    },
    ...overrides,
  };
}

describe("legal external acceptance Admin reader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists org/application/envelope linkage without turning legal evidence into Activity", async () => {
    const row = makeRow();
    (prisma.$transaction as jest.Mock).mockResolvedValue([[row], 1]);
    (prisma.issuerOrganization.findMany as jest.Mock).mockResolvedValue([
      { id: "org-1", name: "Acme Sdn Bhd" },
    ]);

    const result = await legalExternalAcceptanceAdminService.listAcceptances({
      page: 1,
      pageSize: 20,
      sortBy: "accepted_at",
      sortOrder: "desc",
    });

    expect(result.acceptances[0]).toMatchObject({
      id: "ext-1",
      envelopeId: "env-1",
      applicationId: "app-1",
      organizationId: "org-1",
      organizationName: "Acme Sdn Bhd",
      partyRole: "guarantor",
      partyIcMasked: "••••5432",
      legalDocumentVersionId: "ver-1",
      legalDocumentId: "ld-1",
    });
    expect(result.acceptances[0]).not.toHaveProperty("partyIcNumber");
  });

  it("returns detail evidence without unmasked IC", async () => {
    (prisma.legalExternalAcceptance.findUnique as jest.Mock).mockResolvedValue(makeRow());
    (prisma.issuerOrganization.findMany as jest.Mock).mockResolvedValue([
      { id: "org-1", name: "Acme Sdn Bhd" },
    ]);

    const acceptance = await legalExternalAcceptanceAdminService.getAcceptanceById("ext-1");

    expect(acceptance.partyIcMasked).toBe("••••5432");
    expect(acceptance).not.toHaveProperty("partyIcNumber");
    expect(acceptance.openedIpAddress).toBe("198.51.100.10");
    expect(acceptance.acceptedIpAddress).toBe("203.0.113.20");
    expect(acceptance.acknowledgementText).toContain("warning statement");
    expect(acceptance.documentHash).toBe("abc");
    expect(acceptance.openedDeviceInfo).toBe("desktop");
  });

  it("exports matching rows with the same filters and never includes unmasked IC", async () => {
    (prisma.legalExternalAcceptance.findMany as jest.Mock).mockResolvedValue([makeRow()]);
    (prisma.issuerOrganization.findMany as jest.Mock).mockResolvedValue([
      { id: "org-1", name: "Acme Sdn Bhd" },
    ]);

    const rows = await legalExternalAcceptanceAdminService.exportAcceptances({
      status: "ACCEPTED",
      documentType: "GUARANTOR_WARNING_STATEMENT",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-31",
      sortBy: "accepted_at",
      sortOrder: "desc",
      format: "csv",
    });

    expect(prisma.legalExternalAcceptance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "ACCEPTED",
          document_type: "GUARANTOR_WARNING_STATEMENT",
        }),
        take: 10_000,
      })
    );
    expect(rows[0]?.partyIcMasked).toBe("••••5432");
    expect(rows[0]).not.toHaveProperty("partyIcNumber");
    expect(JSON.stringify(rows)).not.toContain("900101015432");
    expect(rows[0]?.acceptedIpAddress).toBe("203.0.113.20");
  });
});

describe("legal external acceptance Admin query schema", () => {
  it("defaults to accepted_at desc pagination", () => {
    const parsed = listLegalExternalAcceptancesQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.pageSize).toBe(20);
    expect(parsed.sortBy).toBe("accepted_at");
    expect(parsed.sortOrder).toBe("desc");
  });

  it("accepts document type, status, and date filters", () => {
    const parsed = listLegalExternalAcceptancesQuerySchema.parse({
      documentType: "GUARANTOR_WARNING_STATEMENT",
      status: "OPENED",
      search: "siti",
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
    });
    expect(parsed.documentType).toBe("GUARANTOR_WARNING_STATEMENT");
    expect(parsed.status).toBe("OPENED");
    expect(parsed.search).toBe("siti");
  });

  it("rejects a portal filter that Legal Acceptances supports", () => {
    const parsed = listLegalExternalAcceptancesQuerySchema.parse({ audience: "ISSUER" });
    expect(parsed).not.toHaveProperty("audience");
  });
});

describe("legal external acceptance export schema", () => {
  it("reuses list filters and defaults to csv", () => {
    const parsed = exportLegalExternalAcceptancesQuerySchema.parse({
      status: "ACCEPTED",
      search: "env-1",
    });
    expect(parsed.format).toBe("csv");
    expect(parsed.status).toBe("ACCEPTED");
    expect(parsed.search).toBe("env-1");
    expect(parsed).not.toHaveProperty("page");
  });

  it("uses the same friendly type label as the Admin table", () => {
    expect(legalDocumentTypeLabel("GUARANTOR_WARNING_STATEMENT")).toBe(
      "Guarantor Warning Statement"
    );
  });
});
