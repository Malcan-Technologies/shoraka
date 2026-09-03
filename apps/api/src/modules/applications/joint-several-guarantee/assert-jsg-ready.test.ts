import { AppError } from "../../../lib/http/error-handler";
import { createJsgFixture } from "./jsg-fixture";
import { assertJsgMergeReady, JSG_DATA_INCOMPLETE } from "./assert-jsg-ready";
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

describe("assertJsgMergeReady", () => {
  it("accepts a complete fixture with send date and representative snapshot", () => {
    expect(() =>
      assertJsgMergeReady({
        mergeData: createJsgFixture(),
        sentAt: "2026-07-16T02:00:00.000Z",
        authorizedParties: SNAPSHOT,
        liveGuarantorCount: 3,
      })
    ).not.toThrow();
  });

  it("fails when facility description cannot be built", () => {
    const mergeData = createJsgFixture();
    mergeData.facility_description = "";
    try {
      assertJsgMergeReady({
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
        code: JSG_DATA_INCOMPLETE,
      });
      expect((err as AppError).message).toContain("facility description");
    }
  });

  it("fails when the authorised-representatives draft is missing", () => {
    expect(() =>
      assertJsgMergeReady({
        mergeData: createJsgFixture(),
        sentAt: "2026-07-16T02:00:00.000Z",
        authorizedParties: null,
        liveGuarantorCount: 0,
      })
    ).toThrow(/authorised representatives/);
  });

  it("fails when sent_at is missing", () => {
    expect(() =>
      assertJsgMergeReady({
        mergeData: createJsgFixture(),
        sentAt: "",
        authorizedParties: SNAPSHOT,
        liveGuarantorCount: 0,
      })
    ).toThrow(/offer send date/);
  });

  it("fails when corporate guarantors have no named representatives", () => {
    const mergeData = createJsgFixture();
    mergeData.guarantors_corporate = [
      { name: "HoldCo", ssm: "999999-X", signatories: [{ name: "", nric: "", capacity: "" }] },
    ];
    expect(() =>
      assertJsgMergeReady({
        mergeData,
        sentAt: "2026-07-16T02:00:00.000Z",
        authorizedParties: SNAPSHOT,
        liveGuarantorCount: 1,
      })
    ).toThrow(/corporate guarantor authorised representatives/);
  });
});
