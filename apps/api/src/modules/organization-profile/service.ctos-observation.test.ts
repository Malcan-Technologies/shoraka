const parties: Array<Record<string, unknown>> = [];
let partySeq = 1;

const mockIssuerFindUnique = jest.fn();
const mockCtosFindFirst = jest.fn();
const mockPartyCount = jest.fn();
const mockPartyFindMany = jest.fn();
const mockPartyFindFirst = jest.fn();
const mockPartyCreate = jest.fn();
const mockPartyCreateMany = jest.fn();
const mockPartyUpdate = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    issuerOrganization: { findUnique: (...args: unknown[]) => mockIssuerFindUnique(...args) },
    investorOrganization: { findUnique: jest.fn() },
    ctosReport: { findFirst: (...args: unknown[]) => mockCtosFindFirst(...args) },
    organizationPartyProfile: {
      count: (...args: unknown[]) => mockPartyCount(...args),
      findMany: (...args: unknown[]) => mockPartyFindMany(...args),
      findFirst: (...args: unknown[]) => mockPartyFindFirst(...args),
      create: (...args: unknown[]) => mockPartyCreate(...args),
      createMany: (...args: unknown[]) => mockPartyCreateMany(...args),
      update: (...args: unknown[]) => mockPartyUpdate(...args),
    },
    ctosPartySupplement: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "sup-1" }),
      update: jest.fn(),
    },
    issuerOrganizationFinancialStatement: { findUnique: jest.fn() },
  },
}));

import { OrganizationPartyMembershipStatus, OrganizationPartyOrigin, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import {
  adoptObservedParty,
  assertIssuerProfileCompleteForSubmit,
  createUserAddedParty,
  observeExternalCtosParties,
  patchPartyProfile,
  resolvePartyMismatch,
  seedMasterPartiesIfEmpty,
} from "./service";
import { serializeParty } from "./serialize";

function row(partial: Record<string, unknown>) {
  const partyKey = String(partial.party_key ?? "800101011234");
  return {
    id: partial.id ?? `p${partySeq++}`,
    issuer_organization_id: "org-1",
    investor_organization_id: null,
    origin: "CTOS_PARTY",
    membership_status: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
    entity_type: "INDIVIDUAL",
    absent_from_latest_external: false,
    name: "A",
    salutation: null,
    identity_prefix: "NRIC",
    identity_number: partyKey,
    date_of_birth: null,
    date_of_incorporation: null,
    gender: null,
    nationality: null,
    country_of_incorporation: null,
    address: null,
    is_director: false,
    is_shareholder: true,
    is_board: false,
    is_management: false,
    share_type: null,
    share_type_other: null,
    shareholding_units: null,
    shareholding_amount: null,
    shareholding_percentage: new Prisma.Decimal("36"),
    designation: null,
    designation_other: null,
    appointment_date: null,
    resignation_date: null,
    field_sources: {},
    external_observation: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...partial,
    party_key: partyKey,
    identity_number: partial.identity_number ?? partyKey,
  };
}

describe("CTOS master party observation", () => {
  beforeEach(() => {
    parties.length = 0;
    partySeq = 1;
    jest.clearAllMocks();
    mockIssuerFindUnique.mockResolvedValue({
      id: "org-1",
      corporate_entities: null,
      name: "Acme",
      registration_number: "1234567A",
      party_profiles: parties,
      corporate_onboarding_data: null,
      company_category: null,
      date_of_incorporation: null,
      date_of_commencement: null,
      country_of_incorporation: null,
      sc_company_type: null,
      phone_number: null,
      company_email: null,
    });
    mockCtosFindFirst.mockResolvedValue(null);
    mockPartyCount.mockImplementation(async () =>
      parties.filter((p) => p.membership_status === "MASTER_ACTIVE").length
    );
    mockPartyFindMany.mockImplementation(async () => [...parties]);
    mockPartyFindFirst.mockImplementation(async ({ where }: { where: { id?: string } }) =>
      parties.find((p) => p.id === where.id) ?? null
    );
    mockPartyCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      const created = row({
        ...data,
        id: `p${partySeq++}`,
        membership_status: data.membership_status,
      });
      parties.push(created);
      return created;
    });
    mockPartyCreateMany.mockImplementation(async ({ data }: { data: Array<Record<string, unknown>> }) => {
      for (const item of data) parties.push(row(item));
      return { count: data.length };
    });
    mockPartyUpdate.mockImplementation(async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const idx = parties.findIndex((p) => p.id === where.id);
      parties[idx] = { ...parties[idx], ...data, updated_at: new Date() };
      return parties[idx];
    });
  });

  it("does not create duplicate MASTER_ACTIVE rows on repeated seed", async () => {
    parties.push(row({ party_key: "800101011234" }));
    await seedMasterPartiesIfEmpty("issuer", "org-1");
    await seedMasterPartiesIfEmpty("issuer", "org-1");
    expect(mockPartyCreateMany).not.toHaveBeenCalled();
    expect(parties.filter((p) => p.party_key === "800101011234")).toHaveLength(1);
  });

  it("A: same CTOS percentage leaves master unchanged and does not create a mismatch", async () => {
    parties.push(
      row({
        id: "p-a",
        party_key: "800101011234",
        name: "A",
        shareholding_percentage: new Prisma.Decimal("36"),
      })
    );
    await observeExternalCtosParties("issuer", "org-1", {
      shareholders: [{ party_type: "I", nic_brno: "800101011234", name: "A", equity_percentage: 36 }],
    });
    const master = parties.find((p) => p.id === "p-a");
    expect(Number(master?.shareholding_percentage)).toBe(36);
    const dto = serializeParty(master as never);
    expect(dto.mismatches.find((m) => m.field === "shareholdingPercentage")).toBeUndefined();
  });

  it("B: changed CTOS percentage leaves master 36 and exposes 38 to Admin", async () => {
    parties.push(
      row({
        id: "p-a",
        party_key: "800101011234",
        name: "A",
        shareholding_percentage: new Prisma.Decimal("36"),
      })
    );
    await observeExternalCtosParties("issuer", "org-1", {
      shareholders: [{ party_type: "I", nic_brno: "800101011234", name: "A", equity_percentage: 38 }],
    });
    const master = parties.find((p) => p.id === "p-a");
    expect(Number(master?.shareholding_percentage)).toBe(36);
    const dto = serializeParty(master as never);
    expect(dto.mismatches.find((m) => m.field === "shareholdingPercentage")?.externalValue).toBe(38);
  });

  it("G: a new CTOS director is EXTERNAL_OBSERVED and does not rewrite existing master parties", async () => {
    parties.push(
      row({
        id: "p-a",
        party_key: "800101011234",
        name: "A",
        is_director: true,
        is_shareholder: false,
      })
    );
    await observeExternalCtosParties("issuer", "org-1", {
      directors: [
        { party_type: "I", nic_brno: "800101011234", name: "A", position: "DO" },
        { party_type: "I", nic_brno: "990101011111", name: "C", position: "DO" },
      ],
    });
    const c = parties.find((p) => p.party_key === "990101011111");
    expect(c?.membership_status).toBe("EXTERNAL_OBSERVED");
    expect(c?.is_director).toBe(true);
    expect(parties.find((p) => p.id === "p-a")?.membership_status).toBe("MASTER_ACTIVE");
  });

  it("C: a new CTOS shareholder is EXTERNAL_OBSERVED, not auto-adopted", async () => {
    parties.push(row({ id: "p-a", party_key: "800101011234", name: "A" }));
    await observeExternalCtosParties("issuer", "org-1", {
      shareholders: [
        { party_type: "I", nic_brno: "800101011234", name: "A", equity_percentage: 36 },
        { party_type: "I", nic_brno: "900101011111", name: "B", equity_percentage: 10 },
      ],
    });
    const b = parties.find((p) => p.party_key === "900101011111");
    expect(b?.membership_status).toBe("EXTERNAL_OBSERVED");
    expect(parties.find((p) => p.party_key === "800101011234")?.membership_status).toBe(
      "MASTER_ACTIVE"
    );
  });

  it("C: Admin adopt moves B onto the master list", async () => {
    parties.push(
      row({
        id: "p-b",
        party_key: "900101011111",
        name: "B",
        membership_status: OrganizationPartyMembershipStatus.EXTERNAL_OBSERVED,
      })
    );
    const adopted = await adoptObservedParty({
      portal: "issuer",
      organizationId: "org-1",
      partyId: "p-b",
    });
    expect(adopted.membershipStatus).toBe("MASTER_ACTIVE");
  });

  it("D: a party missing from latest CTOS stays MASTER_ACTIVE and is marked absent", async () => {
    parties.push(
      row({ id: "p-a", party_key: "800101011234", name: "A" }),
      row({ id: "p-b", party_key: "900101011111", name: "B" })
    );
    await observeExternalCtosParties("issuer", "org-1", {
      shareholders: [{ party_type: "I", nic_brno: "800101011234", name: "A", equity_percentage: 36 }],
    });
    const b = parties.find((p) => p.id === "p-b");
    expect(b?.membership_status).toBe("MASTER_ACTIVE");
    expect(b?.absent_from_latest_external).toBe(true);
    expect(parties.find((p) => p.id === "p-a")?.absent_from_latest_external).toBe(false);
  });

  it("B: Use CTOS writes the observed percentage onto master", async () => {
    parties.push(
      row({
        id: "p-a",
        party_key: "800101011234",
        shareholding_percentage: new Prisma.Decimal("36"),
        external_observation: { shareholdingPercentage: 38 },
      })
    );
    const updated = await resolvePartyMismatch({
      portal: "issuer",
      organizationId: "org-1",
      partyId: "p-a",
      input: { action: "USE_EXTERNAL", field: "shareholdingPercentage" },
    });
    expect(Number(updated.shareholdingPercentage)).toBe(38);
    expect(updated.mismatches.find((m) => m.field === "shareholdingPercentage")).toBeUndefined();
  });

  it("B: Keep current leaves master 36% and clears the mismatch", async () => {
    parties.push(
      row({
        id: "p-a",
        party_key: "800101011234",
        shareholding_percentage: new Prisma.Decimal("36"),
        external_observation: { shareholdingPercentage: 38 },
      })
    );
    const updated = await resolvePartyMismatch({
      portal: "issuer",
      organizationId: "org-1",
      partyId: "p-a",
      input: { action: "KEEP", field: "shareholdingPercentage" },
    });
    expect(Number(updated.shareholdingPercentage)).toBe(36);
    expect(updated.mismatches.find((m) => m.field === "shareholdingPercentage")).toBeUndefined();
  });

  it("rejects a user PATCH that overwrites a filled shareholding percentage", async () => {
    parties.push(
      row({
        id: "p-a",
        party_key: "800101011234",
        shareholding_percentage: new Prisma.Decimal("36"),
      })
    );
    await expect(
      patchPartyProfile({
        portal: "issuer",
        organizationId: "org-1",
        partyId: "p-a",
        source: "USER",
        fillEmptyOnly: true,
        patch: { shareholdingPercentage: "50" },
      })
    ).rejects.toMatchObject({ statusCode: 403, code: "FIELD_NOT_EDITABLE" });
  });

  it("rejects a user PATCH that changes shareholder/board membership flags", async () => {
    parties.push(
      row({
        id: "p-a",
        party_key: "800101011234",
        is_shareholder: true,
        is_board: false,
      })
    );
    await expect(
      patchPartyProfile({
        portal: "issuer",
        organizationId: "org-1",
        partyId: "p-a",
        source: "USER",
        fillEmptyOnly: true,
        patch: { isShareholder: false },
      })
    ).rejects.toMatchObject({ statusCode: 403, code: "FIELD_NOT_EDITABLE" });
    await expect(
      patchPartyProfile({
        portal: "issuer",
        organizationId: "org-1",
        partyId: "p-a",
        source: "USER",
        fillEmptyOnly: true,
        patch: { personKind: "BOARD" },
      })
    ).rejects.toMatchObject({ statusCode: 403, code: "FIELD_NOT_EDITABLE" });
  });

  it("throws PROFILE_INCOMPLETE when required issuer master fields are missing", async () => {
    await expect(assertIssuerProfileCompleteForSubmit("org-1")).rejects.toMatchObject({
      statusCode: 400,
      code: "PROFILE_INCOMPLETE",
    });
  });

  it("E: hyphenated CTOS NRIC matches a user-added MASTER_ACTIVE row", async () => {
    parties.push(
      row({
        id: "p-sarah",
        party_key: "900101101234",
        identity_number: "900101101234",
        name: "Sarah Tan",
        origin: OrganizationPartyOrigin.USER_ADDED,
        is_director: true,
        is_shareholder: false,
      })
    );
    await observeExternalCtosParties("issuer", "org-1", {
      directors: [
        {
          party_type: "I",
          nic_brno: "900101-10-1234",
          name: "SARAH TAN",
          position: "DO",
        },
      ],
    });
    const sarahRows = parties.filter(
      (p) => p.identity_number === "900101101234" || p.party_key === "900101101234"
    );
    expect(sarahRows).toHaveLength(1);
    expect(sarahRows[0]?.membership_status).toBe("MASTER_ACTIVE");
    expect(sarahRows[0]?.origin).toBe("USER_ADDED");
    expect(sarahRows[0]?.external_observation).toMatchObject({ identityNumber: "900101-10-1234" });
  });

  it("H: a user-added director missing from CTOS stays MASTER_ACTIVE", async () => {
    parties.push(
      row({
        id: "p-sarah",
        party_key: "900101101234",
        identity_number: "900101101234",
        name: "Sarah",
        origin: OrganizationPartyOrigin.USER_ADDED,
        is_director: true,
        is_shareholder: false,
      })
    );
    await observeExternalCtosParties("issuer", "org-1", {
      directors: [
        { party_type: "I", nic_brno: "800101011234", name: "A", position: "DO" },
      ],
    });
    const sarah = parties.find((p) => p.id === "p-sarah");
    expect(sarah?.membership_status).toBe("MASTER_ACTIVE");
    expect(sarah?.absent_from_latest_external).toBe(true);
  });

  it("I: a management-only person is not flagged absent-from-CTOS", async () => {
    parties.push(
      row({
        id: "p-cfo",
        party_key: "user:cfo",
        identity_number: "770101011111",
        name: "John CFO",
        origin: OrganizationPartyOrigin.USER_ADDED,
        is_director: false,
        is_shareholder: false,
        is_management: true,
      })
    );
    await observeExternalCtosParties("issuer", "org-1", {
      directors: [
        { party_type: "I", nic_brno: "800101011234", name: "A", position: "DO" },
      ],
    });
    const cfo = parties.find((p) => p.id === "p-cfo");
    expect(cfo?.membership_status).toBe("MASTER_ACTIVE");
    expect(cfo?.absent_from_latest_external).toBe(false);
  });

  it("does not delete a user-added director when latest CTOS lists no parties", async () => {
    parties.push(
      row({
        id: "p-sarah",
        party_key: "900101101234",
        identity_number: "900101101234",
        origin: OrganizationPartyOrigin.USER_ADDED,
        is_director: true,
        is_shareholder: false,
      })
    );
    await observeExternalCtosParties("issuer", "org-1", { directors: [], shareholders: [] });
    const sarah = parties.find((p) => p.id === "p-sarah");
    expect(sarah?.membership_status).toBe("MASTER_ACTIVE");
    expect(sarah?.absent_from_latest_external).toBe(true);
  });

  it("does not skip initial CTOS seed just because a management-only person exists", async () => {
    parties.push(
      row({
        id: "p-cfo",
        party_key: "user:cfo",
        name: "CFO",
        origin: OrganizationPartyOrigin.USER_ADDED,
        is_director: false,
        is_shareholder: false,
        is_management: true,
        membership_status: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
      })
    );
    mockCtosFindFirst.mockResolvedValue({
      company_json: {
        directors: [
          { party_type: "I", nic_brno: "800101011234", name: "A", position: "DO" },
        ],
      },
    });
    await seedMasterPartiesIfEmpty("issuer", "org-1");
    expect(parties.some((p) => p.party_key === "800101011234")).toBe(true);
    expect(parties.find((p) => p.id === "p-cfo")?.membership_status).toBe("MASTER_ACTIVE");
  });
});

describe("user-added master parties", () => {
  beforeEach(() => {
    parties.length = 0;
    partySeq = 1;
    jest.clearAllMocks();
    mockIssuerFindUnique.mockResolvedValue({
      id: "org-1",
      corporate_entities: null,
      name: "Acme",
      registration_number: "1234567A",
      party_profiles: parties,
      corporate_onboarding_data: null,
      company_category: null,
      date_of_incorporation: null,
      date_of_commencement: null,
      country_of_incorporation: null,
      sc_company_type: null,
      phone_number: null,
      company_email: null,
    });
    mockCtosFindFirst.mockResolvedValue(null);
    mockPartyCount.mockImplementation(async () =>
      parties.filter((p) => p.membership_status === "MASTER_ACTIVE").length
    );
    mockPartyFindMany.mockImplementation(async () => [...parties]);
    mockPartyFindFirst.mockImplementation(async ({ where }: { where: { id?: string } }) =>
      parties.find((p) => p.id === where.id) ?? null
    );
    mockPartyCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
      const created = row({
        ...data,
        id: `p${partySeq++}`,
        membership_status: data.membership_status,
      });
      parties.push(created);
      return created;
    });
    mockPartyCreateMany.mockImplementation(async ({ data }: { data: Array<Record<string, unknown>> }) => {
      for (const item of data) parties.push(row(item));
      return { count: data.length };
    });
    mockPartyUpdate.mockImplementation(async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Record<string, unknown>;
    }) => {
      const idx = parties.findIndex((p) => p.id === where.id);
      parties[idx] = { ...parties[idx], ...data, updated_at: new Date() };
      return parties[idx];
    });
  });

  it("A: manual director+board is MASTER_ACTIVE USER_ADDED", async () => {
    const created = await createUserAddedParty({
      portal: "issuer",
      organizationId: "org-1",
      source: "USER",
      patch: {
        name: "Sarah Tan",
        identityNumber: "900101101234",
        identityPrefix: "NRIC",
        isDirector: true,
        isBoard: true,
        email: "sarah@example.com",
      },
    });
    expect(created.membershipStatus).toBe("MASTER_ACTIVE");
    expect(created.origin).toBe("USER_ADDED");
    expect(created.isDirector).toBe(true);
    expect(created.isBoard).toBe(true);
    expect(created.partyKey).toBe("900101101234");
    expect(prisma.ctosPartySupplement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          party_key: "900101101234",
          issuer_organization_id: "org-1",
        }),
      })
    );
  });

  it("creates a corporate shareholder as MASTER_ACTIVE USER_ADDED", async () => {
    const created = await createUserAddedParty({
      portal: "issuer",
      organizationId: "org-1",
      source: "USER",
      patch: {
        entityType: "CORPORATE",
        name: "HoldCo Sdn Bhd",
        identityNumber: "1234567-A",
        identityPrefix: "ROC",
        isShareholder: true,
        shareholdingPercentage: "20",
        shareType: "ORDINARY",
        dateOfIncorporation: "2018-04-01",
        countryOfIncorporation: "MY",
      },
    });
    expect(created.membershipStatus).toBe("MASTER_ACTIVE");
    expect(created.origin).toBe("USER_ADDED");
    expect(created.entityType).toBe("CORPORATE");
    expect(created.isShareholder).toBe(true);
    expect(created.isDirector).toBe(false);
    expect(created.partyKey).toBe("1234567A");
  });

  it("B: manual shareholder under 5% is still on the regulatory master", async () => {
    const created = await createUserAddedParty({
      portal: "issuer",
      organizationId: "org-1",
      source: "USER",
      patch: {
        name: "John Lee",
        identityNumber: "880101011111",
        isShareholder: true,
        shareholdingPercentage: "2",
        shareType: "ORDINARY",
      },
    });
    expect(created.membershipStatus).toBe("MASTER_ACTIVE");
    expect(created.isShareholder).toBe(true);
    expect(created.shareholdingPercentage).toBe("2");
  });

  it("C: director + shareholder is one row", async () => {
    const created = await createUserAddedParty({
      portal: "issuer",
      organizationId: "org-1",
      source: "USER",
      patch: {
        name: "Both",
        identityNumber: "860101011111",
        isDirector: true,
        isShareholder: true,
        shareholdingPercentage: "20",
      },
    });
    expect(created.isDirector).toBe(true);
    expect(created.isShareholder).toBe(true);
    expect(parties.filter((p) => p.party_key === "860101011111")).toHaveLength(1);
  });

  it("D: management-only is MASTER_ACTIVE USER_ADDED", async () => {
    const created = await createUserAddedParty({
      portal: "issuer",
      organizationId: "org-1",
      source: "USER",
      patch: {
        name: "CFO John",
        identityNumber: "770101011111",
        isManagement: true,
        designation: "CHIEF_FINANCIAL_OFFICER",
      },
    });
    expect(created.origin).toBe("USER_ADDED");
    expect(created.isManagement).toBe(true);
    expect(created.isDirector).toBe(false);
  });

  it("J: adding a shareholder role updates the same director row", async () => {
    await createUserAddedParty({
      portal: "issuer",
      organizationId: "org-1",
      source: "USER",
      patch: {
        name: "Sarah Tan",
        identityNumber: "900101-10-1234",
        isDirector: true,
      },
    });
    const updated = await createUserAddedParty({
      portal: "issuer",
      organizationId: "org-1",
      source: "USER",
      patch: {
        name: "Sarah Tan",
        identityNumber: "900101101234",
        isShareholder: true,
        shareholdingPercentage: "20",
      },
    });
    expect(parties.filter((p) => canonicalKey(p.party_key) === "900101101234" || p.party_key === "900101101234")).toHaveLength(1);
    expect(updated.isDirector).toBe(true);
    expect(updated.isShareholder).toBe(true);
    expect(updated.shareholdingPercentage).toBe("20");
  });

  it("K: repeating the same identity does not create a duplicate", async () => {
    await createUserAddedParty({
      portal: "issuer",
      organizationId: "org-1",
      source: "USER",
      patch: { name: "Sarah", identityNumber: "900101101234", isDirector: true },
    });
    await createUserAddedParty({
      portal: "issuer",
      organizationId: "org-1",
      source: "USER",
      patch: { name: "Sarah", identityNumber: "900101-10-1234", isDirector: true },
    });
    expect(parties.filter((p) => String(p.party_key).includes("900101101234") || p.party_key === "900101101234")).toHaveLength(1);
  });

  it("F then Use CTOS: master 20 stays until Admin adopts 25", async () => {
    parties.push(
      row({
        id: "p-john",
        party_key: "880101011111",
        identity_number: "880101011111",
        origin: OrganizationPartyOrigin.USER_ADDED,
        is_shareholder: true,
        shareholding_percentage: new Prisma.Decimal("20"),
      })
    );
    await observeExternalCtosParties("issuer", "org-1", {
      shareholders: [
        { party_type: "I", nic_brno: "880101011111", name: "John", equity_percentage: 25 },
      ],
    });
    const master = parties.find((p) => p.id === "p-john");
    expect(Number(master?.shareholding_percentage)).toBe(20);
    const { serializeParty } = await import("./serialize");
    const dto = serializeParty(master as never);
    expect(dto.mismatches.find((m) => m.field === "shareholdingPercentage")?.externalValue).toBe(25);
    const updated = await resolvePartyMismatch({
      portal: "issuer",
      organizationId: "org-1",
      partyId: "p-john",
      input: { action: "USE_EXTERNAL", field: "shareholdingPercentage" },
    });
    expect(Number(updated.shareholdingPercentage)).toBe(25);
  });
});

function canonicalKey(value: unknown): string {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
