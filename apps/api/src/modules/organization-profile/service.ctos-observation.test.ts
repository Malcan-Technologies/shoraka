const parties: Array<Record<string, unknown>> = [];
let partySeq = 1;

const mockIssuerFindUnique = jest.fn();
const mockIssuerUpdateMany = jest.fn();
const mockCtosFindFirst = jest.fn();
const mockPartyCount = jest.fn();
const mockPartyFindMany = jest.fn();
const mockPartyFindFirst = jest.fn();
const mockPartyCreate = jest.fn();
const mockPartyCreateMany = jest.fn();
const mockPartyUpdate = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    issuerOrganization: {
      findUnique: (...args: unknown[]) => mockIssuerFindUnique(...args),
      updateMany: (...args: unknown[]) => mockIssuerUpdateMany(...args),
    },
    investorOrganization: {
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
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
  inactivateMasterParty,
  observeExternalCtosParties,
  patchPartyProfile,
  resolvePartyMismatch,
  seedMasterPartiesIfEmpty,
} from "./service";
import { serializeParty } from "./serialize";
import { planRegTankPersonSeed, resolvePersonIdentityConflict } from "./regtank-party-seed";

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
    email: null,
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
    identity_number: Object.prototype.hasOwnProperty.call(partial, "identity_number")
      ? (partial.identity_number as string | null) ?? null
      : partyKey,
  };
}

let issuerOrg: Record<string, unknown>;

function wireIssuerOrg() {
  issuerOrg = {
    id: "org-1",
    regulatory_structure_established_at: null,
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
  };
  mockIssuerFindUnique.mockImplementation(async () => issuerOrg);
  mockIssuerUpdateMany.mockImplementation(
    async ({
      where,
      data,
    }: {
      where?: { regulatory_structure_established_at?: Date | null };
      data: { regulatory_structure_established_at?: Date };
    }) => {
      if (where && where.regulatory_structure_established_at !== null) return { count: 0 };
      if (issuerOrg.regulatory_structure_established_at != null) return { count: 0 };
      issuerOrg.regulatory_structure_established_at =
        data.regulatory_structure_established_at ?? new Date();
      return { count: 1 };
    }
  );
}

const firstEstablishmentCtos = {
  directors: [
    {
      party_type: "I",
      nic_brno: "900101101234",
      name: "SARAH BINTI ALI",
      position: "DO",
      appoint: "01-01-2020",
    },
    { party_type: "I", nic_brno: "850101011111", name: "Ali", position: "DO" },
  ],
  shareholders: [
    { party_type: "I", nic_brno: "880101011111", name: "John", equity_percentage: 20 },
    {
      party_type: "C",
      ic_lcno: "1234567-A",
      name: "ABC Holdings",
      equity_percentage: 40,
    },
  ],
};

function pushManualSarah(overrides: Record<string, unknown> = {}) {
  parties.push(
    row({
      id: "p-sarah",
      party_key: "900101101234",
      identity_number: "900101101234",
      name: "Sarah",
      origin: OrganizationPartyOrigin.USER_ADDED,
      is_director: true,
      is_shareholder: false,
      is_board: true,
      appointment_date: null,
      shareholding_percentage: null,
      ...overrides,
    })
  );
}

describe("CTOS master party observation", () => {
  beforeEach(() => {
    parties.length = 0;
    partySeq = 1;
    jest.clearAllMocks();
    wireIssuerOrg();
    mockCtosFindFirst.mockResolvedValue(null);
    mockPartyCount.mockImplementation(async () =>
      parties.filter((p) => p.membership_status === "MASTER_ACTIVE").length
    );
    mockPartyFindMany.mockImplementation(async () => [...parties]);
    mockPartyFindFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
      parties.find((p) => {
        if (where.party_key != null && p.party_key !== where.party_key) return false;
        if (where.id != null && p.id !== where.id) return false;
        if (
          where.issuer_organization_id != null &&
          p.issuer_organization_id !== where.issuer_organization_id
        ) {
          return false;
        }
        if (
          Object.prototype.hasOwnProperty.call(where, "investor_organization_id") &&
          p.investor_organization_id !== where.investor_organization_id
        ) {
          return false;
        }
        return true;
      }) ?? null
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

  it("does not overwrite completed master name or salutation on later CTOS refresh", async () => {
    parties.push(
      row({
        id: "p-a",
        party_key: "800101011234",
        name: "Aisha Tan",
        salutation: "Puan",
        gender: "FEMALE",
      })
    );
    await observeExternalCtosParties("issuer", "org-1", {
      shareholders: [
        {
          party_type: "I",
          nic_brno: "800101011234",
          name: "A TAN",
          equity_percentage: 36,
        },
      ],
    });
    const master = parties.find((p) => p.id === "p-a");
    expect(master?.name).toBe("Aisha Tan");
    expect(master?.salutation).toBe("Puan");
    expect(master?.gender).toBe("FEMALE");
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

  it("after COMPLETED, same-IC CTOS match does not overwrite master share or add a director role", async () => {
    issuerOrg.regulatory_structure_established_at = new Date("2026-01-01T00:00:00.000Z");
    issuerOrg.onboarding_status = "COMPLETED";
    parties.push(
      row({
        id: "p-ali",
        party_key: "850101011111",
        identity_number: "850101011111",
        name: "Ali",
        is_director: false,
        is_shareholder: true,
        shareholding_percentage: new Prisma.Decimal("20"),
      })
    );
    const laterCtos = {
      directors: [{ party_type: "I", nic_brno: "850101011111", name: "Ali", position: "DO" }],
      shareholders: [{ party_type: "I", nic_brno: "850101011111", name: "Ali", equity_percentage: 30 }],
    };
    mockCtosFindFirst.mockResolvedValue({ company_json: laterCtos });
    await observeExternalCtosParties("issuer", "org-1", laterCtos);
    const master = parties.find((p) => p.id === "p-ali");
    expect(Number(master?.shareholding_percentage)).toBe(20);
    expect(master?.is_director).toBe(false);
    expect(master?.is_shareholder).toBe(true);
    const dto = serializeParty(master as never);
    expect(dto.mismatches.find((m) => m.field === "shareholdingPercentage")?.externalValue).toBe(30);
    expect(dto.mismatches.find((m) => m.field === "isDirector")?.externalValue).toBe(true);
  });

  it("after COMPLETED, same-SSM CTOS match does not overwrite master share", async () => {
    issuerOrg.regulatory_structure_established_at = new Date("2026-01-01T00:00:00.000Z");
    issuerOrg.onboarding_status = "COMPLETED";
    parties.push(
      row({
        id: "p-abc",
        party_key: "202001234567",
        identity_number: "202001234567",
        identity_prefix: "ROC",
        entity_type: "CORPORATE",
        name: "ABC Berhad",
        is_director: false,
        is_shareholder: true,
        shareholding_percentage: new Prisma.Decimal("20"),
      })
    );
    const laterCtos = {
      shareholders: [
        { party_type: "C", ic_lcno: "202001234567", name: "ABC Berhad", equity_percentage: 30 },
      ],
    };
    mockCtosFindFirst.mockResolvedValue({ company_json: laterCtos });
    await observeExternalCtosParties("issuer", "org-1", laterCtos);
    const master = parties.find((p) => p.id === "p-abc");
    expect(Number(master?.shareholding_percentage)).toBe(20);
    const dto = serializeParty(master as never);
    expect(dto.mismatches.find((m) => m.field === "shareholdingPercentage")?.externalValue).toBe(30);
  });

  it("allows an issuer user to update a filled shareholding percentage that still meets 5%", async () => {
    parties.push(
      row({
        id: "p-a",
        party_key: "800101011234",
        is_shareholder: true,
        shareholding_percentage: new Prisma.Decimal("36"),
      })
    );
    const updated = await patchPartyProfile({
      portal: "issuer",
      organizationId: "org-1",
      partyId: "p-a",
      source: "USER",
      fillEmptyOnly: true,
      patch: { shareholdingPercentage: "50" },
    });
    expect(updated.shareholdingPercentage).toBe("50");
  });

  it("rejects a user PATCH that changes a filled identity number", async () => {
    parties.push(
      row({
        id: "p-a",
        party_key: "800101011234",
        identity_number: "800101011234",
      })
    );
    await expect(
      patchPartyProfile({
        portal: "issuer",
        organizationId: "org-1",
        partyId: "p-a",
        source: "USER",
        fillEmptyOnly: true,
        patch: { identityNumber: "800101011999" },
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

  it("does not throw PROFILE_INCOMPLETE while issuer profile completeness is informational", async () => {
    await expect(assertIssuerProfileCompleteForSubmit("org-1")).resolves.toBeUndefined();
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

  it("does not rekey a user:{uuid} director when CTOS later matches identity_number", async () => {
    const generatedKey = "user:550e8400-e29b-41d4-a716-446655440000";
    parties.push(
      row({
        id: "p-preid",
        party_key: generatedKey,
        identity_number: "900101101234",
        name: "Pre Id",
        origin: OrganizationPartyOrigin.USER_ADDED,
        membership_status: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
        is_director: true,
        is_shareholder: false,
      })
    );
    await observeExternalCtosParties("issuer", "org-1", {
      directors: [{ party_type: "I", nic_brno: "900101-10-1234", name: "PRE ID", position: "DO" }],
    });
    const preId = parties.find((p) => p.id === "p-preid");
    expect(preId?.party_key).toBe(generatedKey);
    expect(preId?.identity_number).toBe("900101101234");
    expect(parties.filter((p) => p.party_key === "900101101234")).toHaveLength(0);
  });

  it("after identity seed, later CTOS refresh matches the same user:{uuid} Person and does not create EXTERNAL_OBSERVED", async () => {
    const generatedKey = "user:550e8400-e29b-41d4-a716-446655440000";
    parties.push(
      row({
        id: "p-seeded",
        party_key: generatedKey,
        identity_number: "900101101234",
        name: "Pre Id",
        origin: OrganizationPartyOrigin.USER_ADDED,
        membership_status: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
        is_director: true,
        is_shareholder: false,
      })
    );
    await observeExternalCtosParties("issuer", "org-1", {
      directors: [{ party_type: "I", nic_brno: "900101-10-1234", name: "PRE ID", position: "DO" }],
    });
    expect(parties.find((p) => p.id === "p-seeded")?.party_key).toBe(generatedKey);
    expect(parties.filter((p) => p.membership_status === OrganizationPartyMembershipStatus.EXTERNAL_OBSERVED)).toHaveLength(
      0
    );
    expect(parties.filter((p) => p.party_key === "900101101234")).toHaveLength(0);
  });

  it("never assigns a CTOS NRIC onto a generated user:{uuid} party_key", async () => {
    const generatedKey = "user:550e8400-e29b-41d4-a716-446655440000";
    issuerOrg.regulatory_structure_established_at = new Date();
    parties.push(
      row({
        id: "p-preid-empty",
        party_key: generatedKey,
        identity_number: null,
        name: "Pre Id Empty",
        origin: OrganizationPartyOrigin.USER_ADDED,
        membership_status: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
        is_director: true,
        is_shareholder: false,
      })
    );
    await observeExternalCtosParties("issuer", "org-1", {
      directors: [{ party_type: "I", nic_brno: "900101-10-1234", name: "PRE ID EMPTY", position: "DO" }],
    });
    const preId = parties.find((p) => p.id === "p-preid-empty");
    expect(preId?.party_key).toBe(generatedKey);
    expect(preId?.identity_number).toBeNull();
    const observed = parties.find((p) => p.party_key === "900101101234");
    expect(observed?.membership_status).toBe(OrganizationPartyMembershipStatus.EXTERNAL_OBSERVED);
    const planned = planRegTankPersonSeed({
      current: {
        id: String(preId?.id),
        party_key: generatedKey,
        name: "Pre Id Empty",
        email: null,
        identity_number: null,
        identity_prefix: null,
        gender: null,
        date_of_birth: null,
        nationality: null,
        field_sources: {},
        entity_type: "INDIVIDUAL",
      },
      seed: {
        name: "Pre Id Empty",
        identityNumber: "900101-10-1234",
        identityPrefix: null,
        gender: null,
        dateOfBirth: null,
        nationality: null,
      },
      otherRows: parties.map((p) => ({
        id: String(p.id),
        party_key: String(p.party_key),
        identity_number: (p.identity_number as string | null) ?? null,
        entity_type: String(p.entity_type),
        membership_status: String(p.membership_status),
      })),
    });
    expect(planned.identityCollision?.status).toBe("BLOCKED");
    expect(planned.data.identity_number).toBeUndefined();
  });

  it("blocks Adopt of an EXTERNAL_OBSERVED Person that collides with an onboarding Person", async () => {
    const generatedKey = "user:550e8400-e29b-41d4-a716-446655440000";
    parties.push(
      row({
        id: "p-onb",
        party_key: generatedKey,
        identity_number: null,
        origin: OrganizationPartyOrigin.USER_ADDED,
        membership_status: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
        is_director: true,
        is_shareholder: false,
        external_observation: {
          identityConflict: {
            status: "BLOCKED",
            canonicalIdentity: "900101101234",
            otherPartyId: "p-obs",
            otherPartyKey: "900101101234",
            otherMembershipStatus: "EXTERNAL_OBSERVED",
            source: "REGTANK_QUERY",
            at: "2026-09-10T00:00:00.000Z",
          },
        },
      }),
      row({
        id: "p-obs",
        party_key: "900101101234",
        identity_number: "900101101234",
        membership_status: OrganizationPartyMembershipStatus.EXTERNAL_OBSERVED,
        is_director: true,
        is_shareholder: false,
      })
    );
    await expect(
      adoptObservedParty({ portal: "issuer", organizationId: "org-1", partyId: "p-obs" })
    ).rejects.toMatchObject({ statusCode: 400, code: "IDENTITY_CONFLICT" });
  });

  it("Keep onboarding Person writes identity_number without rekeying user:{uuid}", async () => {
    const generatedKey = "user:550e8400-e29b-41d4-a716-446655440000";
    parties.push(
      row({
        id: "p-onb",
        party_key: generatedKey,
        identity_number: null,
        origin: OrganizationPartyOrigin.USER_ADDED,
        membership_status: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
        is_director: true,
        is_shareholder: false,
        external_observation: {
          identityConflict: {
            status: "BLOCKED",
            canonicalIdentity: "900101101234",
            otherPartyId: "p-obs",
            otherPartyKey: "900101101234",
            otherMembershipStatus: "EXTERNAL_OBSERVED",
            source: "REGTANK_QUERY",
            at: "2026-09-10T00:00:00.000Z",
          },
        },
      })
    );
    const updated = await resolvePersonIdentityConflict({
      portal: "issuer",
      organizationId: "org-1",
      partyId: "p-onb",
      action: "KEEP_ONBOARDING",
    });
    expect(updated.partyKey).toBe(generatedKey);
    expect(updated.identityNumber).toBe("900101101234");
    expect(updated.fieldSources.identityNumber?.source).toBe("REGTANK");
    const observation = parties.find((p) => p.id === "p-onb")?.external_observation as {
      identityConflict?: { status?: string };
    };
    expect(observation?.identityConflict?.status).toBe("RESOLVED_KEEP_ONBOARDING");
    parties.push(
      row({
        id: "p-obs",
        party_key: "900101101234",
        identity_number: "900101101234",
        membership_status: OrganizationPartyMembershipStatus.EXTERNAL_OBSERVED,
        is_director: true,
        is_shareholder: false,
      })
    );
    await expect(
      adoptObservedParty({ portal: "issuer", organizationId: "org-1", partyId: "p-obs" })
    ).rejects.toMatchObject({ statusCode: 400, code: "IDENTITY_CONFLICT" });
  });

  it("Keep CTOS Person inactivates the onboarding Person without merging", async () => {
    const generatedKey = "user:550e8400-e29b-41d4-a716-446655440000";
    parties.push(
      row({
        id: "p-onb",
        party_key: generatedKey,
        identity_number: null,
        origin: OrganizationPartyOrigin.USER_ADDED,
        membership_status: OrganizationPartyMembershipStatus.MASTER_ACTIVE,
        is_director: true,
        is_shareholder: false,
        external_observation: {
          identityConflict: {
            status: "BLOCKED",
            canonicalIdentity: "900101101234",
            otherPartyId: "p-obs",
            otherPartyKey: "900101101234",
            otherMembershipStatus: "EXTERNAL_OBSERVED",
            source: "REGTANK_QUERY",
            at: "2026-09-10T00:00:00.000Z",
          },
        },
      }),
      row({
        id: "p-obs",
        party_key: "900101101234",
        identity_number: "900101101234",
        membership_status: OrganizationPartyMembershipStatus.EXTERNAL_OBSERVED,
        is_director: true,
        is_shareholder: false,
      })
    );
    const updated = await resolvePersonIdentityConflict({
      portal: "issuer",
      organizationId: "org-1",
      partyId: "p-onb",
      action: "KEEP_CTOS",
    });
    expect(updated.membershipStatus).toBe("MASTER_INACTIVE");
    expect(updated.partyKey).toBe(generatedKey);
    expect(updated.identityNumber).toBeNull();
    expect(parties.find((p) => p.id === "p-obs")?.membership_status).toBe(
      OrganizationPartyMembershipStatus.EXTERNAL_OBSERVED
    );
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

  it("does not treat a manually added director as initial CTOS/RegTank establishment", async () => {
    pushManualSarah();
    await seedMasterPartiesIfEmpty("issuer", "org-1");
    expect(issuerOrg.regulatory_structure_established_at).toBeNull();
    expect(mockPartyCreateMany).not.toHaveBeenCalled();
  });

  it("first CTOS establishes remaining people as MASTER_ACTIVE even if Sarah was added manually", async () => {
    pushManualSarah();
    await observeExternalCtosParties("issuer", "org-1", firstEstablishmentCtos);

    const sarahRows = parties.filter((p) => p.party_key === "900101101234" || p.id === "p-sarah");
    expect(sarahRows).toHaveLength(1);
    const sarah = sarahRows[0];
    expect(sarah?.membership_status).toBe("MASTER_ACTIVE");
    expect(sarah?.origin).toBe("USER_ADDED");
    expect(sarah?.name).toBe("Sarah");
    expect(sarah?.appointment_date).toEqual(new Date("2020-01-01T00:00:00.000Z"));
    expect(sarah?.external_observation).toMatchObject({
      name: "SARAH BINTI ALI",
      identityNumber: "900101101234",
    });

    const ali = parties.find((p) => p.party_key === "850101011111");
    expect(ali?.membership_status).toBe("MASTER_ACTIVE");
    expect(ali?.origin).toBe("CTOS_PARTY");
    expect(ali?.name).toBe("Ali");
    expect(ali?.is_director).toBe(true);

    const john = parties.find((p) => p.party_key === "880101011111");
    expect(john?.membership_status).toBe("MASTER_ACTIVE");
    expect(john?.origin).toBe("CTOS_PARTY");
    expect(john?.is_shareholder).toBe(true);

    const abc = parties.find((p) => p.party_key === "1234567A");
    expect(abc?.membership_status).toBe("MASTER_ACTIVE");
    expect(abc?.origin).toBe("CTOS_PARTY");
    expect(abc?.entity_type).toBe("CORPORATE");
    expect(abc?.name).toBe("ABC Holdings");

    expect(issuerOrg.regulatory_structure_established_at).toBeInstanceOf(Date);
  });

  it("after initial establishment a newly discovered CTOS party is EXTERNAL_OBSERVED", async () => {
    pushManualSarah();
    await observeExternalCtosParties("issuer", "org-1", firstEstablishmentCtos);
    await observeExternalCtosParties("issuer", "org-1", {
      ...firstEstablishmentCtos,
      directors: [
        ...firstEstablishmentCtos.directors,
        { party_type: "I", nic_brno: "990101011111", name: "Zara", position: "DO" },
      ],
    });

    const zara = parties.find((p) => p.party_key === "990101011111");
    expect(zara?.membership_status).toBe("EXTERNAL_OBSERVED");
    expect(parties.find((p) => p.party_key === "850101011111")?.membership_status).toBe(
      "MASTER_ACTIVE"
    );
    expect(parties.filter((p) => p.party_key === "900101101234")).toHaveLength(1);
  });

  it("a first CTOS that only matches the manual director still completes establishment", async () => {
    pushManualSarah();
    await observeExternalCtosParties("issuer", "org-1", {
      directors: [
        {
          party_type: "I",
          nic_brno: "900101101234",
          name: "SARAH BINTI ALI",
          position: "DO",
        },
      ],
    });
    expect(issuerOrg.regulatory_structure_established_at).toBeInstanceOf(Date);

    await observeExternalCtosParties("issuer", "org-1", {
      directors: [
        {
          party_type: "I",
          nic_brno: "900101101234",
          name: "SARAH BINTI ALI",
          position: "DO",
        },
        { party_type: "I", nic_brno: "850101011111", name: "Ali", position: "DO" },
      ],
    });
    expect(parties.find((p) => p.party_key === "850101011111")?.membership_status).toBe(
      "EXTERNAL_OBSERVED"
    );
    expect(parties.find((p) => p.id === "p-sarah")?.membership_status).toBe("MASTER_ACTIVE");
  });

  it("stored CTOS seed still establishes unmatched people when a manual director exists", async () => {
    pushManualSarah();
    mockCtosFindFirst.mockResolvedValue({ company_json: firstEstablishmentCtos });
    await seedMasterPartiesIfEmpty("issuer", "org-1");
    expect(parties.find((p) => p.party_key === "850101011111")?.membership_status).toBe(
      "MASTER_ACTIVE"
    );
    expect(parties.find((p) => p.party_key === "880101011111")?.membership_status).toBe(
      "MASTER_ACTIVE"
    );
    expect(parties.find((p) => p.party_key === "1234567A")?.membership_status).toBe(
      "MASTER_ACTIVE"
    );
    expect(parties.filter((p) => p.party_key === "900101101234")).toHaveLength(1);
    expect(issuerOrg.regulatory_structure_established_at).toBeInstanceOf(Date);
  });
});

describe("user-added master parties", () => {
  beforeEach(() => {
    parties.length = 0;
    partySeq = 1;
    jest.clearAllMocks();
    wireIssuerOrg();
    mockCtosFindFirst.mockResolvedValue(null);
    mockPartyCount.mockImplementation(async () =>
      parties.filter((p) => p.membership_status === "MASTER_ACTIVE").length
    );
    mockPartyFindMany.mockImplementation(async () => [...parties]);
    mockPartyFindFirst.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
      parties.find((p) => {
        if (where.party_key != null && p.party_key !== where.party_key) return false;
        if (where.id != null && p.id !== where.id) return false;
        if (
          where.issuer_organization_id != null &&
          p.issuer_organization_id !== where.issuer_organization_id
        ) {
          return false;
        }
        if (
          Object.prototype.hasOwnProperty.call(where, "investor_organization_id") &&
          p.investor_organization_id !== where.investor_organization_id
        ) {
          return false;
        }
        return true;
      }) ?? null
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
    const createdJson = (prisma.ctosPartySupplement.create as jest.Mock).mock.calls[0]?.[0]?.data
      ?.onboarding_json as Record<string, unknown>;
    expect(createdJson.status).toBe("");
    expect(String(createdJson.requestId ?? "")).not.toMatch(/^draft-/i);
    expect(createdJson.email).toBe("sarah@example.com");
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
    expect(created.gender).toBe("NOT_APPLICABLE");
    expect(created.partyKey).toBe("1234567A");
  });

  it("accepts a company issuer shareholder at 5% and 5.0%", async () => {
    const atFive = await createUserAddedParty({
      portal: "issuer",
      organizationId: "org-1",
      source: "USER",
      patch: {
        entityType: "CORPORATE",
        name: "Five Pct Sdn Bhd",
        identityNumber: "1111111-A",
        identityPrefix: "ROC",
        isShareholder: true,
        shareholdingPercentage: "5",
        shareType: "ORDINARY",
      },
    });
    expect(atFive.shareholdingPercentage).toBe("5");
    const atFivePoint = await createUserAddedParty({
      portal: "issuer",
      organizationId: "org-1",
      source: "USER",
      patch: {
        entityType: "CORPORATE",
        name: "Five Point Sdn Bhd",
        identityNumber: "2222222-A",
        identityPrefix: "ROC",
        isShareholder: true,
        shareholdingPercentage: "5.0",
        shareType: "ORDINARY",
      },
    });
    expect(Number(atFivePoint.shareholdingPercentage)).toBe(5);
  });

  it("rejects a blank issuer shareholder percentage", async () => {
    await expect(
      createUserAddedParty({
        portal: "issuer",
        organizationId: "org-1",
        source: "USER",
        patch: {
          name: "John Lee",
          identityNumber: "880101011111",
          identityPrefix: "NRIC",
          isShareholder: true,
          shareholdingPercentage: "",
          shareType: "ORDINARY",
        },
      })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(parties).toHaveLength(0);
  });

  it("creates a director without government ID using a stable user:{uuid} party_key", async () => {
    const created = await createUserAddedParty({
      portal: "issuer",
      organizationId: "org-1",
      source: "USER",
      patch: {
        name: "Pre Id Director",
        email: "preid.director@example.com",
        isDirector: true,
      },
    });
    expect(created.membershipStatus).toBe("MASTER_ACTIVE");
    expect(created.origin).toBe("USER_ADDED");
    expect(created.partyKey.startsWith("user:")).toBe(true);
    expect(created.partyKey).toMatch(/^user:[0-9a-f-]{36}$/i);
    expect(created.identityNumber).toBeNull();
    expect(created.email).toBe("preid.director@example.com");
  });

  it("creates Director + Management without government ID", async () => {
    const created = await createUserAddedParty({
      portal: "issuer",
      organizationId: "org-1",
      source: "USER",
      patch: {
        name: "Director Manager",
        email: "dm@example.com",
        isDirector: true,
        isManagement: true,
      },
    });
    expect(created.partyKey.startsWith("user:")).toBe(true);
    expect(created.identityNumber).toBeNull();
    expect(created.isDirector).toBe(true);
    expect(created.isManagement).toBe(true);
    expect(created.isBoard).toBe(false);
  });

  it("creates Shareholder + Board without government ID", async () => {
    const created = await createUserAddedParty({
      portal: "issuer",
      organizationId: "org-1",
      source: "USER",
      patch: {
        name: "Shareholder Board",
        email: "sb@example.com",
        isShareholder: true,
        isBoard: true,
        shareholdingPercentage: "12",
      },
    });
    expect(created.partyKey.startsWith("user:")).toBe(true);
    expect(created.identityNumber).toBeNull();
    expect(created.isShareholder).toBe(true);
    expect(created.isBoard).toBe(true);
  });

  it("still requires identity for Board-only create", async () => {
    await expect(
      createUserAddedParty({
        portal: "issuer",
        organizationId: "org-1",
        source: "USER",
        patch: {
          name: "Board Only",
          email: "board@example.com",
          isBoard: true,
          designation: "CHIEF_EXECUTIVE_OFFICER",
          appointmentDate: "2026-09-25",
        },
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("creates a >=5% individual shareholder without government ID using user:{uuid}", async () => {
    const created = await createUserAddedParty({
      portal: "issuer",
      organizationId: "org-1",
      source: "USER",
      patch: {
        name: "Pre Id Shareholder",
        email: "preid.share@example.com",
        isShareholder: true,
        shareholdingPercentage: "10",
      },
    });
    expect(created.partyKey.startsWith("user:")).toBe(true);
    expect(created.identityNumber).toBeNull();
    expect(created.isShareholder).toBe(true);
    expect(Number(created.shareholdingPercentage)).toBe(10);
  });

  it("still rejects a <5% individual shareholder without government ID", async () => {
    await expect(
      createUserAddedParty({
        portal: "issuer",
        organizationId: "org-1",
        source: "USER",
        patch: {
          name: "Small Holder",
          email: "small@example.com",
          isShareholder: true,
          shareholdingPercentage: "4",
        },
      })
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(parties).toHaveLength(0);
  });

  it("still uses canonical NRIC party_key when identity is provided", async () => {
    const created = await createUserAddedParty({
      portal: "issuer",
      organizationId: "org-1",
      source: "USER",
      patch: {
        name: "Sarah Tan",
        identityNumber: "900101-10-1234",
        identityPrefix: "NRIC",
        isDirector: true,
        email: "sarah@example.com",
      },
    });
    expect(created.partyKey).toBe("900101101234");
    expect(created.identityNumber).toBe("900101101234");
  });

  it("does not auto-adopt a CTOS-observed person when the same identity is added manually", async () => {
    parties.push(
      row({
        id: "p-obs",
        party_key: "900101101234",
        identity_number: "900101101234",
        name: "Sarah Tan",
        origin: OrganizationPartyOrigin.CTOS_PARTY,
        membership_status: OrganizationPartyMembershipStatus.EXTERNAL_OBSERVED,
        is_director: true,
        is_shareholder: false,
        shareholding_percentage: null,
      })
    );
    await expect(
      createUserAddedParty({
        portal: "issuer",
        organizationId: "org-1",
        source: "USER",
        patch: {
          name: "Sarah Tan",
          identityNumber: "900101-10-1234",
          identityPrefix: "NRIC",
          isDirector: true,
          isShareholder: true,
          shareholdingPercentage: "10",
          shareType: "ORDINARY",
        },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "INVALID_PARTY_STATUS",
      message: "Add this CTOS person to the current profile before editing.",
    });
    expect(parties.filter((p) => canonicalKey(p.party_key) === "900101101234")).toHaveLength(1);
    expect(parties.find((p) => p.id === "p-obs")?.membership_status).toBe(
      OrganizationPartyMembershipStatus.EXTERNAL_OBSERVED
    );
  });

  it("persists salutation, share type other, and resignation date on a user-added person", async () => {
    const created = await createUserAddedParty({
      portal: "issuer",
      organizationId: "org-1",
      source: "USER",
      patch: {
        name: "Sarah Tan",
        salutation: "Ms",
        identityNumber: "900101101234",
        identityPrefix: "NRIC",
        isDirector: true,
        isBoard: true,
        designation: "OTHERS",
        designationOther: "Independent director",
        resignationDate: "2024-06-01",
        isShareholder: true,
        shareType: "ORDINARY",
        shareholdingUnits: "1000",
        shareholdingAmount: "2500",
        shareholdingPercentage: "20",
      },
    });
    expect(created.salutation).toBe("Ms");
    expect(created.designationOther).toBe("Independent director");
    expect(created.resignationDate?.slice(0, 10)).toBe("2024-06-01");
    expect(created.shareType).toBe("ORDINARY");
    expect(created.shareholdingUnits).toBe("1000");
    expect(created.shareholdingAmount).toBe("2500");
  });

  it("rejects a manual issuer shareholder under 5%", async () => {
    await expect(
      createUserAddedParty({
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
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Shareholding Percentage must be at least 5%.",
    });
    expect(parties).toHaveLength(0);
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

  it("rejects a company issuer shareholder at 4.99%", async () => {
    await expect(
      createUserAddedParty({
        portal: "issuer",
        organizationId: "org-1",
        source: "USER",
        patch: {
          entityType: "CORPORATE",
          name: "ABC Sdn Bhd",
          identityNumber: "1234567-B",
          identityPrefix: "ROC",
          isShareholder: true,
          shareholdingPercentage: "4.99",
          shareType: "ORDINARY",
        },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Shareholding Percentage must be at least 5%.",
    });
  });

  it("rejects editing an issuer shareholder from 10% to 3%", async () => {
    parties.push(
      row({
        id: "p-edit",
        party_key: "770101011111",
        identity_number: "770101011111",
        is_shareholder: true,
        shareholding_percentage: new Prisma.Decimal("10"),
      })
    );
    await expect(
      patchPartyProfile({
        portal: "issuer",
        organizationId: "org-1",
        partyId: "p-edit",
        source: "ADMIN",
        patch: { shareholdingPercentage: "3" },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Shareholding Percentage must be at least 5%.",
    });
    expect(Number(parties.find((p) => p.id === "p-edit")?.shareholding_percentage)).toBe(10);
  });

  it("rejects adopting a <5% issuer shareholder-only external party", async () => {
    parties.push(
      row({
        id: "p-small",
        party_key: "660101011111",
        identity_number: "660101011111",
        membership_status: OrganizationPartyMembershipStatus.EXTERNAL_OBSERVED,
        is_shareholder: true,
        is_director: false,
        shareholding_percentage: new Prisma.Decimal("3"),
      })
    );
    await expect(
      adoptObservedParty({
        portal: "issuer",
        organizationId: "org-1",
        partyId: "p-small",
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Shareholding Percentage must be at least 5%.",
    });
    expect(parties.find((p) => p.id === "p-small")?.membership_status).toBe(
      OrganizationPartyMembershipStatus.EXTERNAL_OBSERVED
    );
  });

  it("empty latest CTOS people arrays keep current master people", async () => {
    parties.push(
      row({
        id: "p-keep",
        party_key: "800101011234",
        name: "Charlie",
        is_director: true,
        is_shareholder: false,
      })
    );
    await observeExternalCtosParties("issuer", "org-1", { directors: [], shareholders: [] });
    const kept = parties.find((p) => p.id === "p-keep");
    expect(kept?.membership_status).toBe("MASTER_ACTIVE");
    expect(kept?.name).toBe("Charlie");
    expect(kept?.absent_from_latest_external).toBe(true);
  });

  it("rejects an investor shareholder below 5%", async () => {
    (prisma.investorOrganization.findUnique as jest.Mock).mockResolvedValue({ id: "inv-1" });
    await expect(
      createUserAddedParty({
        portal: "investor",
        organizationId: "inv-1",
        source: "USER",
        patch: {
          name: "Retail Holder",
          identityNumber: "550101011111",
          identityPrefix: "NRIC",
          isShareholder: true,
          shareholdingPercentage: "2",
          shareType: "ORDINARY",
        },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Shareholding Percentage must be at least 5%.",
    });
    expect(parties).toHaveLength(0);
  });

  it("accepts an investor shareholder at 5% and a company at 10%", async () => {
    (prisma.investorOrganization.findUnique as jest.Mock).mockResolvedValue({ id: "inv-1" });
    const individual = await createUserAddedParty({
      portal: "investor",
      organizationId: "inv-1",
      source: "USER",
      patch: {
        name: "Retail Holder",
        identityNumber: "550101011111",
        identityPrefix: "NRIC",
        isShareholder: true,
        shareholdingPercentage: "5",
        shareType: "ORDINARY",
      },
    });
    expect(individual.isShareholder).toBe(true);
    expect(individual.shareholdingPercentage).toBe("5");
    const company = await createUserAddedParty({
      portal: "investor",
      organizationId: "inv-1",
      source: "USER",
      patch: {
        entityType: "CORPORATE",
        name: "HoldCo Sdn Bhd",
        identityNumber: "1234567-C",
        identityPrefix: "ROC",
        isShareholder: true,
        shareholdingPercentage: "10",
        shareType: "ORDINARY",
      },
    });
    expect(company.isShareholder).toBe(true);
    expect(company.entityType).toBe("CORPORATE");
  });

  it("rejects an investor company shareholder at 4.99%", async () => {
    (prisma.investorOrganization.findUnique as jest.Mock).mockResolvedValue({ id: "inv-1" });
    await expect(
      createUserAddedParty({
        portal: "investor",
        organizationId: "inv-1",
        source: "USER",
        patch: {
          entityType: "CORPORATE",
          name: "ABC Sdn Bhd",
          identityNumber: "1234567-D",
          identityPrefix: "ROC",
          isShareholder: true,
          shareholdingPercentage: "4.99",
          shareType: "ORDINARY",
        },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Shareholding Percentage must be at least 5%.",
    });
  });

  it("rejects adopting a <5% investor shareholder-only external party", async () => {
    (prisma.investorOrganization.findUnique as jest.Mock).mockResolvedValue({ id: "inv-1" });
    parties.push(
      row({
        id: "p-inv-small",
        party_key: "660101011222",
        identity_number: "660101011222",
        membership_status: OrganizationPartyMembershipStatus.EXTERNAL_OBSERVED,
        is_shareholder: true,
        is_director: false,
        shareholding_percentage: new Prisma.Decimal("3"),
        issuer_organization_id: null,
        investor_organization_id: "inv-1",
      })
    );
    await expect(
      adoptObservedParty({
        portal: "investor",
        organizationId: "inv-1",
        partyId: "p-inv-small",
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Shareholding Percentage must be at least 5%.",
    });
  });

  it("adopts a director with 3% shares without activating the shareholder role", async () => {
    parties.push(
      row({
        id: "p-dir-small",
        party_key: "660101011333",
        identity_number: "660101011333",
        membership_status: OrganizationPartyMembershipStatus.EXTERNAL_OBSERVED,
        is_shareholder: true,
        is_director: true,
        is_board: true,
        shareholding_percentage: new Prisma.Decimal("3"),
      })
    );
    const adopted = await adoptObservedParty({
      portal: "issuer",
      organizationId: "org-1",
      partyId: "p-dir-small",
    });
    expect(adopted.membershipStatus).toBe("MASTER_ACTIVE");
    expect(adopted.isDirector).toBe(true);
    expect(adopted.isBoard).toBe(true);
    expect(adopted.isShareholder).toBe(false);
    expect(adopted.shareholdingPercentage).toBeNull();
  });

  it("rejects editing a CTOS-observed person until Admin adds them to the current profile", async () => {
    parties.push(
      row({
        id: "p-obs",
        party_key: "900101101234",
        membership_status: OrganizationPartyMembershipStatus.EXTERNAL_OBSERVED,
        is_director: true,
      })
    );
    await expect(
      patchPartyProfile({
        portal: "issuer",
        organizationId: "org-1",
        partyId: "p-obs",
        source: "USER",
        fillEmptyOnly: true,
        patch: { nationality: "MALAYSIA" },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "Add this CTOS person to the current profile before editing.",
    });
  });

  it("does not reactivate an inactive person when the same identity is added or edited", async () => {
    parties.push(
      row({
        id: "p-john",
        party_key: "880101011111",
        identity_number: "880101011111",
        name: "John",
        is_director: true,
        is_shareholder: true,
        is_board: true,
        shareholding_percentage: new Prisma.Decimal("20"),
        membership_status: OrganizationPartyMembershipStatus.MASTER_INACTIVE,
      })
    );
    await expect(
      createUserAddedParty({
        portal: "issuer",
        organizationId: "org-1",
        source: "USER",
        patch: {
          name: "John",
          identityNumber: "880101-01-1111",
          isDirector: true,
        },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "This person is no longer active on the current profile.",
    });
    await expect(
      patchPartyProfile({
        portal: "issuer",
        organizationId: "org-1",
        partyId: "p-john",
        source: "USER",
        fillEmptyOnly: true,
        patch: { nationality: "MALAYSIA" },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: "This person is no longer active on the current profile.",
    });
    expect(parties.find((p) => p.id === "p-john")?.membership_status).toBe(
      OrganizationPartyMembershipStatus.MASTER_INACTIVE
    );
    expect(parties.filter((p) => canonicalKey(p.party_key) === "880101011111")).toHaveLength(1);
  });

  it("inactivates a CTOS-present MASTER_ACTIVE party and only changes membership_status", async () => {
    parties.push(
      row({
        id: "p-john",
        party_key: "880101011111",
        name: "John",
        is_director: true,
        is_shareholder: true,
        is_board: true,
        shareholding_percentage: new Prisma.Decimal("20"),
        external_observation: { name: "JOHN" },
        absent_from_latest_external: false,
      })
    );
    const before = parties.find((p) => p.id === "p-john");
    const beforeSnapshot = { ...before };
    const updated = await inactivateMasterParty({
      portal: "issuer",
      organizationId: "org-1",
      partyId: "p-john",
    });
    expect(updated.membershipStatus).toBe("MASTER_INACTIVE");
    expect(mockPartyUpdate).toHaveBeenCalledWith({
      where: { id: "p-john" },
      data: { membership_status: OrganizationPartyMembershipStatus.MASTER_INACTIVE },
    });
    const stored = parties.find((p) => p.id === "p-john");
    expect(stored?.name).toBe("John");
    expect(stored?.is_director).toBe(true);
    expect(stored?.is_shareholder).toBe(true);
    expect(stored?.is_board).toBe(true);
    expect(Number(stored?.shareholding_percentage)).toBe(20);
    expect(stored?.external_observation).toEqual({ name: "JOHN" });
    expect(stored?.identity_number).toBe(beforeSnapshot.identity_number);
    expect(stored?.field_sources).toEqual(beforeSnapshot.field_sources);
    expect(parties.filter((p) => p.id === "p-john")).toHaveLength(1);
    const rest = { ...stored } as Record<string, unknown>;
    const beforeRest = { ...beforeSnapshot } as Record<string, unknown>;
    delete rest.membership_status;
    delete rest.updated_at;
    delete beforeRest.membership_status;
    delete beforeRest.updated_at;
    expect(rest).toEqual(beforeRest);
  });

  it("inactivates a CTOS-absent MASTER_ACTIVE party without clearing identity or roles", async () => {
    parties.push(
      row({
        id: "p-absent",
        party_key: "770101011111",
        name: "Absent",
        is_director: true,
        absent_from_latest_external: true,
        external_observation: { name: "ABSENT" },
      })
    );
    const updated = await inactivateMasterParty({
      portal: "issuer",
      organizationId: "org-1",
      partyId: "p-absent",
    });
    expect(updated.membershipStatus).toBe("MASTER_INACTIVE");
    expect(mockPartyUpdate).toHaveBeenCalledWith({
      where: { id: "p-absent" },
      data: { membership_status: OrganizationPartyMembershipStatus.MASTER_INACTIVE },
    });
    const stored = parties.find((p) => p.id === "p-absent");
    expect(stored?.name).toBe("Absent");
    expect(stored?.is_director).toBe(true);
    expect(stored?.identity_number).toBe("770101011111");
    expect(stored?.absent_from_latest_external).toBe(true);
    expect(stored?.external_observation).toEqual({ name: "ABSENT" });
  });

  it("inactivates a USER_ADDED MASTER_ACTIVE party without deleting the row", async () => {
    parties.push(
      row({
        id: "p-manual",
        party_key: "660101011111",
        name: "Manual",
        origin: OrganizationPartyOrigin.USER_ADDED,
        is_management: true,
        is_shareholder: false,
        shareholding_percentage: null,
      })
    );
    const updated = await inactivateMasterParty({
      portal: "issuer",
      organizationId: "org-1",
      partyId: "p-manual",
    });
    expect(updated.membershipStatus).toBe("MASTER_INACTIVE");
    expect(mockPartyUpdate).toHaveBeenCalledWith({
      where: { id: "p-manual" },
      data: { membership_status: OrganizationPartyMembershipStatus.MASTER_INACTIVE },
    });
    expect(parties.filter((p) => p.id === "p-manual")).toHaveLength(1);
    expect(parties.find((p) => p.id === "p-manual")?.origin).toBe(OrganizationPartyOrigin.USER_ADDED);
    expect(parties.find((p) => p.id === "p-manual")?.is_management).toBe(true);
  });

  it("does not inactivate a party that belongs to another organization", async () => {
    parties.push(
      row({
        id: "p-other",
        issuer_organization_id: "org-2",
        party_key: "990101011234",
        name: "Other Org Person",
      })
    );
    await expect(
      inactivateMasterParty({
        portal: "issuer",
        organizationId: "org-1",
        partyId: "p-other",
      })
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Party profile not found",
    });
    expect(mockPartyUpdate).not.toHaveBeenCalled();
    expect(parties.find((p) => p.id === "p-other")?.membership_status).toBe(
      OrganizationPartyMembershipStatus.MASTER_ACTIVE
    );
  });

  it("does not inactivate a person who is already inactive", async () => {
    parties.push(
      row({
        id: "p-john",
        party_key: "880101011111",
        name: "John",
        membership_status: OrganizationPartyMembershipStatus.MASTER_INACTIVE,
      })
    );
    await expect(
      inactivateMasterParty({
        portal: "issuer",
        organizationId: "org-1",
        partyId: "p-john",
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "INVALID_PARTY_STATUS",
    });
    expect(mockPartyUpdate).not.toHaveBeenCalled();
  });

  it("CTOS listing an inactive person again does not reactivate them", async () => {
    parties.push(
      row({
        id: "p-john",
        party_key: "880101011111",
        name: "John",
        is_director: true,
        membership_status: OrganizationPartyMembershipStatus.MASTER_INACTIVE,
        absent_from_latest_external: true,
      })
    );
    await observeExternalCtosParties("issuer", "org-1", {
      directors: [{ party_type: "I", nic_brno: "880101011111", name: "John", position: "DO" }],
    });
    const john = parties.find((p) => p.id === "p-john");
    expect(john?.membership_status).toBe("MASTER_INACTIVE");
    expect(john?.absent_from_latest_external).toBe(false);
    expect(parties.filter((p) => canonicalKey(p.party_key) === "880101011111")).toHaveLength(1);
  });

  it("investor edit updates the same master person and keeps unrelated roles", async () => {
    (prisma.investorOrganization.findUnique as jest.Mock).mockResolvedValue({ id: "inv-1" });
    parties.push(
      row({
        id: "p-inv",
        party_key: "550101011111",
        identity_number: "550101011111",
        issuer_organization_id: null,
        investor_organization_id: "inv-1",
        is_director: true,
        is_shareholder: true,
        is_board: true,
        is_management: false,
        shareholding_percentage: new Prisma.Decimal("10"),
      })
    );
    const updated = await patchPartyProfile({
      portal: "investor",
      organizationId: "inv-1",
      partyId: "p-inv",
      source: "USER",
      fillEmptyOnly: true,
      patch: { shareholdingPercentage: "15" },
    });
    expect(updated.id).toBe("p-inv");
    expect(updated.isDirector).toBe(true);
    expect(updated.isBoard).toBe(true);
    expect(updated.isShareholder).toBe(true);
    expect(updated.isManagement).toBe(false);
    expect(updated.shareholdingPercentage).toBe("15");
    expect(parties.filter((p) => p.id === "p-inv")).toHaveLength(1);
  });

  it("first usable CTOS seed does not create a RegTank-only party as MASTER_ACTIVE", async () => {
    issuerOrg.corporate_entities = {
      directors: [
        {
          personalInfo: {
            fullName: "Bob",
            governmentIdNumber: "900101101234",
          },
        },
      ],
      shareholders: [],
      corporateShareholders: [],
    };
    mockCtosFindFirst.mockResolvedValue({
      company_json: {
        directors: [{ party_type: "I", nic_brno: "800101011234", name: "Jamie", position: "DO" }],
        shareholders: [],
      },
    });
    await seedMasterPartiesIfEmpty("issuer", "org-1");
    expect(parties.some((p) => p.party_key === "800101011234")).toBe(true);
    expect(parties.some((p) => p.party_key === "900101101234")).toBe(false);
  });

  it("after usable CTOS, does not add a missing RegTank-only corporate shareholder as MASTER_ACTIVE", async () => {
    issuerOrg.regulatory_structure_established_at = new Date("2026-01-01T00:00:00.000Z");
    issuerOrg.corporate_entities = {
      directors: [
        {
          personalInfo: {
            fullName: "Nur Aina Farisha Binti Salleh",
            governmentIdNumber: "950829083430",
          },
        },
      ],
      shareholders: [
        {
          personalInfo: {
            fullName: "Nur Aina Farisha Binti Salleh",
            governmentIdNumber: "950829083430",
          },
          sharePercentage: 6,
        },
      ],
      corporateShareholders: [
        {
          businessName: "ApexStar Holdings Sdn. Bhd.",
          ssmRegistrationNumber: "202001234567",
          sharePercentage: 10,
        },
      ],
    };
    parties.push(
      row({
        id: "p-aina",
        party_key: "950829083430",
        identity_number: "950829083430",
        name: "Nur Aina Farisha Binti Salleh",
        origin: OrganizationPartyOrigin.CTOS_PARTY,
        is_director: true,
        is_shareholder: false,
        is_board: true,
      })
    );
    mockCtosFindFirst.mockResolvedValue({
      company_json: {
        directors: [
          {
            party_type: "I",
            nic_brno: "950829083430",
            name: "Nur Aina Farisha Binti Salleh",
            position: "DO",
          },
        ],
        shareholders: [],
      },
    });
    await seedMasterPartiesIfEmpty("issuer", "org-1");
    const aina = parties.find((p) => p.id === "p-aina");
    expect(aina?.is_director).toBe(true);
    expect(aina?.is_shareholder).toBe(true);
    expect(aina?.is_board).toBe(false);
    const apex = parties.find((p) => String(p.name).includes("ApexStar"));
    expect(apex).toBeUndefined();
  });

  it("promotes a CTOS-only ApexStar onto the live list at RegTank 10% and keeps the 50% observation", async () => {
    issuerOrg.regulatory_structure_established_at = new Date("2026-01-01T00:00:00.000Z");
    issuerOrg.corporate_entities = {
      directors: [],
      shareholders: [],
      corporateShareholders: [
        {
          formContent: {
            displayAreas: [
              {
                displayArea: "Basic Information Setting",
                content: [
                  { fieldName: "Business Name", fieldValue: "ApexStar Holdings Sdn. Bhd." },
                  { fieldName: "Business Number", fieldValue: "7321984G" },
                  { fieldName: "% of Shares", fieldValue: "10" },
                ],
              },
            ],
          },
        },
      ],
    };
    parties.push(
      row({
        id: "p-apex",
        party_key: "7321984G",
        identity_number: "7321984G",
        identity_prefix: "ROC",
        entity_type: "CORPORATE",
        name: "ApexStar Holdings Sdn. Bhd.",
        origin: OrganizationPartyOrigin.CTOS_PARTY,
        membership_status: OrganizationPartyMembershipStatus.EXTERNAL_OBSERVED,
        is_director: false,
        is_shareholder: true,
        shareholding_percentage: new Prisma.Decimal("50"),
        field_sources: {
          shareholdingPercentage: { source: "CTOS", updatedAt: "2026-01-01T00:00:00.000Z" },
        },
        external_observation: {
          name: "ApexStar Holdings Sdn. Bhd.",
          identityNumber: "7321984G",
          entityType: "CORPORATE",
          isDirector: false,
          isShareholder: true,
          shareholdingPercentage: 50,
        },
      })
    );
    await seedMasterPartiesIfEmpty("issuer", "org-1");
    const apex = parties.find((p) => p.id === "p-apex");
    expect(apex?.membership_status).toBe(OrganizationPartyMembershipStatus.MASTER_ACTIVE);
    expect(Number(apex?.shareholding_percentage)).toBe(10);
    expect(parties.filter((p) => p.party_key === "7321984G")).toHaveLength(1);
    const dto = serializeParty(apex as never);
    expect(dto.mismatches.find((m) => m.field === "shareholdingPercentage")?.externalValue).toBe(50);
    expect(dto.fieldSources.shareholdingPercentage?.source).toBe("REGTANK");
  });

  it("overwrites CTOS-stamped Nur Aina share % with RegTank form 6%", async () => {
    issuerOrg.regulatory_structure_established_at = new Date("2026-01-01T00:00:00.000Z");
    issuerOrg.corporate_entities = {
      directors: [
        {
          personalInfo: {
            fullName: "Nur Aina Farisha Binti Salleh",
            governmentIdNumber: "950829083430",
          },
        },
      ],
      shareholders: [
        {
          personalInfo: {
            fullName: "Nur Aina Farisha Binti Salleh",
            governmentIdNumber: "950829083430",
            formContent: {
              content: [{ fieldName: "% of Shares", fieldValue: "6" }],
            },
          },
        },
      ],
      corporateShareholders: [],
    };
    parties.push(
      row({
        id: "p-aina",
        party_key: "950829083430",
        identity_number: "950829083430",
        name: "Nur Aina Farisha Binti Salleh",
        origin: OrganizationPartyOrigin.CTOS_PARTY,
        is_director: true,
        is_shareholder: true,
        shareholding_percentage: new Prisma.Decimal("5"),
        field_sources: {
          shareholdingPercentage: { source: "CTOS", updatedAt: "2026-01-01T00:00:00.000Z" },
        },
      })
    );
    await seedMasterPartiesIfEmpty("issuer", "org-1");
    expect(Number(parties.find((p) => p.id === "p-aina")?.shareholding_percentage)).toBe(6);
  });

  it("does not overwrite a user-entered Nur Aina share % with the RegTank form figure", async () => {
    issuerOrg.regulatory_structure_established_at = new Date("2026-01-01T00:00:00.000Z");
    issuerOrg.corporate_entities = {
      directors: [],
      shareholders: [
        {
          personalInfo: {
            fullName: "Nur Aina Farisha Binti Salleh",
            governmentIdNumber: "950829083430",
            formContent: {
              content: [{ fieldName: "% of Shares", fieldValue: "6" }],
            },
          },
        },
      ],
      corporateShareholders: [],
    };
    parties.push(
      row({
        id: "p-aina",
        party_key: "950829083430",
        identity_number: "950829083430",
        name: "Nur Aina Farisha Binti Salleh",
        origin: OrganizationPartyOrigin.USER_ADDED,
        is_director: true,
        is_shareholder: true,
        shareholding_percentage: new Prisma.Decimal("5"),
        field_sources: {
          shareholdingPercentage: { source: "USER", updatedAt: "2026-01-01T00:00:00.000Z" },
        },
      })
    );
    await seedMasterPartiesIfEmpty("issuer", "org-1");
    expect(Number(parties.find((p) => p.id === "p-aina")?.shareholding_percentage)).toBe(5);
  });
});

function canonicalKey(value: unknown): string {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
