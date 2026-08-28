import { AppError } from "../../../lib/http/error-handler";
import { createFacilityLoFixture } from "./facility-lo-fixture";
import { assertFacilityLoMergeReady, FACILITY_LO_DATA_INCOMPLETE } from "./assert-facility-lo-ready";
import type { AuthorizedPartiesSnapshot } from "@cashsouk/types";

const SNAPSHOT: AuthorizedPartiesSnapshot = {
  submitted_by_user_id: "user_1",
  submitted_at: "2026-08-21T00:00:00.000Z",
  parties: [
    {
      key: "issuer",
      entity_kind: "ISSUER",
      representatives: [
        {
          name: "Ali",
          email: "ali@co.my",
          ic_number: "820508105871",
          capacity: "director",
          person_match_key: "820508105871",
        },
      ],
    },
  ],
};

describe("assertFacilityLoMergeReady", () => {
  it("accepts a complete fixture with send date and representative snapshot", () => {
    expect(() =>
      assertFacilityLoMergeReady({
        mergeData: createFacilityLoFixture(),
        sentAt: "2026-07-16T02:00:00.000Z",
        authorizedParties: SNAPSHOT,
        liveGuarantorCount: 2,
      })
    ).not.toThrow();
  });

  it("fails with a specific error when required commercial data is missing", () => {
    const mergeData = createFacilityLoFixture();
    mergeData.sub_limit_per_invoice_rm = "";
    mergeData.part_b_financing_amount_rm = "";
    try {
      assertFacilityLoMergeReady({
        mergeData,
        sentAt: "2026-07-16T02:00:00.000Z",
        authorizedParties: SNAPSHOT,
        liveGuarantorCount: 0,
      });
      throw new Error("expected AppError");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect(err).toMatchObject({
        statusCode: 400,
        code: FACILITY_LO_DATA_INCOMPLETE,
      });
      expect((err as AppError).message).toContain("invoice sub-limit");
    }
  });

  it("fails when the authorised-representatives draft is missing", () => {
    expect(() =>
      assertFacilityLoMergeReady({
        mergeData: createFacilityLoFixture(),
        sentAt: "2026-07-16T02:00:00.000Z",
        authorizedParties: null,
        liveGuarantorCount: 0,
      })
    ).toThrow(/authorised representatives/);
  });

  it("fails when sent_at is missing", () => {
    expect(() =>
      assertFacilityLoMergeReady({
        mergeData: createFacilityLoFixture(),
        sentAt: "",
        authorizedParties: SNAPSHOT,
        liveGuarantorCount: 0,
      })
    ).toThrow(/offer send date/);
  });
});
