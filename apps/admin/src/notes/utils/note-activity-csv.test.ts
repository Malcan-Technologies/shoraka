import { buildNoteActivityCsv, formatNoteActivityEventLabel, noteEventToActivityCsvRow } from "./note-activity-csv";
import type { NoteEvent } from "@cashsouk/types";

function event(overrides: Partial<NoteEvent> = {}): NoteEvent {
  return {
    id: "evt-1",
    noteId: "note-1",
    eventType: "NOTE_PUBLISHED",
    actorUserId: "user-1",
    actorName: "Ada Admin",
    actorRole: "ADMIN",
    portal: "admin",
    correlationId: "corr-1",
    metadata: { listingId: "lst-1" },
    createdAt: "2026-08-18T09:00:00.000Z",
    ...overrides,
  };
}

describe("formatNoteActivityEventLabel", () => {
  it("maps known types and rewrites Shoraka to Tawarruq", () => {
    expect(formatNoteActivityEventLabel("NOTE_PUBLISHED")).toBe("Note Published");
    expect(formatNoteActivityEventLabel("PAUSE_LISTING")).toBe("Campaign Paused");
    expect(formatNoteActivityEventLabel("FAIL_FUNDING")).toBe("Funding Unsuccessful");
    expect(formatNoteActivityEventLabel("PROSPECTUS_REVIEW_APPROVE")).toBe("Prospectus Approved");
    expect(formatNoteActivityEventLabel("PROSPECTUS_APPROVAL_INVALIDATED_UNPUBLISH")).toBe(
      "Prospectus Approval Cleared After Unpublish"
    );
    expect(formatNoteActivityEventLabel("SHORAKA_ORDER_SUBMITTED")).toBe(
      "Tawarruq Order Submitted"
    );
    expect(formatNoteActivityEventLabel("INVESTMENT_NOTE_CERTIFICATE_GENERATED")).toBe(
      "Investment Note Certificate Generated"
    );
    expect(formatNoteActivityEventLabel("INVESTMENT_NOTE_CERTIFICATE_REISSUED")).toBe(
      "Investment Note Certificate Reissued"
    );
    expect(formatNoteActivityEventLabel("SETTLEMENT_HIBAH_RECEIPT_GENERATED")).toBe(
      "Settlement & Hibah Receipt Generated"
    );
    expect(formatNoteActivityEventLabel("SETTLEMENT_HIBAH_RECEIPT_REISSUED")).toBe(
      "Settlement & Hibah Receipt Reissued"
    );
    expect(formatNoteActivityEventLabel("INVESTMENT_SETTLEMENT_CONFIRMATION_GENERATED")).toBe(
      "Investment Settlement Confirmation Generated"
    );
    expect(formatNoteActivityEventLabel("WITHDRAWAL_TRUSTEE_EMAIL_SENT")).toBe(
      "Withdrawal Trustee Email Sent"
    );
    expect(formatNoteActivityEventLabel("SETTLEMENT_TRUSTEE_EMAIL_SENT")).toBe(
      "Settlement Trustee Email Sent"
    );
    expect(formatNoteActivityEventLabel("SETTLEMENT_TRUSTEE_LETTER_GENERATED")).toBe(
      "Settlement Trustee Letter Generated"
    );
    expect(formatNoteActivityEventLabel("SETTLEMENT_TRUSTEE_LETTER_SUBMITTED")).toBe(
      "Settlement Trustee Letter Submitted"
    );
    expect(formatNoteActivityEventLabel("SETTLEMENT_TRUSTEE_INSTRUCTION_COMPLETED")).toBe(
      "Settlement Trustee Instruction Completed"
    );
    expect(
      formatNoteActivityEventLabel("WITHDRAWAL_LETTER_GENERATED", {
        withdrawalType: "ISSUER_RESIDUAL_RETURN",
      })
    ).toBe("Residual Return Letter Generated");
    expect(
      formatNoteActivityEventLabel("WITHDRAWAL_SUBMITTED_TO_TRUSTEE", {
        withdrawalType: "ISSUER_RESIDUAL_RETURN",
      })
    ).toBe("Residual Return Submitted to Trustee");
    expect(
      formatNoteActivityEventLabel("WITHDRAWAL_COMPLETED", {
        withdrawalType: "ISSUER_RESIDUAL_RETURN",
      })
    ).toBe("Residual Return Completed");
    expect(formatNoteActivityEventLabel("WITHDRAWAL_COMPLETED")).toBe("Withdrawal Completed");
    expect(formatNoteActivityEventLabel("CUSTOM_EVENT_TYPE")).toBe("Custom Event Type");
    expect(
      formatNoteActivityEventLabel("WITHDRAWAL_TRUSTEE_EMAIL_SENT", { resend: true })
    ).toBe("Withdrawal Trustee Email Redelivered");
    expect(
      formatNoteActivityEventLabel("SETTLEMENT_TRUSTEE_EMAIL_SENT", { resend: true })
    ).toBe("Settlement Trustee Email Redelivered");
  });
});

describe("buildNoteActivityCsv", () => {
  it("maps forensic source API to Portal in the exported CSV", () => {
    const csv = buildNoteActivityCsv([
      event({
        eventType: "NOTE_PUBLISHED",
        source: "API",
        portal: "ADMIN",
      }),
    ]);
    expect(csv).toContain("Portal");
    expect(csv).not.toContain('"API"');
  });

  it("quotes cells and serialises metadata", () => {
    const csv = buildNoteActivityCsv([
      event({
        eventType: "NOTE_CREATED",
        metadata: { message: "Issuer said ready" },
      }),
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Timestamp");
    expect(lines[0]).toContain("Event");
    expect(lines[0]).toContain("Actor");
    expect(lines[1]).toContain("Note Created");
    expect(lines[1]).toContain("NOTE_CREATED");
    expect(lines[1]).toContain("Issuer said ready");
    expect(lines[1]).toContain("Ada Admin");
  });

  it("puts the same amount shown in detail into the Amount column", () => {
    const csv = buildNoteActivityCsv([
      event({
        eventType: "INVESTMENT_COMMITTED",
        metadata: { amount: 25000, investmentId: "inv-1" },
      }),
    ]);
    expect(csv).toContain("25000");
    expect(csv).toContain("INVESTMENT_COMMITTED");
    expect(csv).toContain("Investment Committed");
  });

  it("exports an empty table with only the header", () => {
    expect(buildNoteActivityCsv([]).split("\n")).toHaveLength(1);
  });

  it("exports trustee-email delivery and redelivery labels with forensic metadata", () => {
    const csv = buildNoteActivityCsv([
      event({
        eventType: "WITHDRAWAL_TRUSTEE_EMAIL_SENT",
        metadata: { withdrawalId: "wd-1", withdrawalReference: "WD-1", messageId: "ses-1" },
      }),
      event({
        id: "evt-2",
        eventType: "SETTLEMENT_TRUSTEE_EMAIL_SENT",
        metadata: {
          settlementId: "set-1",
          settlementReference: "STL-1",
          messageId: "ses-2",
          resend: true,
        },
      }),
    ]);
    expect(csv).toContain("Withdrawal Trustee Email Sent");
    expect(csv).toContain("WITHDRAWAL_TRUSTEE_EMAIL_SENT");
    expect(csv).toContain("wd-1");
    expect(csv).toContain("WD-1");
    expect(csv).toContain("Settlement Trustee Email Redelivered");
    expect(csv).toContain("SETTLEMENT_TRUSTEE_EMAIL_SENT");
    expect(csv).toContain("set-1");
    expect(csv).toContain("STL-1");
    expect(csv).toContain("ses-2");
  });

  it("exports settlement trustee letter, submit, and complete labels", () => {
    const csv = buildNoteActivityCsv([
      event({
        eventType: "SETTLEMENT_TRUSTEE_LETTER_GENERATED",
        metadata: { settlementId: "set-1", s3Key: "letters/a.pdf" },
      }),
      event({
        id: "evt-3",
        eventType: "SETTLEMENT_TRUSTEE_LETTER_SUBMITTED",
        metadata: { settlementId: "set-1" },
      }),
      event({
        id: "evt-5",
        eventType: "SETTLEMENT_TRUSTEE_INSTRUCTION_COMPLETED",
        metadata: { settlementId: "set-1", completedAt: "2026-08-26T00:00:00.000Z" },
      }),
    ]);
    expect(csv).toContain("Settlement Trustee Letter Generated");
    expect(csv).toContain("SETTLEMENT_TRUSTEE_LETTER_GENERATED");
    expect(csv).toContain("Settlement Trustee Letter Submitted");
    expect(csv).toContain("SETTLEMENT_TRUSTEE_LETTER_SUBMITTED");
    expect(csv).toContain("Settlement Trustee Instruction Completed");
    expect(csv).toContain("SETTLEMENT_TRUSTEE_INSTRUCTION_COMPLETED");
    expect(csv).toContain("letters/a.pdf");
  });

  it("keeps the internal withdrawal id and includes the display reference", () => {
    expect(formatNoteActivityEventLabel("WITHDRAWAL_SUBMITTED_TO_TRUSTEE")).toBe(
      "Withdrawal Submitted to Trustee"
    );
    const csv = buildNoteActivityCsv([
      event({
        eventType: "WITHDRAWAL_SUBMITTED_TO_TRUSTEE",
        metadata: {
          withdrawalId: "clyk2n9x0001qwertyuiop",
          withdrawalReference: "WDL-ARF-202608-A1Z",
        },
      }),
    ]);
    expect(csv).toContain("Withdrawal Submitted to Trustee");
    expect(csv).toContain("clyk2n9x0001qwertyuiop");
    expect(csv).toContain("WDL-ARF-202608-A1Z");
  });

  it("uses the canonical withdrawal reference as the CSV target column", () => {
    const row = noteEventToActivityCsvRow(
      event({
        eventType: "WITHDRAWAL_TRUSTEE_EMAIL_SENT",
        targetId: "clyk2n9x0001qwertyuiop",
        noteId: "note-internal",
        metadata: {
          withdrawalId: "clyk2n9x0001qwertyuiop",
          withdrawalReference: "WDL-ARF-202608-A1Z",
        },
      })
    );
    expect(row.targetReference).toBe("WDL-ARF-202608-A1Z");
  });

  it("uses a nested historical noteReference for CSV when top-level is absent", () => {
    const row = noteEventToActivityCsvRow(
      event({
        eventType: "NOTE_PUBLISHED",
        metadata: { afterState: { noteReference: "NT-ARF-202608-K9P" } },
      })
    );
    expect(row.targetReference).toBe("NT-ARF-202608-K9P");
  });

  it("exports WITHDRAWAL_LETTER_GENERATED with id, display reference, and raw event type", () => {
    const row = noteEventToActivityCsvRow(
      event({
        eventType: "WITHDRAWAL_LETTER_GENERATED",
        targetType: "WITHDRAWAL",
        targetId: "wdl-internal-id",
        metadata: {
          withdrawalId: "wdl-internal-id",
          withdrawalReference: "WDL-ARF-202608-A1Z",
          s3Key: "withdrawal-letters/letter.pdf",
        },
      })
    );
    expect(row.event).toBe("Withdrawal Letter Generated");
    expect(row.eventType).toBe("WITHDRAWAL_LETTER_GENERATED");
    expect(row.targetType).toBe("WITHDRAWAL");
    expect(row.targetReference).toBe("WDL-ARF-202608-A1Z");
    expect(row.metadata).toMatchObject({
      withdrawalId: "wdl-internal-id",
      withdrawalReference: "WDL-ARF-202608-A1Z",
      s3Key: "withdrawal-letters/letter.pdf",
    });
  });

  it("labels residual-return withdrawal events in CSV without changing the stored event type", () => {
    const row = noteEventToActivityCsvRow(
      event({
        eventType: "WITHDRAWAL_COMPLETED",
        metadata: {
          withdrawalId: "wdl-residual",
          withdrawalReference: "WDL-ARF-202608-R1Z",
          withdrawalType: "ISSUER_RESIDUAL_RETURN",
        },
      })
    );
    expect(row.event).toBe("Residual Return Completed");
    expect(row.eventType).toBe("WITHDRAWAL_COMPLETED");
  });

  it("exports Shoraka with the CashSouk trade-order id as target, keeping provider_order_id in metadata", () => {
    const row = noteEventToActivityCsvRow(
      event({
        eventType: "SHORAKA_ORDER_SUBMITTED",
        targetType: "SHORAKA_ORDER",
        targetId: "trade-order-cuid",
        metadata: {
          trade_order_id: "trade-order-cuid",
          provider_order_id: "provider-order-abc",
        },
      })
    );
    expect(row.event).toBe("Tawarruq Order Submitted");
    expect(row.eventType).toBe("SHORAKA_ORDER_SUBMITTED");
    expect(row.targetType).toBe("SHORAKA_ORDER");
    expect(row.targetReference).toBe("trade-order-cuid");
    expect(row.targetReference).not.toBe("provider-order-abc");
    expect(row.metadata).toMatchObject({
      trade_order_id: "trade-order-cuid",
      provider_order_id: "provider-order-abc",
    });
  });

  it("exports facility-fee waive with reason plus before/after on the kept event", () => {
    const row = noteEventToActivityCsvRow(
      event({
        eventType: "WAIVE_FACILITY_FEE_COLLECTION",
        metadata: {
          reason: "Issuer requested waiver",
          beforeState: { facilityFeeCollectionEnabled: true },
          afterState: { facilityFeeCollectionEnabled: false },
        },
      })
    );
    expect(row.event).toBe("Facility Fee Collection Waived");
    expect(row.eventType).toBe("WAIVE_FACILITY_FEE_COLLECTION");
    expect(row.metadata).toMatchObject({
      reason: "Issuer requested waiver",
      beforeState: { facilityFeeCollectionEnabled: true },
      afterState: { facilityFeeCollectionEnabled: false },
    });
  });

  it("still exports historical NOTE_FACILITY_FEE_COLLECTION_WAIVED rows", () => {
    const csv = buildNoteActivityCsv([
      event({
        eventType: "NOTE_FACILITY_FEE_COLLECTION_WAIVED",
        metadata: { reason: "legacy row" },
      }),
    ]);
    expect(csv).toContain("NOTE_FACILITY_FEE_COLLECTION_WAIVED");
    expect(csv).toContain("Facility Fee Collection Waived");
    expect(csv).toContain("legacy row");
  });

  it("uses the withdrawal reference for ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED", () => {
    const row = noteEventToActivityCsvRow(
      event({
        eventType: "ISSUER_DISBURSEMENT_WITHDRAWAL_CREATED",
        noteId: "note-internal",
        targetId: "wdl-internal-id",
        metadata: {
          withdrawalId: "wdl-internal-id",
          withdrawalReference: "WDL-ARF-202608-A1Z",
        },
      })
    );
    expect(row.targetReference).toBe("WDL-ARF-202608-A1Z");
  });

  it("exports settlement hibah receipt with SET reference and hibah amount", () => {
    const row = noteEventToActivityCsvRow(
      event({
        eventType: "SETTLEMENT_HIBAH_RECEIPT_GENERATED",
        targetType: "NOTE_SETTLEMENT",
        targetId: "set-1",
        metadata: {
          settlementId: "set-1",
          settlementReference: "SET-ARF-202608-A52",
          receiptNumber: "SET-ARF-202608-A52",
          version: "V01",
          hibahAmount: 1750,
        },
      })
    );
    expect(row.event).toBe("Settlement & Hibah Receipt Generated");
    expect(row.eventType).toBe("SETTLEMENT_HIBAH_RECEIPT_GENERATED");
    expect(row.targetType).toBe("NOTE_SETTLEMENT");
    expect(row.targetReference).toBe("SET-ARF-202608-A52");
    expect(row.amount).toBe(1750);
  });

  it("exports investor settlement confirmation count against the settlement reference", () => {
    const row = noteEventToActivityCsvRow(
      event({
        eventType: "INVESTMENT_SETTLEMENT_CONFIRMATION_GENERATED",
        targetType: "NOTE_SETTLEMENT",
        targetId: "set-1",
        metadata: {
          settlementId: "set-1",
          settlementReference: "SET-ARF-202608-A52",
          version: "V01",
          confirmationCount: 3,
        },
      })
    );
    expect(row.event).toBe("Investment Settlement Confirmation Generated");
    expect(row.targetReference).toBe("SET-ARF-202608-A52");
  });
});
