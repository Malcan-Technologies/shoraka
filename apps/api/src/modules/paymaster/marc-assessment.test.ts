jest.mock("../../lib/prisma", () => ({
  prisma: {
    issuerOrganizationMarcAssessment: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    issuerOrganization: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("../../lib/s3/client", () => ({
  generatePresignedUploadUrl: jest.fn(),
  validateDocument: jest.fn(() => ({ valid: true })),
}));

import {
  MARC_CREDIT_SCORE_RANGE_MESSAGE,
  MARC_CREDIT_SCORE_REQUIRED_MESSAGE,
  MARC_PD_REQUIRED_MESSAGE,
  MARC_REPORT_DATE_REQUIRED_MESSAGE,
  MARC_REPORT_REQUIRED_MESSAGE,
} from "@cashsouk/types";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/http/error-handler";
import { createMarcAssessment } from "./service";

function createdRow(overrides: Record<string, unknown> = {}) {
  return {
    credit_grade: "SME-3",
    credit_score: 74,
    probability_of_default: 1.13,
    report_date: new Date("2026-09-19T00:00:00.000Z"),
    report_file_name: "strato.pdf",
    report_s3_key: "marc-reports/org-1/strato.pdf",
    created_at: new Date("2026-09-20T00:00:00.000Z"),
    ...overrides,
  };
}

describe("createMarcAssessment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.issuerOrganizationMarcAssessment.create as jest.Mock).mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) =>
        createdRow({
          credit_grade: data.credit_grade,
          credit_score: data.credit_score,
          probability_of_default: data.probability_of_default,
          report_date: data.report_date,
          report_file_name: data.report_file_name,
          report_s3_key: data.report_s3_key,
        })
    );
  });

  it("persists derived grade from score and leaves PD as entered", async () => {
    const saved = await createMarcAssessment({
      issuerOrganizationId: "org-1",
      actorUserId: "admin",
      creditScore: 74,
      probabilityOfDefault: 3.7,
      reportDate: "2026-09-19T00:00:00.000Z",
      reportS3Key: "marc-reports/org-1/strato.pdf",
      reportFileName: "strato.pdf",
    });

    expect(prisma.issuerOrganizationMarcAssessment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        credit_grade: "SME-3",
        credit_score: 74,
        probability_of_default: 3.7,
      }),
    });
    expect(saved.creditGrade).toBe("SME-3");
    expect(saved.creditScore).toBe(74);
    expect(saved.probabilityOfDefault).toBe(3.7);
  });

  it("derives SME-4 from 65 without changing PD", async () => {
    const saved = await createMarcAssessment({
      issuerOrganizationId: "org-1",
      actorUserId: "admin",
      creditScore: 65,
      probabilityOfDefault: 1.13,
      reportDate: "2026-09-19T00:00:00.000Z",
      reportFileName: "strato.pdf",
      reportS3Key: "marc-reports/org-1/strato.pdf",
    });
    expect(saved.creditGrade).toBe("SME-4");
    expect(saved.probabilityOfDefault).toBe(1.13);
  });

  it("rejects missing and out-of-range score, PD, report, and date", async () => {
    await expect(
      createMarcAssessment({
        issuerOrganizationId: "org-1",
        actorUserId: "admin",
      })
    ).rejects.toMatchObject({
      message: MARC_CREDIT_SCORE_REQUIRED_MESSAGE,
    } satisfies Partial<AppError>);

    await expect(
      createMarcAssessment({
        issuerOrganizationId: "org-1",
        actorUserId: "admin",
        creditScore: 140,
      })
    ).rejects.toMatchObject({ message: MARC_CREDIT_SCORE_RANGE_MESSAGE } satisfies Partial<AppError>);

    await expect(
      createMarcAssessment({
        issuerOrganizationId: "org-1",
        actorUserId: "admin",
        creditScore: 74,
      })
    ).rejects.toMatchObject({ message: MARC_PD_REQUIRED_MESSAGE } satisfies Partial<AppError>);

    await expect(
      createMarcAssessment({
        issuerOrganizationId: "org-1",
        actorUserId: "admin",
        creditScore: 74,
        probabilityOfDefault: 1.13,
      })
    ).rejects.toMatchObject({ message: MARC_REPORT_REQUIRED_MESSAGE } satisfies Partial<AppError>);

    await expect(
      createMarcAssessment({
        issuerOrganizationId: "org-1",
        actorUserId: "admin",
        creditScore: 74,
        probabilityOfDefault: 1.13,
        reportFileName: "strato.pdf",
      })
    ).rejects.toMatchObject({
      message: MARC_REPORT_DATE_REQUIRED_MESSAGE,
    } satisfies Partial<AppError>);
  });
});
