import { paymasterUseVerifiedDisabled } from "./paymaster-use-verified";

describe("paymasterUseVerifiedDisabled", () => {
  it("allows Use Verified only while the application and customer section are still open", () => {
    expect(
      paymasterUseVerifiedDisabled({
        isReviewable: true,
        isActionLocked: false,
        sectionStatus: "PENDING",
      })
    ).toBe(false);
    expect(
      paymasterUseVerifiedDisabled({
        isReviewable: true,
        isActionLocked: false,
        sectionStatus: "AMENDMENT_REQUESTED",
      })
    ).toBe(false);
    expect(
      paymasterUseVerifiedDisabled({
        isReviewable: true,
        isActionLocked: false,
        sectionStatus: "APPROVED",
      })
    ).toBe(true);
    expect(
      paymasterUseVerifiedDisabled({
        isReviewable: false,
        isActionLocked: false,
        sectionStatus: "PENDING",
      })
    ).toBe(true);
    expect(
      paymasterUseVerifiedDisabled({
        isReviewable: true,
        isActionLocked: true,
        sectionStatus: "PENDING",
      })
    ).toBe(true);
  });
});
