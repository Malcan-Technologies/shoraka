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
