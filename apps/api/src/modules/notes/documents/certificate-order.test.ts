import { WithdrawalType } from "@prisma/client";
import { sortShorakaCertificates } from "./certificate-order";

function row(
  id: string,
  type: string,
  withdrawalCreated: string,
  orderCreated = withdrawalCreated
) {
  return {
    id,
    created_at: new Date(orderCreated),
    certificate_s3_key: `certs/${id}.pdf`,
    certificate_file_sha256: "hash",
    withdrawalInstruction: {
      withdrawal_type: type,
      created_at: new Date(withdrawalCreated),
    },
  };
}

describe("Shoraka certificate ordering", () => {
  it("orders issuer disbursement before later lifecycle types, then by creation", () => {
    const residualLater = row("residual", WithdrawalType.ISSUER_RESIDUAL_RETURN, "2026-09-01T00:00:00Z");
    const disbursementNew = row("disb-new", WithdrawalType.ISSUER_DISBURSEMENT, "2026-09-03T00:00:00Z");
    const disbursementOld = row("disb-old", WithdrawalType.ISSUER_DISBURSEMENT, "2026-09-02T00:00:00Z");
    const ordered = sortShorakaCertificates([residualLater, disbursementNew, disbursementOld]);
    expect(ordered.map((entry) => entry.id)).toEqual(["disb-old", "disb-new", "residual"]);
  });
});
