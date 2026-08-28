import { AppError } from "../../lib/http/error-handler";
import type { AuthorizedPartiesSnapshot } from "@cashsouk/types";
import {
  assertUnflaggedAuthorizedPartiesUnchanged,
  authorizedRepresentativeReviewItemIdRemap,
  collectFlaggedAuthorizedRepresentativeItemIds,
  resolveAuthorizedRepresentativeReviewKeysToResetOnSubmit,
} from "./authorized-representatives-review";

const SNAPSHOT: AuthorizedPartiesSnapshot = {
  submitted_by_user_id: "user_1",
  submitted_at: "2026-08-21T00:00:00.000Z",
  parties: [
    {
      key: "issuer",
      entity_kind: "ISSUER",
      representatives: [
        {
          name: "Ali Bin Abu",
          email: "ali@co.my",
          ic_number: "820508105871",
          capacity: "director",
          person_match_key: "820508105871",
        },
      ],
    },
    {
      key: "g_co",
      entity_kind: "CORPORATE_GUARANTOR",
      application_guarantor_id: "g_co",
      representatives: [
        {
          name: "Nora",
          email: "nora@holdco.my",
          ic_number: "880101015555",
          capacity: "authorised_signatory",
        },
      ],
    },
  ],
};

describe("authorized-representatives-review", () => {
  describe("collectFlaggedAuthorizedRepresentativeItemIds", () => {
    it("returns AMENDMENT_REQUESTED party item ids only", () => {
      const flagged = collectFlaggedAuthorizedRepresentativeItemIds([
        {
          item_type: "authorized_representatives",
          item_id: "authorized_representatives:guarantor:g_co",
          status: "AMENDMENT_REQUESTED",
        },
        {
          item_type: "authorized_representatives",
          item_id: "authorized_representatives:issuer",
          status: "APPROVED",
        },
        {
          item_type: "document",
          item_id: "acceptance_documents:0:board_resolution",
          status: "AMENDMENT_REQUESTED",
        },
      ]);
      expect([...flagged]).toEqual(["authorized_representatives:guarantor:g_co"]);
    });
  });

  describe("resolveAuthorizedRepresentativeReviewKeysToResetOnSubmit", () => {
    const allKeys = [
      "authorized_representatives:issuer",
      "authorized_representatives:guarantor:g_co",
    ];
    const reviewItems = [
      {
        item_type: "authorized_representatives",
        item_id: "authorized_representatives:issuer",
        status: "APPROVED",
      },
      {
        item_type: "authorized_representatives",
        item_id: "authorized_representatives:guarantor:g_co",
        status: "AMENDMENT_REQUESTED",
      },
    ];

    it("resets all snapshot keys on first submit", () => {
      expect(
        resolveAuthorizedRepresentativeReviewKeysToResetOnSubmit(
          "PENDING_ISSUER",
          allKeys,
          reviewItems
        )
      ).toEqual(allKeys);
    });

    it("resets only flagged keys from CHANGES_REQUESTED", () => {
      expect(
        resolveAuthorizedRepresentativeReviewKeysToResetOnSubmit(
          "CHANGES_REQUESTED",
          allKeys,
          reviewItems
        )
      ).toEqual(["authorized_representatives:guarantor:g_co"]);
    });

    it("resets the stable client key when a flagged Prisma-id review row is remapped", () => {
      expect(
        resolveAuthorizedRepresentativeReviewKeysToResetOnSubmit(
          "CHANGES_REQUESTED",
          [
            "authorized_representatives:issuer",
            "authorized_representatives:guarantor:g-company-abc",
          ],
          [
            {
              item_type: "authorized_representatives",
              item_id: "authorized_representatives:guarantor:g_co",
              status: "AMENDMENT_REQUESTED",
            },
          ],
          {
            previous: SNAPSHOT,
            nextParties: [
              SNAPSHOT.parties[0]!,
              {
                ...SNAPSHOT.parties[1]!,
                key: "g-company-abc",
                application_guarantor_id: "g_co",
                client_guarantor_id: "g-company-abc",
              },
            ],
            guarantors: [
              {
                id: "g_co",
                client_guarantor_id: "g-company-abc",
                guarantor_type: "company",
                business_name: "HoldCo Sdn Bhd",
              },
            ],
          }
        )
      ).toEqual(["authorized_representatives:guarantor:g-company-abc"]);
    });
  });

  describe("assertUnflaggedAuthorizedPartiesUnchanged", () => {
    it("allows changing a flagged corporate list", () => {
      const next = [
        SNAPSHOT.parties[0]!,
        {
          ...SNAPSHOT.parties[1]!,
          representatives: [
            {
              name: "New Nora",
              email: "new.nora@holdco.my",
              ic_number: "880101015555",
              capacity: "authorised_signatory" as const,
            },
          ],
        },
      ];
      expect(() =>
        assertUnflaggedAuthorizedPartiesUnchanged(
          SNAPSHOT,
          next,
          new Set(["authorized_representatives:guarantor:g_co"])
        )
      ).not.toThrow();
    });

    it("rejects changing an unflagged issuer list", () => {
      const next = [
        {
          ...SNAPSHOT.parties[0]!,
          representatives: [
            {
              name: "Siti",
              email: "siti@co.my",
              ic_number: "900101015555",
              capacity: "director" as const,
              person_match_key: "900101015555",
            },
          ],
        },
        SNAPSHOT.parties[1]!,
      ];
      try {
        assertUnflaggedAuthorizedPartiesUnchanged(
          SNAPSHOT,
          next,
          new Set(["authorized_representatives:guarantor:g_co"])
        );
        fail("expected throw");
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(403);
        expect((error as AppError).code).toBe("EDIT_NOT_ALLOWED");
      }
    });

    it("allows resubmitting an unflagged corporate list after Prisma ids are rewritten", () => {
      const next = [
        SNAPSHOT.parties[0]!,
        {
          ...SNAPSHOT.parties[1]!,
          key: "new_co",
          application_guarantor_id: "new_co",
          client_guarantor_id: "g-company-abc",
        },
      ];
      expect(() =>
        assertUnflaggedAuthorizedPartiesUnchanged(
          {
            ...SNAPSHOT,
            parties: [
              SNAPSHOT.parties[0]!,
              { ...SNAPSHOT.parties[1]!, client_guarantor_id: "g-company-abc" },
            ],
          },
          next,
          new Set(["authorized_representatives:issuer"]),
          [
            {
              id: "new_co",
              client_guarantor_id: "g-company-abc",
              guarantor_type: "company",
              business_name: "HoldCo Sdn Bhd",
            },
          ]
        )
      ).not.toThrow();
    });

    it("rejects changing unflagged corporate people even when Prisma ids were rewritten", () => {
      const previous = {
        ...SNAPSHOT,
        parties: [
          SNAPSHOT.parties[0]!,
          { ...SNAPSHOT.parties[1]!, client_guarantor_id: "g-company-abc" },
        ],
      };
      const next = [
        SNAPSHOT.parties[0]!,
        {
          ...SNAPSHOT.parties[1]!,
          key: "new_co",
          application_guarantor_id: "new_co",
          client_guarantor_id: "g-company-abc",
          representatives: [
            {
              name: "Someone Else",
              email: "else@holdco.my",
              ic_number: "880101015555",
              capacity: "authorised_signatory" as const,
            },
          ],
        },
      ];
      try {
        assertUnflaggedAuthorizedPartiesUnchanged(
          previous,
          next,
          new Set(["authorized_representatives:issuer"]),
          [
            {
              id: "new_co",
              client_guarantor_id: "g-company-abc",
              guarantor_type: "company",
              business_name: "HoldCo Sdn Bhd",
            },
          ]
        );
        fail("expected throw");
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(403);
        expect((error as AppError).code).toBe("EDIT_NOT_ALLOWED");
      }
    });
  });

  describe("authorizedRepresentativeReviewItemIdRemap", () => {
    it("rewrites Prisma-id review keys onto stable client_guarantor_id keys", () => {
      expect(
        authorizedRepresentativeReviewItemIdRemap(
          SNAPSHOT,
          [
            SNAPSHOT.parties[0]!,
            {
              ...SNAPSHOT.parties[1]!,
              key: "g-company-abc",
              application_guarantor_id: "g_co",
              client_guarantor_id: "g-company-abc",
            },
          ],
          [
            {
              id: "g_co",
              client_guarantor_id: "g-company-abc",
              guarantor_type: "company",
              business_name: "HoldCo Sdn Bhd",
            },
          ]
        )
      ).toEqual([
        {
          from: "authorized_representatives:guarantor:g_co",
          to: "authorized_representatives:guarantor:g-company-abc",
        },
      ]);
    });
  });
});
