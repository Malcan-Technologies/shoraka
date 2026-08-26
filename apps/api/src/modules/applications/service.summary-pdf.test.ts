const mockFindById = jest.fn();
const mockRender = jest.fn(async () => Buffer.from("%PDF-1.4 summary"));
const mockLoadNames = jest.fn(async () => new Map([["u_admin", "Nora Admin"]]));

jest.mock("./repository", () => ({
  ApplicationRepository: jest.fn().mockImplementation(() => ({
    findById: (...args: unknown[]) => mockFindById(...args),
  })),
}));
jest.mock("../products/repository", () => ({
  ProductRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../organization/repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../contracts/repository", () => ({
  ContractRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../notification/service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../../lib/user-display-name", () => ({
  loadUserDisplayNameMap: (...args: unknown[]) => mockLoadNames(...args),
}));
jest.mock("./summary-pdf/render-application-summary-html-to-pdf", () => ({
  renderApplicationSummaryHtmlToPdfBuffer: (...args: unknown[]) => mockRender(...args),
}));

import { ApplicationService } from "./service";

describe("ApplicationService.getApplicationSummaryPdf", () => {
  const service = new ApplicationService();

  beforeEach(() => {
    jest.clearAllMocks();
    (service as unknown as { verifyApplicationAccess: jest.Mock }).verifyApplicationAccess =
      jest.fn().mockResolvedValue(undefined);
    (service as unknown as { getApplicationLogs: jest.Mock }).getApplicationLogs = jest
      .fn()
      .mockResolvedValue([
        {
          id: "log_1",
          event_type: "APPLICATION_SUBMITTED",
          remark: "Submitted",
          created_at: "2026-08-02T03:00:00.000Z",
        },
      ]);
    mockFindById.mockResolvedValue({
      id: "clappinternalid000000001",
      display_reference: "APP-ARF-2026-0001",
      status: "SUBMITTED",
      created_at: "2026-08-01T02:00:00.000Z",
      updated_at: "2026-08-10T04:00:00.000Z",
      submitted_at: "2026-08-02T03:00:00.000Z",
      financing_type: { product_code: "ARF" },
      financing_structure: { structure_type: "invoice_only" },
      issuer_organization: { name: "Issuer Sdn Bhd", registration_number: "202001234567" },
      application_review_remarks: [
        {
          scope: "section",
          scope_key: "company_details",
          action_type: "AMENDMENT_REQUESTED",
          remark: "Update the contact person.",
          author_user_id: "u_admin",
          created_at: "2026-08-08T08:00:00.000Z",
        },
      ],
      invoices: [],
    });
  });

  it("composes HTML and renders a PDF without calling Chromium in the test", async () => {
    const result = await service.getApplicationSummaryPdf("clappinternalid000000001", "user-1");

    expect(result.filename).toBe("application-summary-APP-ARF-2026-0001.pdf");
    expect(result.buffer.toString()).toContain("%PDF-1.4");
    expect(mockRender).toHaveBeenCalledTimes(1);
    const html = mockRender.mock.calls[0]?.[0] as string;
    expect(html).toContain("APPLICATION SUMMARY");
    expect(html).toContain("APP-ARF-2026-0001");
    expect(html).toContain("not an offer letter");
    expect(html).toContain("Update the contact person.");
    expect(html).toContain("Nora Admin");
    expect(html).not.toContain("clappinternalid000000001");
  });

  it("returns not found when the application is missing", async () => {
    mockFindById.mockResolvedValueOnce(null);
    await expect(
      service.getApplicationSummaryPdf("clappinternalid000000001", "user-1")
    ).rejects.toMatchObject({ statusCode: 404, code: "APPLICATION_NOT_FOUND" });
    expect(mockRender).not.toHaveBeenCalled();
  });
});
