import { layoutSignersFromNamedRecipients } from "./layout-detected-signers";

describe("layoutSignersFromNamedRecipients", () => {
  it("marks only the snapshot seal applier", () => {
    expect(
      layoutSignersFromNamedRecipients(
        [
          { name: "Ali Bin Abu", email: "ali@co.my" },
          { name: "Siti Binti Ahmad", email: "siti@co.my" },
        ],
        {
          submitted_by_user_id: "u1",
          submitted_at: "2026-09-11T00:00:00.000Z",
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
                },
                {
                  name: "Siti Binti Ahmad",
                  email: "siti@co.my",
                  ic_number: "900101015555",
                  capacity: "director",
                  applies_company_seal: true,
                },
              ],
            },
          ],
        }
      )
    ).toEqual([
      { name: "Ali Bin Abu", appliesCompanySeal: false },
      { name: "Siti Binti Ahmad", appliesCompanySeal: true },
    ]);
  });
});
