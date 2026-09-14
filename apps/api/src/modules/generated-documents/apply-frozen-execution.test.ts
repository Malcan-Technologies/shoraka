import { automaticSignerKeywordPair, type FrozenAutomaticSignerSnapshot } from "@cashsouk/types";
import { createFacilityAgreementFixture } from "../applications/facility-agreement/fa-fixture";
import { createJsgFixture } from "../applications/joint-several-guarantee/jsg-fixture";
import { createDeedOfAssignmentFixture } from "../applications/deed-of-assignment/doa-fixture";
import {
  applyFrozenDoaExecution,
  applyFrozenFaExecution,
  applyFrozenJsgExecution,
} from "./apply-frozen-execution";

function person(
  documentKind: FrozenAutomaticSignerSnapshot["documentKind"],
  roleKey: FrozenAutomaticSignerSnapshot["placements"][number]["roleKey"],
  slotIndex: number,
  officerName: string,
  extras?: Partial<FrozenAutomaticSignerSnapshot>
): FrozenAutomaticSignerSnapshot {
  const signingPersonId = extras?.signingPersonId ?? `sp-${roleKey}-${slotIndex}`;
  const pair = automaticSignerKeywordPair(documentKind, signingPersonId, [{ roleKey }]);
  return {
    documentKind,
    signingPersonId,
    officerName,
    designation: extras?.designation ?? "Chief Executive Officer",
    identityNumber: extras?.identityNumber ?? "850101015555",
    signingEmail: extras?.signingEmail ?? `${roleKey}@cashsouk.com`,
    legalEntityLabel: "CashSouk Sdn Bhd",
    signatureS3Key: "operator-profile/signing-signatures/a.png",
    signatureSha256: "aa".repeat(32),
    signatureWidthPx: 80,
    signatureHeightPx: 40,
    signatureByteSize: 9,
    signKeyword: pair.signKeyword,
    ...(pair.dateKeyword ? { dateKeyword: pair.dateKeyword } : {}),
    placements: [
      {
        roleKey,
        slotIndex,
        keyword: pair.signKeyword,
        status: "PENDING",
      },
    ],
  };
}

describe("apply frozen execution merge", () => {
  it("fills Facility Agreement Investor, Agent, and issuer-witness fields", () => {
    const merge = applyFrozenFaExecution(createFacilityAgreementFixture(), {
      people: [
        person("FA", "FA_INVESTOR", 1, "Frozen Investor 1"),
        person("FA", "FA_INVESTOR", 2, "Frozen Investor 2"),
        person("FA", "FA_AGENT", 1, "Frozen Agent 1"),
        person("FA", "FA_AGENT", 2, "Frozen Agent 2"),
        person("FA", "FA_ISSUER_WITNESS", 1, "Frozen Witness", {
          designation: null,
          identityNumber: "900101015555",
        }),
      ],
      companyStamp: null,
    });
    expect(merge.investor_1_name).toBe("Frozen Investor 1");
    expect(merge.agent_2_name).toBe("Frozen Agent 2");
    expect(merge.issuer_signatories.every((row) => row.witness_name === "Frozen Witness")).toBe(
      true
    );
    expect(merge.issuer_signatories[0]?.witness_nric).toBe("900101015555");
  });

  it("copies the JSG guarantor witness onto merge fields used by execution loops", () => {
    const merge = applyFrozenJsgExecution(createJsgFixture(), {
      people: [
        person("JSG", "JSG_OPERATOR", 1, "Frozen Operator 1", { identityNumber: "111" }),
        person("JSG", "JSG_OPERATOR", 2, "Frozen Operator 2", { identityNumber: "222" }),
        person("JSG", "JSG_GUARANTOR_WITNESS", 1, "Frozen Guarantor Witness", {
          identityNumber: "333",
        }),
      ],
      companyStamp: null,
    });
    expect(merge.operator_1_nric).toBe("111");
    expect(merge.guarantor_witness_name).toBe("Frozen Guarantor Witness");
    expect(merge.guarantor_witness_nric).toBe("333");
  });

  it("fills Deed of Assignment SSP names and repeats the assignor witness", () => {
    const merge = applyFrozenDoaExecution(createDeedOfAssignmentFixture(), {
      people: [
        person("DOA", "DOA_SSP", 1, "Frozen SSP 1"),
        person("DOA", "DOA_SSP", 2, "Frozen SSP 2"),
        person("DOA", "DOA_ASSIGNOR_WITNESS", 1, "Frozen Assignor Witness", {
          designation: "Manager",
        }),
      ],
      companyStamp: null,
    });
    expect(merge.ssp_2_name).toBe("Frozen SSP 2");
    expect(merge.assignor_signatories.every((row) => row.witness_name === "Frozen Assignor Witness")).toBe(
      true
    );
    expect(merge.assignor_signatories[0]?.witness_designation).toBe("Manager");
  });
});
