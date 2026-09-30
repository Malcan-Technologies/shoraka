/**
 * SECTION: Prospectus financial inputs from the Note financial snapshot (unit, mocked Prisma)
 * WHY: Snapshot-backed Notes must never re-read the application or CTOS; legacy Notes keep the
 * live read; year selection uses the Note's reference date, never "today"
 */

import { NoteStatus } from "@prisma/client";
import {
  NOTE_FINANCIAL_SNAPSHOT_VERSION,
  type NoteFinancialSnapshot,
} from "../note-financial-snapshot.types";
import {
  buildCompleteApprovedProspectusSnapshot,
  loadProspectusNoteIdentityFreeze,
} from "../prospectus-review/prospectus-approved-snapshot";
import { buildCompleteProspectusReviewDraft } from "../prospectus-review/prospectus-review.demo-fixtures";
import { buildProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source";
import type { ProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source.types";
import {
  loadProspectusNoteFinancialInputs,
  resolveProspectusFinancialReferenceDate,
} from "./prospectus-note-financial-inputs";
import { buildProspectusPageThree, mapProspectusPageThreeDataToInput } from "./prospectus-page-three-mapper";
import { loadProspectusPageThreeData } from "./prospectus-page-three-prisma";
import { buildProspectusPageTwo, mapProspectusPageTwoDataToInput } from "./prospectus-page-two-mapper";
import { loadProspectusPageTwoData } from "./prospectus-page-two-prisma";

const mockDb = {
  note: { findUnique: jest.fn() },
  application: { findUnique: jest.fn() },
  ctosReport: { findFirst: jest.fn() },
};

jest.mock("../../../lib/prisma", () => ({
  get prisma() {
    return mockDb;
  },
}));
jest.mock("../../paymaster/service", () => ({
  getCurrentMarcAssessment: jest.fn(async () => null),
}));
jest.mock("./prospectus-track-record-query", () => ({
  buildProspectusPage1TrackRecordSnapshot: jest.fn(async () => ({
    issuer_track_record: null,
    historical_notes: [],
  })),
}));
jest.mock("./prospectus-marc-snapshot", () => ({
  resolveMarcSnapshotForProspectus: jest.fn(async () => null),
}));

const NOTE_CREATED_AT = new Date("2026-04-15T02:00:00.000Z");

function noteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "note-fs-1",
    note_reference: "NOTE-FS-1",
    title: "Note FS",
    status: NoteStatus.DRAFT,
    published_at: null,
    source_application_id: "app-fs-1",
    issuer_organization_id: "org-fs-1",
    maturity_date: null,
    target_amount: 100,
    funded_amount: 0,
    profit_rate_percent: null,
    service_fee_rate_percent: 0,
    platform_fee_rate_percent: 0,
    product_snapshot: null,
    purpose_snapshot: null,
    contract_snapshot: null,
    issuer_snapshot: { name: "Issuer" },
    invoice_snapshot: {},
    paymaster_snapshot: {},
    prospectus_snapshot: null,
    financial_snapshot: null,
    created_at: NOTE_CREATED_AT,
    updated_at: NOTE_CREATED_AT,
    listing: null,
    ...overrides,
  };
}

function snapshot(input: {
  financialStatements: unknown;
  ctosFinancials: unknown;
  referenceDate: string;
  ctos?: NoteFinancialSnapshot["ctos"];
}): NoteFinancialSnapshot {
  return {
    version: NOTE_FINANCIAL_SNAPSHOT_VERSION,
    captured_at: NOTE_CREATED_AT.toISOString(),
    reference_date: input.referenceDate,
    financial_statements: input.financialStatements,
    ctos:
      input.ctos !== undefined
        ? input.ctos
        : {
            report_id: "ctos-fs-1",
            fetched_at: "2026-01-01T00:00:00.000Z",
            financials: input.ctosFinancials,
          },
    source: {
      application_id: "app-fs-1",
      review_cycle: 1,
      application_submitted_at: input.referenceDate,
      financial_review: { status: "APPROVED", reviewed_at: null, reviewer_user_id: null },
    },
  };
}

function ctosRow(year: number, account: Record<string, unknown>) {
  return { financial_year: year, dates: { pldd: `${year}-12-31`, bsdd: null }, account };
}

function expectNoLiveFinancialReads(): void {
  expect(mockDb.application.findUnique).not.toHaveBeenCalled();
  expect(mockDb.ctosReport.findFirst).not.toHaveBeenCalled();
}

function realYears(source: ProspectusFinancialComparisonSource): number[] {
  return source.years.filter((year) => year.isPlaceholder !== true).map((year) => year.year);
}

async function renderedSources(): Promise<{
  page2: ProspectusFinancialComparisonSource;
  page3: ProspectusFinancialComparisonSource;
}> {
  const page2 = buildProspectusPageTwo(
    mapProspectusPageTwoDataToInput(await loadProspectusPageTwoData(mockDb as never, "note-fs-1"))
  );
  const page3 = buildProspectusPageThree(
    mapProspectusPageThreeDataToInput(await loadProspectusPageThreeData(mockDb as never, "note-fs-1"))
  );
  return { page2: page2.financialComparisonSource, page3: page3.financialSource };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.application.findUnique.mockResolvedValue(null);
  mockDb.ctosReport.findFirst.mockResolvedValue(null);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("resolveProspectusFinancialReferenceDate", () => {
  const snap = snapshot({
    financialStatements: null,
    ctosFinancials: null,
    referenceDate: "2026-03-01T04:00:00.000Z",
  });

  it("uses snapshot.reference_date for a snapshot-backed Note", () => {
    expect(
      resolveProspectusFinancialReferenceDate({
        snapshot: snap,
        applicationSubmittedAt: new Date("2020-01-01T00:00:00.000Z"),
        noteCreatedAt: NOTE_CREATED_AT,
      }).toISOString()
    ).toBe("2026-03-01T04:00:00.000Z");
  });

  it("uses application submitted_at for a legacy Note, else the Note created_at", () => {
    const submittedAt = new Date("2026-02-10T00:00:00.000Z");
    expect(
      resolveProspectusFinancialReferenceDate({
        snapshot: null,
        applicationSubmittedAt: submittedAt,
        noteCreatedAt: NOTE_CREATED_AT,
      })
    ).toEqual(submittedAt);
    expect(
      resolveProspectusFinancialReferenceDate({
        snapshot: null,
        applicationSubmittedAt: null,
        noteCreatedAt: NOTE_CREATED_AT,
      })
    ).toEqual(NOTE_CREATED_AT);
  });
});

describe("loadProspectusNoteFinancialInputs", () => {
  const statements = { questionnaire: { financial_year_end: "2026-12-31" }, unaudited_by_year: {} };
  const ctos = [ctosRow(2024, { turnover: 1 })];

  it("reads only the snapshot for a snapshot-backed Note", async () => {
    const inputs = await loadProspectusNoteFinancialInputs({
      db: mockDb as never,
      note: noteRow({
        financial_snapshot: snapshot({
          financialStatements: statements,
          ctosFinancials: ctos,
          referenceDate: "2026-03-01T00:00:00.000Z",
        }),
      }) as never,
    });
    expect(inputs).toEqual({
      origin: "note_financial_snapshot",
      financialStatements: statements,
      ctosFinancials: ctos,
      referenceDate: new Date("2026-03-01T00:00:00.000Z"),
    });
    expectNoLiveFinancialReads();
  });

  it("returns null CTOS financials for a snapshot with ctos: null", async () => {
    const inputs = await loadProspectusNoteFinancialInputs({
      db: mockDb as never,
      note: noteRow({
        financial_snapshot: snapshot({
          financialStatements: statements,
          ctosFinancials: null,
          referenceDate: "2026-03-01T00:00:00.000Z",
          ctos: null,
        }),
      }) as never,
    });
    expect(inputs.ctosFinancials).toBeNull();
    expect(inputs.financialStatements).toEqual(statements);
    expectNoLiveFinancialReads();
  });

  it.each([
    ["wrong version", { version: 99 }],
    ["corrupted shape", { version: NOTE_FINANCIAL_SNAPSHOT_VERSION, captured_at: "not-a-date" }],
    ["non-object value", "snapshot"],
  ])("throws for a present but invalid snapshot (%s) without any live read", async (_label, value) => {
    await expect(
      loadProspectusNoteFinancialInputs({
        db: mockDb as never,
        note: noteRow({ financial_snapshot: value }) as never,
      })
    ).rejects.toMatchObject({
      statusCode: 500,
      code: "NOTE_FINANCIAL_SNAPSHOT_INVALID",
      message: "Note financial snapshot is invalid",
    });
    expectNoLiveFinancialReads();
  });

  it("reads the live application then the owned CTOS for a Note with no snapshot", async () => {
    const submittedAt = new Date("2026-02-10T00:00:00.000Z");
    mockDb.application.findUnique.mockResolvedValue({
      financial_statements: statements,
      submitted_at: submittedAt,
    });
    mockDb.ctosReport.findFirst.mockResolvedValue({
      id: "ctos-live",
      fetched_at: new Date("2026-02-01T00:00:00.000Z"),
      financials_json: ctos,
    });
    const inputs = await loadProspectusNoteFinancialInputs({
      db: mockDb as never,
      note: noteRow({ financial_snapshot: null }) as never,
    });
    expect(inputs).toEqual({
      origin: "live_application",
      financialStatements: statements,
      ctosFinancials: ctos,
      referenceDate: submittedAt,
    });
    expect(mockDb.application.findUnique).toHaveBeenCalledWith({
      where: { id: "app-fs-1" },
      select: { financial_statements: true, submitted_at: true },
    });
    expect(mockDb.ctosReport.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          issuer_organization_id: "org-fs-1",
          subject_ref: null,
          fetched_at: { lte: submittedAt },
        },
      })
    );
  });

  it("uses the Note created_at when the source application is missing", async () => {
    const inputs = await loadProspectusNoteFinancialInputs({
      db: mockDb as never,
      note: noteRow() as never,
    });
    expect(inputs.financialStatements).toBeNull();
    expect(inputs.referenceDate).toEqual(NOTE_CREATED_AT);
  });
});

describe("Prospectus loaders with a Note financial snapshot", () => {
  const statements = {
    questionnaire: { financial_year_end: "2026-12-31" },
    unaudited_by_year: { "2026": { turnover: 4_000_000, plnpat: 400_000, pldd: "2026-12-31" } },
  };
  const ctos = [ctosRow(2025, { turnover: 3_000_000, plnpat: 300_000 })];

  it("Page 2, Page 3 and the approve freeze make no application / CTOS read", async () => {
    mockDb.note.findUnique.mockResolvedValue(
      noteRow({
        financial_snapshot: snapshot({
          financialStatements: statements,
          ctosFinancials: ctos,
          referenceDate: "2026-08-01T00:00:00.000Z",
        }),
      })
    );

    const page2 = await loadProspectusPageTwoData(mockDb as never, "note-fs-1");
    const page3 = await loadProspectusPageThreeData(mockDb as never, "note-fs-1");
    const freeze = await loadProspectusNoteIdentityFreeze("note-fs-1");

    for (const loaded of [page2, page3]) {
      expect(loaded.liveFinancialStatements).toEqual(statements);
      expect(loaded.liveCtosFinancials).toEqual(ctos);
      expect(loaded.financialReferenceDate).toEqual(new Date("2026-08-01T00:00:00.000Z"));
    }
    expect(freeze.financialStatements).toEqual(statements);
    expect(freeze.ctosFinancials).toEqual(ctos);
    expect(freeze.financialReferenceDate).toEqual(new Date("2026-08-01T00:00:00.000Z"));
    expect(Object.keys(freeze.fingerprintSource).sort()).toEqual([
      "ctos_financials",
      "financial_statements",
      "note_identity",
    ]);
    expect(freeze.fingerprintSource.financial_statements).toEqual(statements);
    expect(freeze.fingerprintSource.ctos_financials).toEqual(ctos);
    expectNoLiveFinancialReads();
  });

  it("legacy Note still reads the live application and owned CTOS exactly as before", async () => {
    const submittedAt = new Date("2026-08-01T00:00:00.000Z");
    mockDb.note.findUnique.mockResolvedValue(noteRow());
    mockDb.application.findUnique.mockResolvedValue({
      financial_statements: statements,
      submitted_at: submittedAt,
    });
    mockDb.ctosReport.findFirst.mockResolvedValue({
      id: "ctos-owned",
      fetched_at: new Date("2026-07-01T00:00:00.000Z"),
      financials_json: ctos,
    });

    const page2 = await loadProspectusPageTwoData(mockDb as never, "note-fs-1");
    const freeze = await loadProspectusNoteIdentityFreeze("note-fs-1");

    expect(page2.liveFinancialStatements).toEqual(statements);
    expect(page2.liveCtosFinancials).toEqual(ctos);
    expect(page2.financialReferenceDate).toEqual(submittedAt);
    expect(freeze.fingerprintSource.financial_statements).toEqual(statements);
    expect(freeze.fingerprintSource.ctos_financials).toEqual(ctos);
    expect(freeze.financialReferenceDate).toEqual(submittedAt);
    expect(mockDb.application.findUnique).toHaveBeenCalledTimes(2);
    for (const call of mockDb.ctosReport.findFirst.mock.calls) {
      expect(call[0]).toEqual({
        where: {
          issuer_organization_id: "org-fs-1",
          subject_ref: null,
          fetched_at: { lte: submittedAt },
        },
        orderBy: { fetched_at: "desc" },
        select: { id: true, fetched_at: true, financials_json: true },
      });
    }
  });

  it("Page 2, Page 3 and the approve freeze propagate an invalid snapshot without live reads", async () => {
    mockDb.note.findUnique.mockResolvedValue(noteRow({ financial_snapshot: { version: 99 } }));
    const invalid = { statusCode: 500, code: "NOTE_FINANCIAL_SNAPSHOT_INVALID" };

    await expect(loadProspectusPageTwoData(mockDb as never, "note-fs-1")).rejects.toMatchObject(invalid);
    await expect(loadProspectusPageThreeData(mockDb as never, "note-fs-1")).rejects.toMatchObject(invalid);
    await expect(loadProspectusNoteIdentityFreeze("note-fs-1")).rejects.toMatchObject(invalid);
    expectNoLiveFinancialReads();
  });

  it("published Notes read no financial inputs and carry no reference date", async () => {
    mockDb.note.findUnique.mockResolvedValue(
      noteRow({ status: NoteStatus.PUBLISHED, published_at: new Date("2026-05-01T00:00:00.000Z") })
    );
    const page2 = await loadProspectusPageTwoData(mockDb as never, "note-fs-1");
    expect(page2.financialReferenceDate).toBeNull();
    expect(page2.liveFinancialStatements).toBeNull();
    expectNoLiveFinancialReads();
  });
});

describe("C13 source priority over snapshot content", () => {
  const override = (value: number) => ({
    value,
    baseSource: "ctos",
    action: "add_missing_ctos_field",
    updated_by_user_id: "admin",
    updated_at: "2026-01-01T00:00:00.000Z",
  });
  // FY2024: User Input + CTOS + Admin Input. FY2023: CTOS only, with an explicit gap-fill.
  // FY2022: Admin Input only. Reference date is after the FY2023 filing window closed.
  const statements = {
    questionnaire: { financial_year_end: "2024-12-31" },
    unaudited_by_year: {
      "2024": { turnover: 1_000_000, plnpat: 100_000, pldd: "2024-12-31" },
    },
    admin_input_by_year: {
      "2024": { turnover: 9_999_999, plnpat: 999_999, statementType: "MANAGEMENT_ACCOUNTS" },
      "2022": { turnover: 2_200_000, plnpat: 220_000, statementType: "NOT_AUDITED" },
    },
    admin_field_overrides: {
      "2023": { cashAndBank: override(777_000) },
      "2024": { cashAndBank: override(888_000) },
    },
  };
  const ctos = [
    ctosRow(2024, { turnover: 5_000_000, plnpat: 500_000 }),
    ctosRow(2023, { turnover: 3_300_000, plnpat: 330_000 }),
  ];
  const referenceDate = "2024-08-01T00:00:00.000Z";

  it("picks User Input → CTOS + gap-fill → Admin Input exactly like the live path", async () => {
    mockDb.note.findUnique.mockResolvedValue(
      noteRow({
        financial_snapshot: snapshot({ financialStatements: statements, ctosFinancials: ctos, referenceDate }),
      })
    );
    const fromSnapshot = await renderedSources();
    expectNoLiveFinancialReads();

    for (const source of [fromSnapshot.page2, fromSnapshot.page3]) {
      expect(realYears(source)).toEqual([2022, 2023, 2024]);
      const byYear = new Map(source.years.map((year) => [year.year, year]));
      expect(byYear.get(2024)?.recordSource).toBe("unaudited_management");
      expect(byYear.get(2024)?.rawFinancials.turnover).toBe(1_000_000);
      // A CTOS gap-fill never supplements a User Input year.
      expect(byYear.get(2024)?.rawFinancials.cashAndBank ?? null).toBeNull();
      expect(byYear.get(2023)?.recordSource).toBe("ctos_audited");
      expect(byYear.get(2023)?.rawFinancials.turnover).toBe(3_300_000);
      expect(byYear.get(2023)?.rawFinancials.cashAndBank).toBe(777_000);
      expect(byYear.get(2022)?.recordSource).toBe("admin_input");
      expect(byYear.get(2022)?.rawFinancials.turnover).toBe(2_200_000);
    }

    // Same content via the legacy live read (submitted_at = same reference date) → identical output.
    mockDb.note.findUnique.mockResolvedValue(noteRow());
    mockDb.application.findUnique.mockResolvedValue({
      financial_statements: statements,
      submitted_at: new Date(referenceDate),
    });
    mockDb.ctosReport.findFirst.mockResolvedValue({
      id: "ctos-live",
      fetched_at: new Date("2024-07-01T00:00:00.000Z"),
      financials_json: ctos,
    });
    const fromLive = await renderedSources();
    expect(fromSnapshot).toEqual(fromLive);
  });
});

describe("D17 year selection is anchored to the Note reference date", () => {
  // FYE 2026-12-31: the FY2025 issuer filing window closes 2026-06-30. Before it the issuer
  // tabs are FY2025 + FY2026; after it only FY2026.
  const statements = {
    questionnaire: { financial_year_end: "2026-12-31" },
    unaudited_by_year: {
      "2025": { turnover: 1_500_000, plnpat: 150_000, pldd: "2025-12-31" },
      "2026": { turnover: 2_600_000, plnpat: 260_000, pldd: "2026-12-31" },
    },
  };
  const beforeWindowCloses = new Date("2026-03-01T00:00:00.000Z");
  const afterWindowCloses = new Date("2026-09-01T00:00:00.000Z");

  function useClock(now: Date): void {
    jest.useFakeTimers({ now, doNotFake: ["nextTick", "setImmediate"] });
  }

  it("guards the fixture: a later ref would drop FY2025", () => {
    expect(
      realYears(
        buildProspectusFinancialComparisonSource({ financialStatements: statements, ref: afterWindowCloses })
      )
    ).toEqual([2026]);
  });

  it("snapshot-backed Note: same snapshot + reference date → same years on any day", async () => {
    mockDb.note.findUnique.mockResolvedValue(
      noteRow({
        financial_snapshot: snapshot({
          financialStatements: statements,
          ctosFinancials: null,
          referenceDate: beforeWindowCloses.toISOString(),
          ctos: null,
        }),
      })
    );

    useClock(beforeWindowCloses);
    const before = await renderedSources();
    useClock(afterWindowCloses);
    const after = await renderedSources();

    expect(realYears(before.page2)).toEqual([2025, 2026]);
    expect(after).toEqual(before);
    expectNoLiveFinancialReads();
  });

  it("legacy Note: reference date is the application submitted_at", async () => {
    mockDb.note.findUnique.mockResolvedValue(noteRow());
    mockDb.application.findUnique.mockResolvedValue({
      financial_statements: statements,
      submitted_at: beforeWindowCloses,
    });

    useClock(afterWindowCloses);
    const { page2, page3 } = await renderedSources();
    expect(realYears(page2)).toEqual([2025, 2026]);
    expect(realYears(page3)).toEqual([2025, 2026]);
  });

  it("legacy Note without submitted_at falls back to the Note created_at", async () => {
    mockDb.note.findUnique.mockResolvedValue(noteRow({ created_at: beforeWindowCloses }));
    mockDb.application.findUnique.mockResolvedValue({
      financial_statements: statements,
      submitted_at: null,
    });

    useClock(afterWindowCloses);
    expect(realYears((await renderedSources()).page2)).toEqual([2025, 2026]);

    mockDb.note.findUnique.mockResolvedValue(noteRow({ created_at: afterWindowCloses }));
    useClock(beforeWindowCloses);
    expect(realYears((await renderedSources()).page2)).toEqual([2026]);
  });

  it("approve freeze selects years with the reference date and stamps calculated_at with approval time", async () => {
    mockDb.note.findUnique.mockResolvedValue(
      noteRow({
        financial_snapshot: snapshot({
          financialStatements: statements,
          ctosFinancials: null,
          referenceDate: beforeWindowCloses.toISOString(),
          ctos: null,
        }),
      })
    );
    const approved = await buildCompleteApprovedProspectusSnapshot({
      noteId: "note-fs-1",
      publicationId: "pub-fs-1",
      contentVersion: 1,
      approvedContent: buildCompleteProspectusReviewDraft(),
      approvedAt: afterWindowCloses,
      approvedByUserId: "admin-1",
      optionCatalogueVersion: "opt-v1",
    });
    const page2 = approved.page_2 as {
      financial_comparison: { selected_years: { year: number }[]; calculated_at: string };
    };
    expect(page2.financial_comparison.selected_years.map((year) => year.year)).toEqual([2025, 2026]);
    expect(approved.calculated_at).toBe(afterWindowCloses.toISOString());
    expectNoLiveFinancialReads();
    expect(page2.financial_comparison.calculated_at).toBe(afterWindowCloses.toISOString());
  });
});
