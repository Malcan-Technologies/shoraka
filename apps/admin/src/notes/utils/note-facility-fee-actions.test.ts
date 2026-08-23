import {
  canWaiveNoteFacilityFeeCollection,
  isNoteInCampaignForFacilityFeeWaiver,
  noteFacilityFeeCollectionWaiverLabel,
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
  });
});
