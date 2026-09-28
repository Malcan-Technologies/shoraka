import type { Prisma } from "@prisma/client";

import { NoteFundingStatus, NoteListingStatus, NoteStatus } from "@prisma/client";
import { CERTIFICATE_FIRST_VERSION, investorScheduleReferenceFor } from "./investment-note-certificate/types";

import { NoteService } from "./service";

const mockNote = {
  id: "note-1",
  note_reference: "NOTE-1",
  status: NoteStatus.PUBLISHED,
  funding_status: NoteFundingStatus.OPEN,
  listing_status: NoteListingStatus.NOT_LISTED,
  servicing_status: "NOT_STARTED",
  title: "Note 1",
  funded_amount: 100_000,
  target_amount: 100_000,
  minimum_funding_percent: 80,
  profit_rate_percent: 10,
  platform_fee_rate_percent: 0,
  service_fee_rate_percent: 0,
  service_fee_customer_scope: null,
  issuer_organization_id: "issuer-1",
  paymaster_snapshot: null,
  issuer_snapshot: { name: "Issuer", registration_number: "123", industry: "Mfg" },
  purpose_snapshot: { financing_for: "WC" },
  invoice_snapshot: { offer_details: {}, details: { value: 100_000 } },
  requested_amount: 100_000,
  funded_amount_currency: null,
  source_contract_id: null,
  source_invoice_id: null,
  source_application_id: "app-1",
  maturity_date: new Date("2026-10-31T00:00:00.000Z"),
  tenure_days: 60,
  disbursement_value_date: null,
  funding_closed_at: null,
};

jest.mock("./repository", () => ({
  noteInclude: {},
  noteRepository: {
    findById: jest.fn(),
  },
}));

jest.mock("./mapper", () => ({
  mapNoteDetail: jest.fn().mockResolvedValue({ id: "note-1" }),
  mapNoteListItem: jest.fn(),
}));

jest.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    issuerOrganization: { findUnique: jest.fn() },
  },
}));

jest.mock("../../lib/refresh-contract-facility", () => ({
  lockContractRow: jest.fn(),
  refreshContractFacilityForNote: jest.fn(),
}));

jest.mock("../../lib/facility-fee-collect-reservation", () => ({
  settleCloseFundingFacilityFees: jest.fn(),
  assertInvoiceFeeScheduleChargeable: jest.fn(),
}));

jest.mock("../notification/note-lifecycle-notifications", () => ({
  notifyNoteFundingSucceeded: jest.fn(),
  resolveNoteNotificationTitle: jest.fn(() => "Note 1"),
}));

jest.mock("@cashsouk/types", () => {
  const actual = jest.requireActual("@cashsouk/types");
  return {
    ...actual,
    settleDisbursementFees: jest.fn(() => ({
      drawdownFee: 0,
      additionalFeeCharges: [],
      netDisbursement: 0,
    })),
  };
});

describe("reserved investor schedule reference (behavioral)", () => {
  it("persists reserved investor schedule reference + version when funding closes", async () => {
    const { prisma } = await import("../../lib/prisma");
    const { noteRepository } = await import("./repository");

    (noteRepository.findById as jest.Mock).mockResolvedValue(mockNote);
    (prisma.issuerOrganization.findUnique as jest.Mock).mockResolvedValue({
      id: "issuer-1",
      name: "Issuer",
      bank_account_details: {},
    });

    const stateUpdate = jest.fn().mockResolvedValue({ count: 1 });
    const noteInvestmentUpdate = jest.fn().mockResolvedValue({ count: 1 });
    const noteFindUniqueOrThrow = jest.fn().mockResolvedValue({
      ...mockNote,
      // closeFunding uses these after the state update.
      platform_fee_rate_percent: 0,
      invoice_snapshot: mockNote.invoice_snapshot,
      issuer_organization_id: "issuer-1",
      source_contract_id: null,
    });

    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: (tx: any) => unknown) => {
      const tx = {
        $queryRaw: jest.fn(async (strings: TemplateStringsArray) => {
          const sql = Array.from(strings).join(" ");
          if (sql.includes("FROM notes")) {
            return [
              {
                status: NoteStatus.PUBLISHED,
                funding_status: NoteFundingStatus.OPEN,
                funded_amount: 100_000,
                target_amount: 100_000,
              },
            ];
          }
          if (sql.includes("FROM note_listings")) {
            return [{ closes_at: null }];
          }
          return [];
        }),
        note: {
          updateMany: stateUpdate,
          findUniqueOrThrow: noteFindUniqueOrThrow,
        },
        noteInvestment: {
          updateMany: noteInvestmentUpdate,
        },
      } as unknown as Prisma.TransactionClient;

      return cb(tx);
    });

    const service = new NoteService();
    jest.spyOn(service, "postDisbursementLedger").mockResolvedValue(undefined);
    jest.spyOn(service, "logAdminAction").mockResolvedValue(undefined);

    const actor = { userId: "admin-1", role: "ADMIN" as const, portal: "ADMIN" as const };
    await service.closeFunding("note-1", actor);

    // The first tx.note.updateMany is the "stateUpdate" that marks funding successful.
    expect(stateUpdate).toHaveBeenCalled();
    const updateArgs = stateUpdate.mock.calls[0][0];
    const reservedReference = updateArgs.data.reserved_investor_schedule_reference;
    const reservedVersion = updateArgs.data.reserved_investor_schedule_reference_version;

    expect(reservedVersion).toBe(CERTIFICATE_FIRST_VERSION);

    // Invariant: reserved value must equal the canonical investor schedule reference for the note+version.
    const expected = investorScheduleReferenceFor(mockNote.note_reference, reservedVersion);
    expect(reservedReference).toBe(expected);
  });
});

