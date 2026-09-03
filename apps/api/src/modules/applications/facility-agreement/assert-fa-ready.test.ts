import { AppError } from "../../../lib/http/error-handler";
import { createFacilityAgreementFixture } from "./fa-fixture";
import {
  assertFacilityAgreementMergeReady,
  FA_DATA_INCOMPLETE,
} from "./assert-fa-ready";
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

describe("assertFacilityAgreementMergeReady", () => {
  it("accepts a complete fixture with send date and representative snapshot", () => {
    expect(() =>
      assertFacilityAgreementMergeReady({
        mergeData: createFacilityAgreementFixture(),
        sentAt: "2026-08-19T02:00:00.000Z",
        authorizedParties: SNAPSHOT,
        liveGuarantorCount: 2,
      })
    ).not.toThrow();
  });

  it("fails when financing limit is missing", () => {
    const mergeData = createFacilityAgreementFixture();
    mergeData.financing_limit_rm = "";
    try {
      assertFacilityAgreementMergeReady({
        mergeData,
        sentAt: "2026-08-19T02:00:00.000Z",
        authorizedParties: SNAPSHOT,
        liveGuarantorCount: 0,
      });
      throw new Error("expected AppError");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect(err).toMatchObject({
        statusCode: 400,
        code: FA_DATA_INCOMPLETE,
      });
      expect((err as AppError).message).toContain("financing limit");
    }
  });

  it("fails when the authorised-representatives draft is missing", () => {
    expect(() =>
      assertFacilityAgreementMergeReady({
        mergeData: createFacilityAgreementFixture(),
        sentAt: "2026-08-19T02:00:00.000Z",
        authorizedParties: null,
        liveGuarantorCount: 0,
      })
    ).toThrow(/authorised representatives/);
  });

  it("fails when sent_at is missing", () => {
    expect(() =>
      assertFacilityAgreementMergeReady({
        mergeData: createFacilityAgreementFixture(),
        sentAt: "",
        authorizedParties: SNAPSHOT,
        liveGuarantorCount: 0,
      })
    ).toThrow(/offer send date/);
  });
});
