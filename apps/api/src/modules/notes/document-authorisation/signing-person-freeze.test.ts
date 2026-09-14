import { AppError } from "../../../lib/http/error-handler";
import { SHORAKA_SIGNING_PERSON_NO_SIGNATURE_MESSAGE } from "@cashsouk/types";

const mockPrisma: any = {
  operatorSigningPerson: { findMany: jest.fn(), findUnique: jest.fn() },
};

const mockLoadConfig = jest.fn();
const mockFreezeStamp = jest.fn();

jest.mock("../../../lib/prisma", () => ({ prisma: mockPrisma }));
jest.mock("./config", () => ({
  freezeStamp: (...args: unknown[]) => mockFreezeStamp(...args),
  loadDocumentAuthorisationConfig: (...args: unknown[]) => mockLoadConfig(...args),
}));

import {
  freezeShorakaSigningAuthorisation,
  listShorakaDocumentSigningOptions,
} from "./signing-person-freeze";

function personRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sp-1",
    active: true,
    roles: ["AUTHORISED_SIGNATORY"],
    signature_s3_key: "operator-profile/signing-signatures/john.png",
    signature_file_name: "john.png",
    signature_content_type: "image/png",
    officer: { name: "John Lee" },
    ...overrides,
  };
}

describe("listShorakaDocumentSigningOptions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadConfig.mockResolvedValue({
      certificateCompanyStamp: { s3Key: "platform-finance/document-stamps/certificate/a.png" },
    });
  });

  it("lists active Authorised Signatories and the Profile company stamp", async () => {
    mockPrisma.operatorSigningPerson.findMany.mockResolvedValue([
      personRow(),
      personRow({
        id: "sp-2",
        roles: ["WITNESS"],
        officer: { name: "Sarah Tan" },
        signature_s3_key: "sigs/sarah.png",
      }),
      personRow({
        id: "sp-3",
        roles: ["AUTHORISED_SIGNATORY", "WITNESS"],
        officer: { name: "Ahmad Lee" },
        signature_s3_key: "sigs/ahmad.png",
      }),
    ]);
    const options = await listShorakaDocumentSigningOptions();
    expect(options.people.map((row) => row.id)).toEqual(["sp-1", "sp-3"]);
    expect(options.people[0]?.label).toBe("John Lee — Authorised Signatory");
    expect(options.people[1]?.label).toBe("Ahmad Lee — Authorised Signatory, Witness");
    expect(options.companyStampS3Key).toBe("platform-finance/document-stamps/certificate/a.png");
  });
});

describe("freezeShorakaSigningAuthorisation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadConfig.mockResolvedValue({
      certificateCompanyStamp: {
        s3Key: "platform-finance/document-stamps/certificate/a.png",
        fileName: "stamp.png",
        contentType: "image/png",
      },
    });
    mockFreezeStamp.mockImplementation(async (input: { s3Key: string | null }) =>
      input.s3Key
        ? {
            s3Key: input.s3Key,
            sha256: `hash-${input.s3Key}`,
            contentType: "image/png",
            fileName: input.s3Key.split("/").pop() ?? null,
          }
        : null
    );
  });

  it("freezes the selected person's signature and the Profile company stamp", async () => {
    mockPrisma.operatorSigningPerson.findUnique.mockResolvedValue(personRow());
    const frozen = await freezeShorakaSigningAuthorisation("sp-1");
    expect(frozen.signingPersonId).toBe("sp-1");
    expect(frozen.signingPersonName).toBe("John Lee");
    expect(frozen.authorisedSignatoryName).toBe("John Lee");
    expect(frozen.signature.s3Key).toBe("operator-profile/signing-signatures/john.png");
    expect(frozen.companyStamp?.s3Key).toBe("platform-finance/document-stamps/certificate/a.png");
    expect(frozen.stampSource).toBe("SHARED_CERTIFICATE_STAMP");
  });

  it("blocks generation when the selected person has no signature", async () => {
    mockPrisma.operatorSigningPerson.findUnique.mockResolvedValue(
      personRow({ signature_s3_key: null })
    );
    await expect(freezeShorakaSigningAuthorisation("sp-1")).rejects.toMatchObject({
      statusCode: 409,
      code: "SIGNING_PERSON_SIGNATURE_REQUIRED",
      message: SHORAKA_SIGNING_PERSON_NO_SIGNATURE_MESSAGE,
    });
    expect(mockFreezeStamp).not.toHaveBeenCalled();
  });

  it("does not freeze a Witness-only person", async () => {
    mockPrisma.operatorSigningPerson.findUnique.mockResolvedValue(
      personRow({ roles: ["WITNESS"] })
    );
    await expect(freezeShorakaSigningAuthorisation("sp-1")).rejects.toBeInstanceOf(AppError);
  });
});
