import type { ApplicationPersonRow } from "@cashsouk/types";
import {
  ADMIN_DIRECTOR_SHAREHOLDER_PENDING_LABEL,
  formatDirectorShareholderReviewHint,
} from "./admin-director-shareholder-review-message";
import { financialSectionApproveDisabledReason } from "@/components/application-review/sections/financial-section-approve-gate";
import { MARC_ASSESSMENT_REQUIRED_MESSAGE, type MarcAssessmentSnapshot } from "@cashsouk/types";

const completeMarc: MarcAssessmentSnapshot = {
  creditGrade: "SME-3",
  creditScore: 74,
  probabilityOfDefault: 1.13,
  reportDate: "2026-09-19T00:00:00.000Z",
  reportFileName: "strato.pdf",
  reportS3Key: "marc/org/strato.pdf",
  assessedAt: "2026-09-20T00:00:00.000Z",
};

function person(overrides: Partial<ApplicationPersonRow>): ApplicationPersonRow {
  return {
    matchKey: "id",
    name: "Person",
    entityType: "INDIVIDUAL",
    roles: ["DIRECTOR"],
    sharePercentage: null,
    status: "",
    ...overrides,
  };
}

describe("formatDirectorShareholderReviewHint", () => {
  it("lists incomplete onboarding and AML parties", () => {
    const message = formatDirectorShareholderReviewHint([
      person({
        matchKey: "1",
        name: "Jamie Lim",
        onboarding: { status: "IN_PROGRESS" },
        screening: { status: "APPROVED" },
      }),
      person({
        matchKey: "2",
        name: "John Tan",
        onboarding: { status: "APPROVED" },
        screening: { status: "PENDING" },
      }),
    ]);
    expect(message).toContain("2 related parties require attention");
    expect(message).toContain("Jamie Lim — onboarding pending in RegTank");
    expect(message).toContain("John Tan — AML pending");
  });
});

describe("approval button behavior is unchanged", () => {
  it("still disables Approve with the pending label when people are incomplete", () => {
    expect(
      financialSectionApproveDisabledReason({
        marcAssessment: completeMarc,
        people: [
          person({
            onboarding: { status: "IN_PROGRESS" },
            screening: { status: "PENDING" },
          }),
        ],
      })
    ).toBe(ADMIN_DIRECTOR_SHAREHOLDER_PENDING_LABEL);
  });

  it("still prefers MARC over director/shareholder pending", () => {
    expect(
      financialSectionApproveDisabledReason({
        marcAssessment: null,
        people: [
          person({
            onboarding: { status: "IN_PROGRESS" },
            screening: { status: "PENDING" },
          }),
        ],
      })
    ).toBe(MARC_ASSESSMENT_REQUIRED_MESSAGE);
  });
});

describe("company related parties outside initial onboarding", () => {
  const company = (overrides: Partial<ApplicationPersonRow>) =>
    person({
      matchKey: "202001234567",
      name: "Later Co Sdn Bhd",
      entityType: "CORPORATE",
      roles: ["SHAREHOLDER"],
      sharePercentage: 30,
      onboarding: { status: null, id: null },
      screening: null,
      ...overrides,
    });

  it("does not warn about or block on a confirmed non-onboarding company", () => {
    const people = [company({ inInitialOnboarding: false })];
    const message = formatDirectorShareholderReviewHint(people);
    expect(message).not.toContain("require");
    expect(message).not.toContain("onboarding pending in RegTank");
    expect(message).not.toContain("AML pending");
    expect(financialSectionApproveDisabledReason({ marcAssessment: completeMarc, people })).toBeUndefined();
  });

  it("counts only the incomplete individual next to an exempt company", () => {
    const message = formatDirectorShareholderReviewHint([
      company({ inInitialOnboarding: false }),
      person({ matchKey: "2", name: "Jamie Lim", onboarding: { status: "IN_PROGRESS" }, screening: null }),
    ]);
    expect(message).toContain("1 related party requires attention");
    expect(message).toContain("Jamie Lim — onboarding pending in RegTank; AML pending");
    expect(message).not.toContain("Later Co Sdn Bhd");
  });

  it.each([
    ["initial-onboarding", true],
    ["unknown-membership", undefined],
  ])("still warns and blocks for an incomplete %s company", (_label, inInitialOnboarding) => {
    const people = [company({ inInitialOnboarding })];
    expect(formatDirectorShareholderReviewHint(people)).toContain(
      "Later Co Sdn Bhd — onboarding pending in RegTank; AML pending"
    );
    expect(financialSectionApproveDisabledReason({ marcAssessment: completeMarc, people })).toBe(
      ADMIN_DIRECTOR_SHAREHOLDER_PENDING_LABEL
    );
  });
});
