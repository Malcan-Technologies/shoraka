import type { AdminPermission } from "@cashsouk/types";
import {
  canManageReviewSection,
  REVIEW_SECTION_PERMISSION_MAP,
  resolveSectionActionLock,
} from "./resolve-section-action-lock";

describe("REVIEW_SECTION_PERMISSION_MAP", () => {
  it.each(["contract_details", "invoice_details", "acceptance_documents"])(
    "maps merged Offer & acceptance section %s to offer_acceptance.manage",
    (section) => {
      expect(REVIEW_SECTION_PERMISSION_MAP[section]).toBe("applications.offer_acceptance.manage");
    }
  );

  it("keeps Supporting Documents on documents.manage", () => {
    expect(REVIEW_SECTION_PERMISSION_MAP.supporting_documents).toBe("applications.documents.manage");
  });

  it("requires offer_acceptance.manage, not documents.manage or applications.manage", () => {
    const can = (granted: AdminPermission[]) => (permission: AdminPermission) =>
      granted.includes(permission);
    for (const section of ["contract_details", "invoice_details", "acceptance_documents"]) {
      expect(
        canManageReviewSection(
          section,
          can(["applications.documents.manage", "applications.manage"])
        )
      ).toBe(false);
      expect(canManageReviewSection(section, can(["applications.offer_acceptance.manage"]))).toBe(
        true
      );
    }
  });
});

describe("resolveSectionActionLock", () => {
  const base = {
    section: "invoice_details",
    applicationWithdrawn: false,
    isExistingContract: false,
    canManage: true,
    tabUnlocked: true,
    paymasterSwitchingFrozen: false,
    unlockTooltip: "Approve Financial section first",
  };

  it("is unlocked when nothing blocks the section", () => {
    expect(resolveSectionActionLock(base)).toEqual({
      locked: false,
      tooltip: undefined,
      canManage: true,
    });
  });

  it("prefers permission denial over other lock reasons", () => {
    expect(resolveSectionActionLock({ ...base, canManage: false, applicationWithdrawn: true })).toEqual({
      locked: true,
      tooltip: "You do not have permission to perform this action.",
      canManage: false,
    });
  });

  it("locks a withdrawn application", () => {
    expect(resolveSectionActionLock({ ...base, applicationWithdrawn: true }).tooltip).toBe(
      "Application withdrawn"
    );
  });

  it("locks inherited facility and acceptance on existing_contract", () => {
    expect(
      resolveSectionActionLock({
        ...base,
        section: "contract_details",
        isExistingContract: true,
      }).tooltip
    ).toBe("Facility was approved in a prior application");
    expect(
      resolveSectionActionLock({
        ...base,
        section: "acceptance_documents",
        isExistingContract: true,
      }).tooltip
    ).toBe("Acceptance was completed when the linked facility was approved");
  });

  it("does not inherit-lock invoice on existing_contract", () => {
    expect(
      resolveSectionActionLock({
        ...base,
        section: "invoice_details",
        isExistingContract: true,
      }).locked
    ).toBe(false);
  });

  it("locks paymaster changes on contract_details after freeze", () => {
    expect(
      resolveSectionActionLock({
        ...base,
        section: "contract_details",
        paymasterSwitchingFrozen: true,
      }).tooltip
    ).toBe("Paymaster cannot be changed after a commercial offer or signed facility");
  });

  it("uses the prerequisite tooltip when the tab is locked", () => {
    expect(
      resolveSectionActionLock({
        ...base,
        tabUnlocked: false,
      }).tooltip
    ).toBe("Approve Financial section first");
  });
});
