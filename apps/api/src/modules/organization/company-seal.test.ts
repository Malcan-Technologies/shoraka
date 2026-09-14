jest.mock("../../lib/prisma", () => ({
  prisma: {
    issuerOrganizationCompanySeal: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const getOrganization = jest.fn();
jest.mock("./service", () => ({
  OrganizationService: jest.fn().mockImplementation(() => ({
    getOrganization,
  })),
}));

jest.mock("../../lib/s3/client", () => ({
  generatePresignedUploadUrl: jest.fn(),
  generatePresignedViewUrl: jest.fn(),
}));

jest.mock("../../lib/signingcloud/legal-image", () => ({
  confirmSigningCloudLegalImageFromS3: jest.fn(),
}));

import { Prisma } from "@prisma/client";
import { issuerCompanySealS3Prefix } from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { prisma } from "../../lib/prisma";
import { generatePresignedUploadUrl, generatePresignedViewUrl } from "../../lib/s3/client";
import { confirmSigningCloudLegalImageFromS3 } from "../../lib/signingcloud/legal-image";
import {
  COMPANY_SEAL_MANAGE_FORBIDDEN_MESSAGE,
  confirmIssuerCompanySeal,
  getIssuerCompanySeal,
  getIssuerCompanySealPreview,
  removeIssuerCompanySeal,
  requireIssuerCompanySealS3Key,
  requestIssuerCompanySealUploadUrl,
} from "./company-seal";

const USER = "ABCDE";
const ORG = "org_1";

const ownerOrg = {
  owner_user_id: USER,
  members: [{ user_id: USER, role: "ORGANIZATION_MEMBER" }],
};

const memberOrg = {
  owner_user_id: "owner_1",
  members: [{ user_id: USER, role: "ORGANIZATION_MEMBER" }],
};

const adminOrg = {
  owner_user_id: "owner_1",
  members: [{ user_id: USER, role: "ORGANIZATION_ADMIN" }],
};

const confirmedImage = {
  sha256: "abc",
  byteSize: 120,
  widthPx: 80,
  heightPx: 80,
  contentType: "image/png" as const,
  transparencyMode: "OPAQUE" as const,
};

function sealRow(id: string, supersededAt: Date | null = null) {
  return {
    id,
    s3_key: `${issuerCompanySealS3Prefix(ORG)}v1-2026-09-11-${id}.png`,
    original_file_name: "seal.png",
    content_type: "image/png",
    byte_size: 120,
    sha256: "abc",
    width_px: 80,
    height_px: 80,
    transparency_mode: "OPAQUE",
    created_at: new Date("2026-09-11T00:00:00.000Z"),
    superseded_at: supersededAt,
  };
}

describe("requireIssuerCompanySealS3Key", () => {
  it("rejects a key from another organization", () => {
    const foreignKey = `${issuerCompanySealS3Prefix("org_2")}v1-a.png`;
    try {
      requireIssuerCompanySealS3Key(ORG, foreignKey);
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(400);
      expect((error as AppError).message).toMatch(/this organization/i);
    }
  });

  it("accepts a key under this organization's prefix", () => {
    expect(() =>
      requireIssuerCompanySealS3Key(ORG, `${issuerCompanySealS3Prefix(ORG)}v1-a.png`)
    ).not.toThrow();
  });
});

describe("confirmIssuerCompanySeal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getOrganization.mockResolvedValue(ownerOrg);
    (confirmSigningCloudLegalImageFromS3 as jest.Mock).mockResolvedValue(confirmedImage);
  });

  it("rejects a foreign S3 key before reading storage", async () => {
    const foreignKey = `${issuerCompanySealS3Prefix("org_2")}v1-a.png`;
    await expect(
      confirmIssuerCompanySeal(USER, ORG, { s3Key: foreignKey, fileName: "seal.png" })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(confirmSigningCloudLegalImageFromS3).not.toHaveBeenCalled();
  });

  it("supersedes the previous active row and inserts a new active seal", async () => {
    const created = { ...sealRow("new"), superseded_at: null };
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const create = jest.fn().mockResolvedValue(created);
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        issuerOrganizationCompanySeal: { updateMany, create },
      })
    );

    const result = await confirmIssuerCompanySeal(USER, ORG, {
      s3Key: created.s3_key,
      fileName: "seal.png",
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: { issuer_organization_id: ORG, superseded_at: null },
      data: { superseded_at: expect.any(Date) },
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        issuer_organization_id: ORG,
        s3_key: created.s3_key,
        original_file_name: "seal.png",
      }),
    });
    expect(create.mock.calls[0][0].data).not.toHaveProperty("superseded_at");
    expect(result.seal.id).toBe("new");
    expect(result.seal.supersededAt).toBeNull();
    expect(result.seal).not.toHaveProperty("s3Key");
  });
});

describe("requestIssuerCompanySealUploadUrl", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getOrganization.mockResolvedValue(ownerOrg);
    (generatePresignedUploadUrl as jest.Mock).mockResolvedValue({
      uploadUrl: "https://s3.example/upload",
      key: "ignored",
      expiresIn: 900,
    });
  });

  it("presigns a key under this organization's company-seals prefix", async () => {
    await requestIssuerCompanySealUploadUrl(USER, ORG, {
      fileName: "seal.png",
      contentType: "image/png",
      fileSize: 120,
    });
    expect(generatePresignedUploadUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: "image/png",
        key: expect.stringMatching(
          new RegExp(`^${issuerCompanySealS3Prefix(ORG)}v1-\\d{4}-\\d{2}-\\d{2}-[0-9a-f-]+\\.png$`)
        ),
      })
    );
  });
});

describe("getIssuerCompanySeal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lets a member read the active seal without image bytes", async () => {
    getOrganization.mockResolvedValue(memberOrg);
    (prisma.issuerOrganizationCompanySeal.findFirst as jest.Mock).mockResolvedValue(sealRow("seal_1"));
    const result = await getIssuerCompanySeal(USER, ORG);
    expect(result.seal).toMatchObject({
      id: "seal_1",
      fileName: "seal.png",
    });
    expect(result.seal).not.toHaveProperty("s3Key");
    expect(JSON.stringify(result)).not.toMatch(/iVBORw0KGgo/);
  });

  it("returns null when there is no active seal", async () => {
    getOrganization.mockResolvedValue(memberOrg);
    (prisma.issuerOrganizationCompanySeal.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(getIssuerCompanySeal(USER, ORG)).resolves.toEqual({ seal: null });
  });
});

describe("getIssuerCompanySealPreview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getOrganization.mockResolvedValue(memberOrg);
    (generatePresignedViewUrl as jest.Mock).mockResolvedValue({
      viewUrl: "https://s3.example/view",
      expiresIn: 900,
    });
  });

  it("returns an authorized view URL without exposing the S3 key", async () => {
    (prisma.issuerOrganizationCompanySeal.findFirst as jest.Mock).mockResolvedValue(sealRow("seal_1"));
    const result = await getIssuerCompanySealPreview(USER, ORG);
    expect(result).toEqual({ viewUrl: "https://s3.example/view", expiresIn: 900 });
    expect(generatePresignedViewUrl).toHaveBeenCalledWith({
      key: expect.stringContaining(issuerCompanySealS3Prefix(ORG)),
    });
  });

  it("returns a null preview when there is no active seal", async () => {
    (prisma.issuerOrganizationCompanySeal.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(getIssuerCompanySealPreview(USER, ORG)).resolves.toEqual({
      viewUrl: null,
      expiresIn: null,
    });
  });
});

describe("company-seal RBAC", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (generatePresignedUploadUrl as jest.Mock).mockResolvedValue({
      uploadUrl: "https://s3.example/upload",
      key: "ignored",
      expiresIn: 900,
    });
  });

  it("forbids a member from requesting an upload URL", async () => {
    getOrganization.mockResolvedValue(memberOrg);
    await expect(
      requestIssuerCompanySealUploadUrl(USER, ORG, {
        fileName: "seal.png",
        contentType: "image/png",
        fileSize: 120,
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
      message: COMPANY_SEAL_MANAGE_FORBIDDEN_MESSAGE,
    });
    expect(generatePresignedUploadUrl).not.toHaveBeenCalled();
  });

  it("lets an organisation admin request an upload URL", async () => {
    getOrganization.mockResolvedValue(adminOrg);
    await expect(
      requestIssuerCompanySealUploadUrl(USER, ORG, {
        fileName: "seal.png",
        contentType: "image/png",
        fileSize: 120,
      })
    ).resolves.toMatchObject({ uploadUrl: "https://s3.example/upload", expiresIn: 900 });
  });

  it("forbids a member from confirming a seal", async () => {
    getOrganization.mockResolvedValue(memberOrg);
    await expect(
      confirmIssuerCompanySeal(USER, ORG, {
        s3Key: `${issuerCompanySealS3Prefix(ORG)}v1-a.png`,
        fileName: "seal.png",
      })
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
    expect(confirmSigningCloudLegalImageFromS3).not.toHaveBeenCalled();
  });

  it("forbids a member from removing a seal", async () => {
    getOrganization.mockResolvedValue(memberOrg);
    await expect(removeIssuerCompanySeal(USER, ORG)).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
  });
});

describe("removeIssuerCompanySeal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getOrganization.mockResolvedValue(ownerOrg);
  });

  it("supersedes the active seal", async () => {
    (prisma.issuerOrganizationCompanySeal.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    await expect(removeIssuerCompanySeal(USER, ORG)).resolves.toEqual({ seal: null });
    expect(prisma.issuerOrganizationCompanySeal.updateMany).toHaveBeenCalledWith({
      where: { issuer_organization_id: ORG, superseded_at: null },
      data: { superseded_at: expect.any(Date) },
    });
  });

  it("returns 404 when there is no active seal", async () => {
    (prisma.issuerOrganizationCompanySeal.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    await expect(removeIssuerCompanySeal(USER, ORG)).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });
  });

  it("maps foreign-key restrict on remove to a clear conflict", async () => {
    const restrict = new Prisma.PrismaClientKnownRequestError("restrict", {
      code: "P2003",
      clientVersion: "test",
    });
    (prisma.issuerOrganizationCompanySeal.updateMany as jest.Mock).mockRejectedValue(restrict);
    await expect(removeIssuerCompanySeal(USER, ORG)).rejects.toMatchObject({
      code: "COMPANY_SEAL_IN_USE",
      statusCode: 409,
    });
  });
});

describe("Prisma restrict mapping", () => {
  it("maps foreign-key restrict on confirm to a clear conflict", async () => {
    getOrganization.mockResolvedValue(ownerOrg);
    (confirmSigningCloudLegalImageFromS3 as jest.Mock).mockResolvedValue(confirmedImage);
    const restrict = new Prisma.PrismaClientKnownRequestError("restrict", {
      code: "P2003",
      clientVersion: "test",
    });
    (prisma.$transaction as jest.Mock).mockRejectedValue(restrict);
    await expect(
      confirmIssuerCompanySeal(USER, ORG, {
        s3Key: `${issuerCompanySealS3Prefix(ORG)}v1-a.png`,
        fileName: "seal.png",
      })
    ).rejects.toMatchObject({ code: "COMPANY_SEAL_IN_USE", statusCode: 409 });
  });
});
