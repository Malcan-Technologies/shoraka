import { InvoiceStatus } from "@prisma/client";

jest.mock("../../lib/prisma", () => ({
  prisma: {
    invoice: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock("../legal-documents/acceptance-service", () => ({
  legalDocumentAcceptanceService: { assertNoPendingReacceptance: jest.fn() },
}));

import { prisma } from "../../lib/prisma";
import { legalDocumentAcceptanceService } from "../legal-documents/acceptance-service";
import { noteService } from "./service";

describe("Admin note creation (Turn Into Note) authorization", () => {
  const actor = { userId: "admin-user-1", role: "ADMIN", portal: "ADMIN" };
  const invoiceId = "inv-1";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("admin non-member + valid issuer org + pending reacceptance does not block createFromInvoice", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
      id: invoiceId,
      status: InvoiceStatus.APPROVED,
      application: {
        id: "app-1",
        issuer_organization_id: "org-1",
        issuer_organization: {
          id: "org-1",
          owner_user_id: "owner-user-1",
          type: "COMPANY",
          name: "Issuer Co",
          registration_number: "123",
          country: "MY",
          corporate_entities: null,
          corporate_onboarding_data: {},
          corporate_required_documents: null,
          director_aml_status: null,
          director_kyc_status: null,
          business_aml_status: null,
          display_reference: "ISS-1",
          date_of_incorporation: null,
          date_of_commencement: null,
          country_of_incorporation: null,
          sc_company_type: null,
          company_category: null,
          profile_field_sources: {},
          regulatory_structure_established_at: null,
        },
        business_details: {},
        financing_type: {},
        product_version: 1,
      },
      contract: null,
    });

    // If the legal reacceptance pre-check were still wired for admin note creation,
    // this would throw and fail the request.
    (legalDocumentAcceptanceService.assertNoPendingReacceptance as jest.Mock).mockImplementation(() => {
      throw new Error("LEGAL_REACCEPTANCE_PRECHECK_SHOULD_NOT_RUN");
    });

    const spy = jest
      .spyOn(noteService as any, "createFromInvoiceSource")
      .mockResolvedValue({ id: "note-draft-1" });

    await expect(noteService.createFromInvoice(invoiceId, {}, actor)).resolves.toEqual({
      id: "note-draft-1",
    });
    expect(legalDocumentAcceptanceService.assertNoPendingReacceptance).not.toHaveBeenCalled();

    spy.mockRestore();
  });

  it("admin non-member + valid issuer org + no pending reacceptance also proceeds", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
      id: invoiceId,
      status: InvoiceStatus.APPROVED,
      application: {
        id: "app-1",
        issuer_organization_id: "org-1",
        issuer_organization: {
          id: "org-1",
          owner_user_id: "owner-user-1",
          type: "COMPANY",
          name: "Issuer Co",
          registration_number: "123",
          country: "MY",
          corporate_entities: null,
          corporate_onboarding_data: {},
          corporate_required_documents: null,
          director_aml_status: null,
          director_kyc_status: null,
          business_aml_status: null,
          display_reference: "ISS-1",
          date_of_incorporation: null,
          date_of_commencement: null,
          country_of_incorporation: null,
          sc_company_type: null,
          company_category: null,
          profile_field_sources: {},
          regulatory_structure_established_at: null,
        },
        business_details: {},
        financing_type: {},
        product_version: 1,
      },
      contract: null,
    });

    (legalDocumentAcceptanceService.assertNoPendingReacceptance as jest.Mock).mockResolvedValue(undefined);

    const spy = jest
      .spyOn(noteService as any, "createFromInvoiceSource")
      .mockResolvedValue({ id: "note-draft-2" });

    await expect(noteService.createFromInvoice(invoiceId, {}, actor)).resolves.toEqual({
      id: "note-draft-2",
    });
    expect(legalDocumentAcceptanceService.assertNoPendingReacceptance).not.toHaveBeenCalled();

    spy.mockRestore();
  });

  it("issuer org genuinely missing still fails", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
      id: invoiceId,
      status: InvoiceStatus.APPROVED,
      application: {
        id: "app-1",
        issuer_organization_id: "org-missing",
        issuer_organization: null,
        business_details: {},
        financing_type: {},
        product_version: 1,
      },
      contract: null,
    });

    // Simulate downstream issuer snapshot building failing when issuer organization is absent.
    const spy = jest
      .spyOn(noteService as any, "createFromInvoiceSource")
      .mockRejectedValue(new Error("ISSUER_ORGANIZATION_MISSING"));

    await expect(noteService.createFromInvoice(invoiceId, {}, actor)).rejects.toMatchObject({
      message: "ISSUER_ORGANIZATION_MISSING",
    });

    spy.mockRestore();
  });
});

