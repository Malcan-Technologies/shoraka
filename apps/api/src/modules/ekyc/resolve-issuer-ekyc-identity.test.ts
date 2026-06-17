import { OrganizationType } from "@prisma/client";
import {
  normalizeEkycLegalName,
  normalizeMalaysianIcNumber,
  resolveIssuerEkycIdentityForOrganization,
  resolveIssuerEkycIdentityForUser,
} from "./resolve-issuer-ekyc-identity";

const mockIssuerOrgFindUnique = jest.fn();
const mockIssuerOrgFindMany = jest.fn();
const mockOrganizationMemberFindMany = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    issuerOrganization: {
      findUnique: (...args: unknown[]) => mockIssuerOrgFindUnique(...args),
      findMany: (...args: unknown[]) => mockIssuerOrgFindMany(...args),
    },
    organizationMember: {
      findMany: (...args: unknown[]) => mockOrganizationMemberFindMany(...args),
    },
  },
}));

describe("normalizeMalaysianIcNumber", () => {
  it("accepts a 12-digit IC with separators", () => {
    expect(normalizeMalaysianIcNumber("901212-10-1234")).toBe("901212101234");
  });

  it("rejects invalid lengths", () => {
    expect(normalizeMalaysianIcNumber("90121210123")).toBeNull();
  });
});

describe("normalizeEkycLegalName", () => {
  it("uppercases trimmed names", () => {
    expect(normalizeEkycLegalName(" Ahmad Bin Ali ")).toBe("AHMAD BIN ALI");
  });
});

describe("resolveIssuerEkycIdentityForOrganization", () => {
  const issuerOrganizationId = "org-company-1";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("resolves personal issuer org identity from RegTank org fields", async () => {
    mockIssuerOrgFindUnique.mockResolvedValue({
      id: issuerOrganizationId,
      type: OrganizationType.PERSONAL,
      owner_user_id: "user-1",
      first_name: "Ahmad",
      last_name: "Ali",
      middle_name: null,
      document_number: "901212-10-1234",
      corporate_entities: null,
      members: [{ id: "member-1" }],
    });

    await expect(
      resolveIssuerEkycIdentityForOrganization("user-1", issuerOrganizationId, "signer@example.com")
    ).resolves.toEqual({
      name: "AHMAD ALI",
      icNumber: "901212101234",
    });
  });

  it("throws when the user cannot access the organization", async () => {
    mockIssuerOrgFindUnique.mockResolvedValue({
      id: issuerOrganizationId,
      type: OrganizationType.COMPANY,
      owner_user_id: "other-user",
      first_name: null,
      last_name: null,
      middle_name: null,
      document_number: null,
      corporate_entities: null,
      members: [],
    });

    await expect(
      resolveIssuerEkycIdentityForOrganization("user-1", issuerOrganizationId, "signer@example.com")
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("resolveIssuerEkycIdentityForUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIssuerOrgFindMany.mockResolvedValue([]);
    mockOrganizationMemberFindMany.mockResolvedValue([]);
  });

  it("resolves company issuer identity from corporate_entities by email", async () => {
    mockIssuerOrgFindMany.mockResolvedValue([
      {
        id: "org-company-1",
        type: OrganizationType.COMPANY,
        first_name: null,
        last_name: null,
        middle_name: null,
        document_number: null,
        corporate_entities: {
          directors: [
            {
              personalInfo: {
                email: "Director@Example.com",
                fullName: "Director One",
                governmentIdNumber: "850505-10-5555",
              },
            },
          ],
          shareholders: [],
        },
      },
    ]);

    await expect(resolveIssuerEkycIdentityForUser("user-1", "director@example.com")).resolves.toEqual({
      name: "DIRECTOR ONE",
      icNumber: "850505105555",
    });
  });

  it("throws when no verified identity is on file", async () => {
    mockIssuerOrgFindMany.mockResolvedValue([
      {
        id: "org-company-1",
        type: OrganizationType.COMPANY,
        first_name: null,
        last_name: null,
        middle_name: null,
        document_number: null,
        corporate_entities: { directors: [], shareholders: [] },
      },
    ]);

    await expect(resolveIssuerEkycIdentityForUser("user-1", "missing@example.com")).rejects.toMatchObject({
      code: "EKYC_IDENTITY_NOT_ON_FILE",
    });
  });
});
