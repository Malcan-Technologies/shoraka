import { AppError } from "../../../lib/http/error-handler";
import { createDeedOfAssignmentFixture } from "./doa-fixture";
import { assertDeedOfAssignmentMergeReady, DOA_DATA_INCOMPLETE } from "./assert-doa-ready";
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

describe("assertDeedOfAssignmentMergeReady", () => {
  it("accepts a complete fixture with send date and representative snapshot", () => {
    expect(() =>
      assertDeedOfAssignmentMergeReady({
        mergeData: createDeedOfAssignmentFixture(),
        sentAt: "2026-07-16T02:00:00.000Z",
        authorizedParties: SNAPSHOT,
      })
    ).not.toThrow();
  });

  it("fails when assignor registration is missing", () => {
    const mergeData = createDeedOfAssignmentFixture();
    mergeData.assignor_registration_number = "";
    try {
      assertDeedOfAssignmentMergeReady({
        mergeData,
        sentAt: "2026-07-16T02:00:00.000Z",
        authorizedParties: SNAPSHOT,
      });
      throw new Error("expected AppError");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect(err).toMatchObject({
        statusCode: 400,
        code: DOA_DATA_INCOMPLETE,
      });
      expect((err as AppError).message).toContain("assignor registration number");
    }
  });

  it("fails when the authorised-representatives draft is missing", () => {
    expect(() =>
      assertDeedOfAssignmentMergeReady({
        mergeData: createDeedOfAssignmentFixture(),
        sentAt: "2026-07-16T02:00:00.000Z",
        authorizedParties: null,
      })
    ).toThrow(/authorised representatives/);
  });

  it("fails when there is no named issuer representative", () => {
    const mergeData = createDeedOfAssignmentFixture();
    mergeData.assignor_signatories = [];
    expect(() =>
      assertDeedOfAssignmentMergeReady({
        mergeData,
        sentAt: "2026-07-16T02:00:00.000Z",
        authorizedParties: SNAPSHOT,
      })
    ).toThrow(/issuer authorised representative/);
  });

  it("fails when sent_at is missing", () => {
    expect(() =>
      assertDeedOfAssignmentMergeReady({
        mergeData: createDeedOfAssignmentFixture(),
        sentAt: "",
        authorizedParties: SNAPSHOT,
      })
    ).toThrow(/offer send date/);
  });

  it("fails when assignor company name is missing", () => {
    const mergeData = createDeedOfAssignmentFixture();
    mergeData.assignor_company_name = "";
    expect(() =>
      assertDeedOfAssignmentMergeReady({
        mergeData,
        sentAt: "2026-07-16T02:00:00.000Z",
        authorizedParties: SNAPSHOT,
      })
    ).toThrow(/assignor company name/);
  });
});
