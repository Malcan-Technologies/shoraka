jest.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
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

jest.mock("../../lib/audit", () => ({
  createOnboardingLogRow: jest.fn(async () => undefined),
}));

import {
  MARC_CREDIT_SCORE_RANGE_MESSAGE,
  MARC_CREDIT_SCORE_REQUIRED_MESSAGE,
  MARC_PD_REQUIRED_MESSAGE,
  MARC_REPORT_DATE_REQUIRED_MESSAGE,
  MARC_REPORT_REQUIRED_MESSAGE,
} from "@cashsouk/types";
import { UserRole } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { createOnboardingLogRow } from "../../lib/audit";
import { AppError } from "../../lib/http/error-handler";
import { generatePresignedUploadUrl } from "../../lib/s3/client";
import { MARC_ASSESSMENT_SAVED } from "./marc-assessment-audit";
import { createMarcAssessment, requestIssuerMarcReportUploadUrl } from "./service";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const createOnboardingLogRowMock = createOnboardingLogRow as jest.MockedFunction<
  typeof createOnboardingLogRow
>;

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

const issuerOrg = {
  id: "org-1",
  owner_user_id: "owner-1",
  name: "ABC Trading",
  display_reference: "ISS-202608-DK3",
};

describe("createMarcAssessment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma)
    );
    (prisma.issuerOrganization.findUnique as jest.Mock).mockResolvedValue(issuerOrg);
    (prisma.issuerOrganizationMarcAssessment.findFirst as jest.Mock).mockResolvedValue(null);
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
      actorUserId: "admin-1",
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
      actorUserId: "admin-1",
      creditScore: 65,
      probabilityOfDefault: 1.13,
      reportDate: "2026-09-19T00:00:00.000Z",
      reportFileName: "strato.pdf",
      reportS3Key: "marc-reports/org-1/strato.pdf",
    });
    expect(saved.creditGrade).toBe("SME-4");
    expect(saved.probabilityOfDefault).toBe(1.13);
  });

  it("writes MARC_ASSESSMENT_SAVED to onboarding_logs on the first assessment", async () => {
    await createMarcAssessment({
      issuerOrganizationId: "org-1",
      actorUserId: "admin-1",
      creditScore: 74,
      probabilityOfDefault: 1.13,
      reportDate: "2026-09-19T00:00:00.000Z",
      reportS3Key: "marc-reports/org-1/strato.pdf",
      reportFileName: "strato.pdf",
      context: {
        actorType: "ADMIN",
        actorUserId: "admin-1",
        source: "API",
        portal: "admin",
        ipAddress: "1.1.1.1",
        userAgent: "Mozilla",
        correlationId: "corr-1",
      },
    });

    expect(prisma.issuerOrganizationMarcAssessment.create).toHaveBeenCalled();
    expect(createOnboardingLogRowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: MARC_ASSESSMENT_SAVED,
        userId: "owner-1",
        actorUserId: "admin-1",
        role: UserRole.ISSUER,
        portal: "issuer",
        issuerOrganizationId: "org-1",
        organizationName: "ABC Trading",
        ipAddress: "1.1.1.1",
        userAgent: "Mozilla",
        correlationId: "corr-1",
        metadata: expect.objectContaining({
          updatedBy: "admin-1",
          organizationId: "org-1",
          organizationReference: "ISS-202608-DK3",
          previousValues: null,
          nextValues: expect.objectContaining({
            creditGrade: "SME-3",
            creditScore: 74,
            probabilityOfDefault: 1.13,
            reportFileName: "strato.pdf",
            reportDate: "2026-09-19",
          }),
          updatedFields: [
            "creditGrade",
            "creditScore",
            "probabilityOfDefault",
            "reportFileName",
            "reportDate",
          ],
          reportS3Key: "marc-reports/org-1/strato.pdf",
        }),
      }),
      prisma
    );
  });

  it("captures the previous latest assessment on a subsequent save", async () => {
    (prisma.issuerOrganizationMarcAssessment.findFirst as jest.Mock).mockResolvedValue(
      createdRow({
        credit_grade: "SME-4",
        credit_score: 65,
        probability_of_default: 2.3,
        report_file_name: "july.pdf",
        report_date: new Date("2026-07-31T00:00:00.000Z"),
      })
    );

    await createMarcAssessment({
      issuerOrganizationId: "org-1",
      actorUserId: "admin-1",
      creditScore: 74,
      probabilityOfDefault: 1.13,
      reportDate: "2026-08-25T00:00:00.000Z",
      reportFileName: "august.pdf",
      reportS3Key: "marc-reports/org-1/august.pdf",
    });

    expect(createOnboardingLogRowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: MARC_ASSESSMENT_SAVED,
        metadata: expect.objectContaining({
          previousValues: expect.objectContaining({
            creditGrade: "SME-4",
            creditScore: 65,
            probabilityOfDefault: 2.3,
            reportFileName: "july.pdf",
            reportDate: "2026-07-31",
          }),
          nextValues: expect.objectContaining({
            creditGrade: "SME-3",
            creditScore: 74,
            probabilityOfDefault: 1.13,
            reportFileName: "august.pdf",
            reportDate: "2026-08-25",
          }),
          updatedFields: [
            "creditGrade",
            "creditScore",
            "probabilityOfDefault",
            "reportFileName",
            "reportDate",
          ],
        }),
      }),
      prisma
    );
  });

  it("does not list unchanged MARC fields as updated", async () => {
    (prisma.issuerOrganizationMarcAssessment.findFirst as jest.Mock).mockResolvedValue(
      createdRow({
        credit_grade: "SME-3",
        credit_score: 74,
        probability_of_default: 1.13,
        report_file_name: "strato.pdf",
        report_date: new Date("2026-09-19T00:00:00.000Z"),
      })
    );

    await createMarcAssessment({
      issuerOrganizationId: "org-1",
      actorUserId: "admin-1",
      creditScore: 74,
      probabilityOfDefault: 3.7,
      reportDate: "2026-09-19T00:00:00.000Z",
      reportFileName: "strato.pdf",
      reportS3Key: "marc-reports/org-1/strato.pdf",
    });

    expect(createOnboardingLogRowMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          updatedFields: ["probabilityOfDefault"],
        }),
      }),
      prisma
    );
  });

  it("does not write a notification when MARC is saved", async () => {
    await createMarcAssessment({
      issuerOrganizationId: "org-1",
      actorUserId: "admin-1",
      creditScore: 74,
      probabilityOfDefault: 1.13,
      reportDate: "2026-09-19T00:00:00.000Z",
      reportFileName: "strato.pdf",
      reportS3Key: "marc-reports/org-1/strato.pdf",
    });
    const serviceSrc = readFileSync(join(__dirname, "service.ts"), "utf8");
    expect(serviceSrc).not.toMatch(/NotificationTypeIds|sendIssuerNotification|notification_logs/);
    expect(createOnboardingLogRowMock).toHaveBeenCalledTimes(1);
  });

  it("does not change prospectus freeze or invoice-offer logic", () => {
    const serviceSrc = readFileSync(join(__dirname, "service.ts"), "utf8");
    expect(serviceSrc).not.toMatch(/PROSPECTUS_REVIEW|prospectus_snapshot|marc_suggested_grade/);
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

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(createOnboardingLogRowMock).not.toHaveBeenCalled();
  });
});

describe("requestIssuerMarcReportUploadUrl", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.issuerOrganization.findUnique as jest.Mock).mockResolvedValue({ id: "org-1" });
    (generatePresignedUploadUrl as jest.Mock).mockResolvedValue({
      uploadUrl: "https://s3.example/upload",
      key: "marc-reports/org-1/strato.pdf",
      expiresIn: 60,
    });
  });

  it("does not write MARC_ASSESSMENT_SAVED when requesting an upload URL", async () => {
    await requestIssuerMarcReportUploadUrl({
      issuerOrganizationId: "org-1",
      fileName: "strato.pdf",
      contentType: "application/pdf",
      fileSize: 1024,
    });
    expect(createOnboardingLogRowMock).not.toHaveBeenCalled();
    expect(prisma.issuerOrganizationMarcAssessment.create).not.toHaveBeenCalled();
  });
});
