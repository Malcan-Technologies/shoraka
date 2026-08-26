jest.mock("@cashsouk/config", () => ({
  formatCurrency: (amount: number) =>
    `RM ${amount.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
}));

import {
  canWaiveNoteFacilityFeeCollection,
  isNoteInCampaignForFacilityFeeWaiver,
  noteFacilityFeeCollectionWaiverButtonLabel,
  noteFacilityFeeCollectionWaiverConfirmDescription,
  noteFacilityFeeCollectionWaiverHelp,
  noteFacilityFeeCollectionWaiverLabel,
  resolveNoteFrozenFacilityFeeCollectAmount,
} from "./note-facility-fee-actions";
import { NoteFundingStatus, NoteStatus, type NoteDetail } from "@cashsouk/types";

function campaignNote(overrides: Partial<NoteDetail> = {}): NoteDetail {
  return {
    status: NoteStatus.PUBLISHED,
    fundingStatus: NoteFundingStatus.OPEN,
    sourceContractId: "contract-1",
    facilityFeeCollectionWaiver: null,
    ...overrides,
  } as NoteDetail;
}

describe("note facility fee collection gating", () => {
  it("allows a pre-close waiver while the note is in campaign or draft on a facility", () => {
    expect(isNoteInCampaignForFacilityFeeWaiver(campaignNote())).toBe(true);
    expect(canWaiveNoteFacilityFeeCollection(campaignNote())).toBe(true);
    expect(
      canWaiveNoteFacilityFeeCollection(
        campaignNote({
          status: NoteStatus.DRAFT,
          fundingStatus: NoteFundingStatus.NOT_OPEN,
        })
      )
    ).toBe(true);
  });

  it("blocks waiver after close, without a facility, or once already waived", () => {
    expect(
      canWaiveNoteFacilityFeeCollection(
        campaignNote({ fundingStatus: NoteFundingStatus.CLOSED })
      )
    ).toBe(false);
    expect(canWaiveNoteFacilityFeeCollection(campaignNote({ sourceContractId: null }))).toBe(
      false
    );
    expect(
      canWaiveNoteFacilityFeeCollection(
        campaignNote({
          status: NoteStatus.FUNDING,
          fundingStatus: NoteFundingStatus.FUNDED,
        })
      )
    ).toBe(false);
    expect(
      canWaiveNoteFacilityFeeCollection(
        campaignNote({
          status: NoteStatus.PUBLISHED,
          fundingStatus: NoteFundingStatus.NOT_OPEN,
        })
      )
    ).toBe(false);
    expect(
      canWaiveNoteFacilityFeeCollection(
        campaignNote({
          facilityFeeCollectionWaiver: {
            version: 1,
            facilityFeeCollectionWaived: true,
            waivedAt: "2026-08-22T00:00:00.000Z",
            waivedByUserId: "admin",
            waivedReason: "Issuer request",
          },
        })
      )
    ).toBe(false);
  });

  it("surfaces the issuer-visible waived reason", () => {
    expect(noteFacilityFeeCollectionWaiverLabel(campaignNote())).toBeNull();
    expect(
      noteFacilityFeeCollectionWaiverLabel(
        campaignNote({
          facilityFeeCollectionWaiver: {
            version: 1,
            facilityFeeCollectionWaived: true,
            waivedAt: "2026-08-22T00:00:00.000Z",
            waivedByUserId: "admin",
            waivedReason: "Issuer request",
          },
        })
      )
    ).toBe("Facility fee collection waived for this note. Reason: Issuer request");
    expect(
      noteFacilityFeeCollectionWaiverLabel(
        campaignNote({
          feeSchedule: { version: 1, facilityFeeCollectAmount: 800, additionalFees: [] },
          facilityFeeCollectionWaiver: {
            version: 1,
            facilityFeeCollectionWaived: true,
            waivedAt: "2026-08-22T00:00:00.000Z",
            waivedByUserId: "admin",
            waivedReason: "Issuer request",
          },
        })
      )
    ).toBe("Facility fee collection of RM 800.00 waived for this note. Reason: Issuer request");
  });

  it("reads the frozen collect amount from the fee schedule or invoice snapshot", () => {
    expect(resolveNoteFrozenFacilityFeeCollectAmount(campaignNote())).toBeNull();
    expect(
      resolveNoteFrozenFacilityFeeCollectAmount(
        campaignNote({
          feeSchedule: { version: 1, facilityFeeCollectAmount: 800, additionalFees: [] },
        })
      )
    ).toBe(800);
    expect(
      resolveNoteFrozenFacilityFeeCollectAmount(
        campaignNote({
          invoiceSnapshot: {
            offer_details: {
              fee_schedule_version: 1,
              facility_fee_collect_amount: 1250.5,
              additional_fees: [],
            },
          },
        })
      )
    ).toBe(1250.5);
  });

  it("shows the frozen amount on waiver help and confirm copy", () => {
    const note = campaignNote({
      feeSchedule: { version: 1, facilityFeeCollectAmount: 800, additionalFees: [] },
    });
    expect(noteFacilityFeeCollectionWaiverHelp(note)).toBe(
      "Waive this note's frozen facility-fee collection of RM 800.00 before funding closes. The issuer can see the waived state."
    );
    expect(noteFacilityFeeCollectionWaiverConfirmDescription(note)).toBe(
      "This note will not collect RM 800.00 at disbursement. The remainder stays on the facility. A reason is required and is visible to the issuer."
    );
    expect(noteFacilityFeeCollectionWaiverHelp(campaignNote())).toBe(
      "Waive this note's frozen facility-fee collection before funding closes. The issuer can see the waived state."
    );
    expect(noteFacilityFeeCollectionWaiverButtonLabel(note)).toBe("Waive RM 800.00 collection");
    expect(noteFacilityFeeCollectionWaiverButtonLabel(campaignNote())).toBe(
      "Waive facility fee collection"
    );
  });
});
