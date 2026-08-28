import { legalExternalAcceptanceAdminService } from "./external-acceptance-admin-service";

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

describe("legal external acceptance Admin reader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists org/application/envelope linkage without turning legal evidence into Activity", async () => {
    const row = {
      id: "ext-1",
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
      accepted_at: new Date("2026-08-01T01:00:00Z"),
      created_at: new Date("2026-08-01T00:00:00Z"),
      envelope_id: "env-1",
      application_id: "app-1",
      organization_id: "org-1",
      version: {
        file_name: "warning.pdf",
        file_hash: "abc",
        version: 1,
        legal_document: {
          id: "ld-1",
          type: "GUARANTOR_WARNING_STATEMENT",
          title: "Guarantor Warning Statement",
        },
      },
    };
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
    });
    expect(result.acceptances[0]).not.toHaveProperty("partyIcNumber");
  });
});
