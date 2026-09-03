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

const mockFreezeCertificateAuthorisation = jest.fn(async () => ({
  authorisedSignatoryName: "",
  companyStamp: null,
}));

jest.mock("../document-authorisation/config", () => ({
  freezeCertificateAuthorisation: (...args: unknown[]) =>
    mockFreezeCertificateAuthorisation(...args),
}));

import {
  buildInvestmentNoteCertificateSnapshot,
  reissueCertificateSnapshotFromReady,
} from "./snapshot";

describe("buildInvestmentNoteCertificateSnapshot", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFreezeCertificateAuthorisation.mockResolvedValue({
      authorisedSignatoryName: "",
      companyStamp: null,
    });
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
    expect(snapshot.note.issuerReference).toBe("ISS-1");
    expect(snapshot.investors[0]?.investorReference).toBe("IVT-A");
    expect(snapshot.note.companyRegistrationNumber).toBe("123");
    expect(snapshot.note.campaignReference).toBe("NOTE-1");
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

  it("freezes allocated ISS/IVT display references, not Prisma ids", async () => {
    const issuerCuid = "cmknlimvf0003grp0hsbmc1dp";
    const investorCuid = "cmkm0fc2r00059v8jzc71b39c";
    mockPrisma.note.findUnique.mockResolvedValue({
      id: "cmtjz7ez50002ks59pu7j2xml",
      note_reference: "NOTE-ARF-202609-5O3",
      funding_status: NoteFundingStatus.FUNDED,
      issuer_organization_id: issuerCuid,
      issuer_snapshot: { name: "Toyota", registration_number: "201401012345", industry: "Auto" },
      paymaster_snapshot: { name: "PM" },
      purpose_snapshot: { financing_for: "WC" },
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
      { investor_organization_id: investorCuid, amount: 80_000 },
    ]);
    mockPrisma.issuerOrganization.findUnique.mockResolvedValue({
      display_reference: "ISS-202608-DK3",
      registration_number: "201401012345",
      corporate_onboarding_data: null,
    });
    mockPrisma.investorOrganization.findMany.mockResolvedValue([
      {
        id: investorCuid,
        type: "PERSONAL",
        name: "Alice",
        legal_name_on_id: "Alice",
        first_name: "Alice",
        middle_name: null,
        last_name: null,
        corporate_onboarding_data: null,
        display_reference: "IVT-202609-A12",
      },
    ]);

    const snapshot = await buildInvestmentNoteCertificateSnapshot("note-1");
    expect(snapshot.note.issuerReference).toBe("ISS-202608-DK3");
    expect(snapshot.note.issuerReference).not.toBe(issuerCuid);
    expect(snapshot.investors[0]?.investorReference).toBe("IVT-202609-A12");
    expect(snapshot.investors[0]?.investorReference).not.toBe(investorCuid);
    expect(snapshot.investors[0]?.investorOrganizationId).toBe(investorCuid);
    expect(snapshot.note.noteId).toBe("cmtjz7ez50002ks59pu7j2xml");
    expect(snapshot.note.noteReference).toBe("NOTE-ARF-202609-5O3");
    expect(snapshot.note.campaignReference).toBe("NOTE-ARF-202609-5O3");
    expect(snapshot.certificate.certificateNumber).toBe("IINC-NOTE-ARF-202609-5O3");
    expect(snapshot.investorSchedule.scheduleReference).toBe("IS-NOTE-ARF-202609-5O3-V01");
    expect(snapshot.note.companyRegistrationNumber).toBe("201401012345");
  });

  it("does not fall back to CUID when display_reference is missing", async () => {
    const issuerCuid = "cmknlimvf0003grp0hsbmc1dp";
    const investorCuid = "cmkm0fc2r00059v8jzc71b39c";
    mockPrisma.note.findUnique.mockResolvedValue({
      id: "note-1",
      note_reference: "NOTE-ARF-202609-5O3",
      funding_status: NoteFundingStatus.FUNDED,
      issuer_organization_id: issuerCuid,
      issuer_snapshot: { name: "Toyota", registration_number: null, industry: "Auto" },
      paymaster_snapshot: { name: "PM" },
      purpose_snapshot: { financing_for: "WC" },
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
      { investor_organization_id: investorCuid, amount: 80_000 },
    ]);
    mockPrisma.issuerOrganization.findUnique.mockResolvedValue({
      display_reference: null,
      registration_number: null,
      corporate_onboarding_data: null,
    });
    mockPrisma.investorOrganization.findMany.mockResolvedValue([
      {
        id: investorCuid,
        type: "PERSONAL",
        name: "Alice",
        legal_name_on_id: "Alice",
        first_name: "Alice",
        middle_name: null,
        last_name: null,
        corporate_onboarding_data: null,
        display_reference: null,
      },
    ]);

    const snapshot = await buildInvestmentNoteCertificateSnapshot("note-1");
    expect(snapshot.note.issuerReference).toBe("—");
    expect(snapshot.note.issuerReference).not.toBe(issuerCuid);
    expect(snapshot.investors[0]?.investorReference).toBe("—");
    expect(snapshot.investors[0]?.investorReference).not.toBe(investorCuid);
    expect(snapshot.note.companyRegistrationNumber).toBe("—");
  });

  it("captures company registration from COD SSM when the org column is empty", async () => {
    mockPrisma.note.findUnique.mockResolvedValue({
      id: "note-1",
      note_reference: "NOTE-1",
      funding_status: NoteFundingStatus.FUNDED,
      issuer_organization_id: "iss-1",
      issuer_snapshot: { name: "Toyota", registration_number: null, industry: "Auto" },
      paymaster_snapshot: { name: "PM" },
      purpose_snapshot: { financing_for: "WC" },
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
      { investor_organization_id: "org-a", amount: 80_000 },
    ]);
    mockPrisma.issuerOrganization.findUnique.mockResolvedValue({
      display_reference: "ISS-1",
      registration_number: null,
      corporate_onboarding_data: { basicInfo: { ssmRegistrationNumber: "123412341234" } },
    });
    mockPrisma.investorOrganization.findMany.mockResolvedValue([
      {
        id: "org-a",
        type: "PERSONAL",
        name: "Alice",
        legal_name_on_id: "Alice",
        first_name: "Alice",
        middle_name: null,
        last_name: null,
        corporate_onboarding_data: null,
        display_reference: "IVT-A",
      },
    ]);

    const snapshot = await buildInvestmentNoteCertificateSnapshot("note-1");
    expect(snapshot.note.companyRegistrationNumber).toBe("123412341234");
  });

  it("freezes the latest authorised signatory name and stamp into the snapshot", async () => {
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
      { investor_organization_id: "org-a", amount: 80_000, status: NoteInvestmentStatus.CONFIRMED },
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
    mockFreezeCertificateAuthorisation.mockResolvedValue({
      authorisedSignatoryName: "Ahmad",
      companyStamp: {
        s3Key: "stamps/a.png",
        sha256: "stamp-a",
        contentType: "image/png",
        fileName: "a.png",
      },
    });
    const snapshot = await buildInvestmentNoteCertificateSnapshot("note-1");
    expect(snapshot.authorisation.authorisedSignatoryName).toBe("Ahmad");
    expect(snapshot.authorisation.companyStamp?.s3Key).toBe("stamps/a.png");
    expect(snapshot.certificate.certificateDateDisplay.length).toBeGreaterThan(0);
    expect(snapshot.certificate.certificateDate).toBe(snapshot.snapshotGeneratedAt);
  });
});

describe("reissueCertificateSnapshotFromReady", () => {
  it("copies financial facts and only refreshes authorisation plus version", () => {
    const previous = {
      templateId: "islamic-investment-note-certificate-v1",
      templateVersion: "V01",
      snapshotGeneratedAt: "2026-09-02T00:00:00.000Z",
      snapshotSha256: "v01-hash",
      certificate: {
        certificateNumber: "IINC-NOTE-1",
        version: "V01",
        certificateDate: "2026-09-02T00:00:00.000Z",
        certificateDateDisplay: "02 Sep 2026",
      },
      note: {
        noteId: "note-1",
        fundedAmount: 80_000,
        profitRatePercent: 12,
        contractedProfit: 2_000,
        totalAmountPayable: 82_000,
        tenureDays: 90,
      },
      investorSchedule: { fundedPrincipal: 80_000 },
      investors: [{ principal: 80_000, sharePercent: 100, expectedGrossProfit: 2_000 }],
      authorisation: {
        authorisedSignatoryName: "Ahmad",
        companyStamp: { s3Key: "stamps/a.png", sha256: "a", contentType: "image/png", fileName: "a.png" },
      },
    } as any;
    const next = reissueCertificateSnapshotFromReady(previous, {
      version: "V02",
      authorisedSignatoryName: "Sarah",
      companyStamp: {
        s3Key: "stamps/b.png",
        sha256: "b",
        contentType: "image/png",
        fileName: "b.png",
      },
      generatedAt: new Date("2026-09-03T00:00:00.000Z"),
    });
    expect(next.certificate.version).toBe("V02");
    expect(next.certificate.certificateDate).toBe("2026-09-02T00:00:00.000Z");
    expect(next.authorisation.authorisedSignatoryName).toBe("Sarah");
    expect(next.authorisation.companyStamp?.s3Key).toBe("stamps/b.png");
    expect(next.note.fundedAmount).toBe(80_000);
    expect(next.note.contractedProfit).toBe(2_000);
    expect(next.note.totalAmountPayable).toBe(82_000);
    expect(next.investors).toEqual(previous.investors);
    expect(next.snapshotSha256).not.toBe(previous.snapshotSha256);
  });
});
