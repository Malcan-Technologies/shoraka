/**
 * Organization scope on acceptance detail and download lookups.
 * A scoped lookup must not return an acceptance that belongs to another organization or portal.
 */
const mockFindFirst = jest.fn();
const mockFindUnique = jest.fn();
const mockPresign = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    legalDocumentAcceptance: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    issuerOrganization: { findMany: jest.fn().mockResolvedValue([]) },
    investorOrganization: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));
jest.mock("../../lib/s3/client", () => ({
  generatePresignedDownloadUrl: (...args: unknown[]) => mockPresign(...args),
}));

import { legalDocumentAcceptanceAdminService } from "./acceptance-admin-service";

const SCOPE = { organizationId: "org-1", audience: "INVESTOR" as const };

const ROW = {
  id: "acc-1",
  legal_document_version_id: "ver-1",
  legal_document_id: "doc-1",
  document_type: null,
  version_number: 1,
  user_id: "user-1",
  organization_id: "org-1",
  organization_name_snapshot: "Org One",
  organization_type_snapshot: "COMPANY",
  audience_role: "INVESTOR",
  status: "ACCEPTED",
  opened_at: null,
  accepted_at: new Date("2026-01-01T00:00:00.000Z"),
  document_hash: "hash",
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  user: null,
  version: {
    id: "ver-1",
    version: 1,
    status: "PUBLISHED",
    file_name: "terms.pdf",
    content_type: "application/pdf",
    file_size: 10,
    file_hash: "hash",
    s3_key: "legal/terms.pdf",
    legal_document: { id: "doc-1", type: "TERMS", title: "Terms" },
  },
};

/** Stands in for the database: only returns the row when every filter matches it. */
function findRow({ where }: { where: Record<string, unknown> }) {
  const matches =
    where.id === ROW.id &&
    (where.organization_id === undefined || where.organization_id === ROW.organization_id) &&
    (where.audience_role === undefined || where.audience_role === ROW.audience_role);
  return Promise.resolve(matches ? ROW : null);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFindFirst.mockImplementation(findRow);
  mockFindUnique.mockImplementation(findRow);
  mockPresign.mockResolvedValue({ downloadUrl: "https://example.test", expiresIn: 60 });
});

describe("scoped acceptance detail", () => {
  it("filters by id, organization and audience", async () => {
    const detail = await legalDocumentAcceptanceAdminService.getAcceptanceById("acc-1", SCOPE);
    expect(detail.id).toBe("acc-1");
    expect(mockFindFirst.mock.calls[0][0].where).toEqual({
      id: "acc-1",
      organization_id: "org-1",
      audience_role: "INVESTOR",
    });
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("returns 404 for an acceptance of another organization", async () => {
    await expect(
      legalDocumentAcceptanceAdminService.getAcceptanceById("acc-1", {
        organizationId: "org-2",
        audience: "INVESTOR",
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("returns 404 for the same organization id under the other portal", async () => {
    await expect(
      legalDocumentAcceptanceAdminService.getAcceptanceById("acc-1", {
        organizationId: "org-1",
        audience: "ISSUER",
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("looks up by id only without a scope (Audit routes)", async () => {
    await legalDocumentAcceptanceAdminService.getAcceptanceById("acc-1");
    expect(mockFindUnique.mock.calls[0][0].where).toEqual({ id: "acc-1" });
    expect(mockFindFirst).not.toHaveBeenCalled();
  });
});

describe("scoped acceptance download", () => {
  it("filters by id, organization and audience", async () => {
    const result = await legalDocumentAcceptanceAdminService.getAcceptedVersionDownloadUrl(
      "acc-1",
      SCOPE
    );
    expect(result.fileName).toBe("terms.pdf");
    expect(mockFindFirst.mock.calls[0][0].where).toEqual({
      id: "acc-1",
      organization_id: "org-1",
      audience_role: "INVESTOR",
    });
  });

  it("returns 404 and signs no URL for an acceptance of another organization", async () => {
    await expect(
      legalDocumentAcceptanceAdminService.getAcceptedVersionDownloadUrl("acc-1", {
        organizationId: "org-2",
        audience: "INVESTOR",
      })
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockPresign).not.toHaveBeenCalled();
  });

  it("looks up by id only without a scope (Audit routes)", async () => {
    await legalDocumentAcceptanceAdminService.getAcceptedVersionDownloadUrl("acc-1");
    expect(mockFindUnique.mock.calls[0][0].where).toEqual({ id: "acc-1" });
    expect(mockFindFirst).not.toHaveBeenCalled();
  });
});
