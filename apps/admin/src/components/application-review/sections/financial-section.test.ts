import fs from "node:fs";
import path from "node:path";
import {
  MARC_ASSESSMENT_REQUIRED_MESSAGE,
  type ApplicationPersonRow,
  type MarcAssessmentSnapshot,
} from "@cashsouk/types";
import { ADMIN_DIRECTOR_SHAREHOLDER_PENDING_LABEL } from "@/lib/admin-director-shareholder-review-message";
import { financialSectionApproveDisabledReason } from "./financial-section-approve-gate";

const completeMarc: MarcAssessmentSnapshot = {
  creditGrade: "SME-3",
  creditScore: 74,
  probabilityOfDefault: 1.13,
  reportDate: "2026-09-19T00:00:00.000Z",
  reportFileName: "strato.pdf",
  reportS3Key: "marc/org/strato.pdf",
  assessedAt: "2026-09-20T00:00:00.000Z",
};

const pendingDirector: ApplicationPersonRow = {
  matchKey: "d1",
  name: "Director",
  roles: ["DIRECTOR"],
  entityType: "INDIVIDUAL",
  sharePercentage: null,
  status: "IN_PROGRESS",
  onboarding: { status: "IN_PROGRESS" },
  screening: { status: "PENDING" },
};

describe("financialSectionApproveDisabledReason", () => {
  it("blocks approve when the issuer has no MARC assessment", () => {
    expect(financialSectionApproveDisabledReason({ marcAssessment: null })).toBe(
      MARC_ASSESSMENT_REQUIRED_MESSAGE
    );
    expect(financialSectionApproveDisabledReason({})).toBe(MARC_ASSESSMENT_REQUIRED_MESSAGE);
  });

  it("blocks approve when MARC is incomplete", () => {
    expect(
      financialSectionApproveDisabledReason({
        marcAssessment: { ...completeMarc, creditScore: null, probabilityOfDefault: null },
      })
    ).toBe(MARC_ASSESSMENT_REQUIRED_MESSAGE);
  });

  it("allows approve when MARC is complete and no director/shareholder is pending", () => {
    expect(financialSectionApproveDisabledReason({ marcAssessment: completeMarc })).toBeUndefined();
  });

  it("prefers the MARC reason over director/shareholder pending", () => {
    expect(
      financialSectionApproveDisabledReason({
        marcAssessment: null,
        people: [pendingDirector],
      })
    ).toBe(MARC_ASSESSMENT_REQUIRED_MESSAGE);
  });

  it("blocks approve for pending director/shareholder when MARC is complete", () => {
    expect(
      financialSectionApproveDisabledReason({
        marcAssessment: completeMarc,
        people: [pendingDirector],
      })
    ).toBe(ADMIN_DIRECTOR_SHAREHOLDER_PENDING_LABEL);
  });
});

describe("Financial section MARC approve wiring", () => {
  it("disables Financial Approve when the issuer MARC assessment is missing", () => {
    const source = fs.readFileSync(path.join(__dirname, "financial-section.tsx"), "utf8");
    expect(source).toContain("financialSectionApproveDisabledReason");
    expect(source).toContain("approveDisabled={Boolean(approveDisabledReason)}");
    expect(source).toContain("approveDisabledReason={approveDisabledReason}");
  });
});
