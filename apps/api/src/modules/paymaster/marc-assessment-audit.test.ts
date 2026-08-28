import {
  buildMarcAssessmentAuditMetadata,
  marcAssessmentAuditValues,
  marcAssessmentUpdatedFields,
} from "./marc-assessment-audit";
import type { MarcAssessmentSnapshot } from "@cashsouk/types";

function snapshot(overrides: Partial<MarcAssessmentSnapshot> = {}): MarcAssessmentSnapshot {
  return {
    creditGrade: "SME-3",
    creditScore: 74,
    probabilityOfDefault: 1.13,
    reportDate: "2026-09-19T00:00:00.000Z",
    reportFileName: "strato.pdf",
    reportS3Key: "marc-reports/org-1/strato.pdf",
    assessedAt: "2026-09-20T00:00:00.000Z",
    ...overrides,
  };
}

describe("marcAssessmentAuditValues", () => {
  it("keeps business fields and drops the S3 key from previous/next", () => {
    expect(marcAssessmentAuditValues(snapshot())).toEqual({
      creditGrade: "SME-3",
      creditScore: 74,
      probabilityOfDefault: 1.13,
      reportFileName: "strato.pdf",
      reportDate: "2026-09-19",
    });
  });

  it("returns null for a first assessment with no previous row", () => {
    expect(marcAssessmentAuditValues(null)).toBeNull();
  });
});

describe("marcAssessmentUpdatedFields", () => {
  it("treats every populated field as new on the first assessment", () => {
    const next = marcAssessmentAuditValues(snapshot());
    expect(next).not.toBeNull();
    expect(marcAssessmentUpdatedFields(null, next!)).toEqual([
      "creditGrade",
      "creditScore",
      "probabilityOfDefault",
      "reportFileName",
      "reportDate",
    ]);
  });

  it("lists only fields that actually changed on a subsequent assessment", () => {
    const previous = marcAssessmentAuditValues(snapshot())!;
    const next = marcAssessmentAuditValues(
      snapshot({
        creditGrade: "SME-4",
        creditScore: 65,
        probabilityOfDefault: 1.13,
        reportFileName: "strato.pdf",
        reportDate: "2026-09-19T00:00:00.000Z",
      })
    )!;
    expect(marcAssessmentUpdatedFields(previous, next)).toEqual(["creditGrade", "creditScore"]);
  });

  it("does not list identical score, PD, report, or date as changed", () => {
    const previous = marcAssessmentAuditValues(snapshot({ creditScore: 74.0 }))!;
    const next = marcAssessmentAuditValues(
      snapshot({ creditScore: 74, probabilityOfDefault: "1.13" as unknown as number })
    )!;
    expect(marcAssessmentUpdatedFields(previous, next)).toEqual([]);
  });
});

describe("buildMarcAssessmentAuditMetadata", () => {
  it("stores previous/next snapshots, actor, org reference, and S3 key as technical metadata", () => {
    const previous = marcAssessmentAuditValues(snapshot())!;
    const next = marcAssessmentAuditValues(
      snapshot({
        creditGrade: "SME-4",
        creditScore: 65,
        reportS3Key: "marc-reports/org-1/next.pdf",
      })
    )!;
    expect(
      buildMarcAssessmentAuditMetadata({
        organizationId: "org-1",
        organizationReference: "ISS-202608-DK3",
        actorUserId: "admin-1",
        previous,
        next,
        reportS3Key: "marc-reports/org-1/next.pdf",
      })
    ).toEqual({
      updatedBy: "admin-1",
      organizationId: "org-1",
      organizationReference: "ISS-202608-DK3",
      updatedFields: ["creditGrade", "creditScore"],
      previousValues: previous,
      nextValues: next,
      reportS3Key: "marc-reports/org-1/next.pdf",
    });
    expect(JSON.stringify(previous)).not.toContain("marc-reports/");
    expect(JSON.stringify(next)).not.toContain("marc-reports/");
  });
});
