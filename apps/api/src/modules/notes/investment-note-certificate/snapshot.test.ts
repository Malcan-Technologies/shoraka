import { NoteFundingStatus, NoteInvestmentStatus } from "@prisma/client";
import { CertificateGenerationError } from "./types";

const mockPrisma: any = {
  note: { findUnique: jest.fn() },
  noteInvestment: { findMany: jest.fn() },
  issuerOrganization: { findUnique: jest.fn() },
  investorOrganization: { findMany: jest.fn() },
  issuerOrganizationMarcAssessment: { findFirst: jest.fn(), findMany: jest.fn() },
};

jest.mock("../../../lib/prisma", () => ({ prisma: mockPrisma }));

import { buildInvestmentNoteCertificateSnapshot } from "./snapshot";

describe("buildInvestmentNoteCertificateSnapshot", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("refuses incomplete tenure/maturity/disbursement instead of fabricating dates", async () => {
    mockPrisma.note.findUnique.mockResolvedValue({
      id: "note-1",
      note_reference: "NOTE-1",
      funding_status: NoteFundingStatus.FUNDED,
      issuer_organization_id: "iss-1",
      issuer_snapshot: { name: "Helios", registration_number: "123", industry: "Mfg" },
      paymaster_snapshot: { name: "Paymaster" },
      purpose_snapshot: { financing_for: "WC" },
      invoice_snapshot: { details: { value: 100_000, number: "INV-1" }, offer_details: { risk_rating: "SME-4" } },
      requested_amount: 100_000,
      target_amount: 100_000,
      funded_amount: 80_000,
      profit_rate_percent: 12,
      tenure_days: null,
      disbursement_value_date: null,
      maturity_date: null,
      funding_closed_at: new Date("2026-08-01T00:00:00.000Z"),
    });
    await expect(buildInvestmentNoteCertificateSnapshot("note-1")).rejects.toBeInstanceOf(
      CertificateGenerationError
    );
    expect(mockPrisma.issuerOrganizationMarcAssessment.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.issuerOrganizationMarcAssessment.findMany).not.toHaveBeenCalled();
  });

  it("uses frozen invoice risk rating and never reads live MARC", async () => {
    mockPrisma.note.findUnique.mockResolvedValue({
      id: "note-1",
      note_reference: "NOTE-1",
      funding_status: NoteFundingStatus.FUNDED,
      issuer_organization_id: "iss-1",
      issuer_snapshot: { name: "Helios", registration_number: "123", industry: "Mfg" },
      paymaster_snapshot: { name: "Paymaster Co" },
      purpose_snapshot: { financing_for: "Working capital" },
      invoice_snapshot: {
        details: { value: 100_000, number: "INV-1" },
        offer_details: { risk_rating: "SME-4" },
      },
      requested_amount: 100_000,
      target_amount: 100_000,
      funded_amount: 80_000,
      profit_rate_percent: 12,
      tenure_days: 90,
      disbursement_value_date: new Date("2026-09-01T00:00:00.000Z"),
      maturity_date: new Date("2026-11-30T00:00:00.000Z"),
      funding_closed_at: new Date("2026-08-01T00:00:00.000Z"),
    });
    mockPrisma.noteInvestment.findMany.mockResolvedValue([
      {
        investor_organization_id: "org-a",
        amount: 80_000,
        status: NoteInvestmentStatus.CONFIRMED,
      },
    ]);
    mockPrisma.issuerOrganization.findUnique.mockResolvedValue({ display_reference: "ISS-1" });
    mockPrisma.investorOrganization.findMany.mockResolvedValue([
      {
        id: "org-a",
        type: "PERSONAL",
        name: "Alice Tan",
        legal_name_on_id: "Alice Tan",
        first_name: "Alice",
        middle_name: null,
        last_name: "Tan",
        corporate_onboarding_data: null,
        display_reference: "IVT-A",
      },
    ]);

    const snapshot = await buildInvestmentNoteCertificateSnapshot("note-1");
    expect(snapshot.note.riskRating).toBe("SME-4");
    expect(snapshot.note.fundedAmount).toBe(80_000);
    expect(snapshot.note.issuerLegalName).toBe("Helios");
    expect(snapshot.certificate.certificateNumber).toBe("IINC-NOTE-1");
    expect(snapshot.investorSchedule.scheduleReference).toBe("IS-NOTE-1-V01");
    expect(snapshot.investors).toHaveLength(1);
    expect(mockPrisma.issuerOrganizationMarcAssessment.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.issuerOrganizationMarcAssessment.findMany).not.toHaveBeenCalled();
  });

  it("excludes RELEASED and CANCELLED investments", async () => {
    mockPrisma.note.findUnique.mockResolvedValue({
      id: "note-1",
      note_reference: "NOTE-1",
      funding_status: NoteFundingStatus.FUNDED,
      issuer_organization_id: "iss-1",
      issuer_snapshot: { name: "Helios", registration_number: "123", industry: "Mfg" },
      paymaster_snapshot: { name: "PM" },
      purpose_snapshot: { financing_for: "WC" },
      invoice_snapshot: { details: { value: 100_000, number: "INV-1" }, offer_details: { risk_rating: "SME-4" } },
      requested_amount: 100_000,
      target_amount: 100_000,
      funded_amount: 40_000,
      profit_rate_percent: 10,
      tenure_days: 60,
      disbursement_value_date: new Date("2026-09-01T00:00:00.000Z"),
      maturity_date: new Date("2026-10-31T00:00:00.000Z"),
      funding_closed_at: new Date("2026-08-01T00:00:00.000Z"),
    });
    mockPrisma.noteInvestment.findMany.mockImplementation(async ({ where }: any) => {
      expect(where.status.in).toEqual(["CONFIRMED", "SETTLED"]);
      return [{ investor_organization_id: "org-a", amount: 40_000 }];
    });
    mockPrisma.issuerOrganization.findUnique.mockResolvedValue({ display_reference: "ISS-1" });
    mockPrisma.investorOrganization.findMany.mockResolvedValue([
      {
        id: "org-a",
        type: "PERSONAL",
        name: "Alice",
        legal_name_on_id: "Alice",
        first_name: "Alice",
        last_name: null,
        middle_name: null,
        corporate_onboarding_data: null,
        display_reference: "IVT-A",
      },
    ]);
    const snapshot = await buildInvestmentNoteCertificateSnapshot("note-1");
    expect(snapshot.investors).toHaveLength(1);
    expect(snapshot.investors[0]?.principal).toBe(40_000);
  });
});
