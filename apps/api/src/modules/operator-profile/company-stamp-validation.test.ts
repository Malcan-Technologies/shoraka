import { AppError } from "../../lib/http/error-handler";
import type { ConfirmedLegalImage } from "../../lib/legal-images";
import { SIGNINGCLOUD_LEGAL_IMAGE_MAX_BYTES } from "@cashsouk/types";

const confirmSigningCloudLegalImageFromS3 = jest.fn();
jest.mock("../../lib/images/confirm-legal-image", () => ({
  confirmSigningCloudLegalImageFromS3,
}));

const platformFindUnique = jest.fn();
const platformUpsert = jest.fn();

const operatorFindUnique = jest.fn();
const operatorCreate = jest.fn();
jest.mock("../../lib/prisma", () => ({
  prisma: {
    platformFinanceSetting: {
      findUnique: platformFindUnique,
      upsert: platformUpsert,
    },
    operatorProfile: {
      findUnique: operatorFindUnique,
      create: operatorCreate,
    },
  },
}));

import * as serviceModule from "./service";

describe("Operator company stamp validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    platformFindUnique.mockResolvedValue(null);

    operatorFindUnique.mockResolvedValue({
      id: "op_1",
      singleton_key: "cashsouk",
      name: null,
      registration_number: null,
      trustee_registration_number: null,
      sc_company_type: null,
      responsible_person_name: null,
      responsible_person_phone: null,
      share_capital: null,
      shareholders: [],
      officers: [],
      advisors: [],
      interests: [],
      financial_statements: [],
      signing_people: [],
      document_execution_bindings: [],
      updated_at: new Date(),
    });
    operatorCreate.mockResolvedValue({
      id: "op_1",
      singleton_key: "cashsouk",
      name: null,
      registration_number: null,
      trustee_registration_number: null,
      sc_company_type: null,
      responsible_person_name: null,
      responsible_person_phone: null,
      share_capital: null,
      shareholders: [],
      officers: [],
      advisors: [],
      interests: [],
      financial_statements: [],
      signing_people: [],
      document_execution_bindings: [],
      updated_at: new Date(),
    });

    platformUpsert.mockResolvedValue({});
  });

  it("rejects oversized/invalid stamp before saving (confirm is authoritative)", async () => {
    confirmSigningCloudLegalImageFromS3.mockRejectedValue(
      new AppError(400, "VALIDATION_ERROR", "invalid stamp image")
    );

    await expect(
      serviceModule.patchOperatorCompanyStamp({
        s3Key: "platform-finance/document-stamps/certificate/invalid.png",
        fileName: "invalid.png",
        contentType: "image/png",
      })
    ).rejects.toBeInstanceOf(AppError);

    expect(confirmSigningCloudLegalImageFromS3).toHaveBeenCalledWith(
      "platform-finance/document-stamps/certificate/invalid.png"
    );
    expect(platformUpsert).not.toHaveBeenCalled();
  });

  it("accepts a valid stamp and saves the existing certificateCompanyStamp record", async () => {
    const confirmed = {
      sha256: "a".repeat(64),
      byteSize: Math.min(123, SIGNINGCLOUD_LEGAL_IMAGE_MAX_BYTES),
      widthPx: 300,
      heightPx: 300,
      contentType: "image/png" as const,
      transparencyMode: "OPAQUE" as const,
    } satisfies ConfirmedLegalImage;

    confirmSigningCloudLegalImageFromS3.mockResolvedValue(confirmed);

    await serviceModule.patchOperatorCompanyStamp({
      s3Key: "platform-finance/document-stamps/certificate/valid.png",
      fileName: "valid.png",
      contentType: "image/png",
    });

    expect(confirmSigningCloudLegalImageFromS3).toHaveBeenCalledWith(
      "platform-finance/document-stamps/certificate/valid.png"
    );
    expect(platformUpsert).toHaveBeenCalledTimes(1);
  });
});

