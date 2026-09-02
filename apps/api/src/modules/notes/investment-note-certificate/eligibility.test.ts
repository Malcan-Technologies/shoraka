import { NoteFundingStatus, NoteStatus } from "@prisma/client";
import { isNoteEligibleForCertificateGeneration } from "./eligibility";

describe("investment note certificate eligibility", () => {
  it("requires funded, disbursed, and an issued note status", () => {
    expect(
      isNoteEligibleForCertificateGeneration({
        funding_status: NoteFundingStatus.FUNDED,
        status: NoteStatus.ACTIVE,
        disbursement_value_date: new Date("2026-09-02"),
      })
    ).toBe(true);
    expect(
      isNoteEligibleForCertificateGeneration({
        funding_status: NoteFundingStatus.FUNDED,
        status: NoteStatus.REPAID,
        disbursement_value_date: new Date("2026-09-02"),
      })
    ).toBe(true);
    expect(
      isNoteEligibleForCertificateGeneration({
        funding_status: NoteFundingStatus.FUNDED,
        status: NoteStatus.PUBLISHED,
        disbursement_value_date: new Date("2026-09-02"),
      })
    ).toBe(false);
    expect(
      isNoteEligibleForCertificateGeneration({
        funding_status: NoteFundingStatus.FUNDED,
        status: NoteStatus.ACTIVE,
        disbursement_value_date: null,
      })
    ).toBe(false);
    expect(
      isNoteEligibleForCertificateGeneration({
        funding_status: NoteFundingStatus.OPEN,
        status: NoteStatus.ACTIVE,
        disbursement_value_date: new Date("2026-09-02"),
      })
    ).toBe(false);
  });
});
