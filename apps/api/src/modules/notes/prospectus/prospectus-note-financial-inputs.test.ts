/**
 * SECTION: Prospectus financial input = the Note financial snapshot (unit, mocked Prisma)
 * WHY: The Prospectus displays the approved Financial Review result copied onto the Note. It never
 * reads the application or CTOS, so later changes to either cannot move Page 2 / Page 3; a Note
 * without a snapshot fails clearly instead of falling back to a live read
 */

import { NoteStatus } from "@prisma/client";
import type { ApprovedFinancialResult } from "@cashsouk/types";
import {
  approvedFinancialResultFromInputs,
  noteFinancialSnapshotOf,
} from "./prospectus-financial-comparison-test-helpers";
import { readProspectusNoteFinancialSnapshot } from "./prospectus-note-financial-inputs";
import { buildProspectusPageThree, mapProspectusPageThreeDataToInput } from "./prospectus-page-three-mapper";
import { loadProspectusPageThreeData } from "./prospectus-page-three-prisma";
import { buildProspectusPageTwo, mapProspectusPageTwoDataToInput } from "./prospectus-page-two-mapper";
import { loadProspectusPageTwoData } from "./prospectus-page-two-prisma";
import { buildProspectusPageThreeHtml } from "./prospectus-page-three.html";
import { buildProspectusPageTwoHtml } from "./prospectus-page-two.html";

jest.mock("./prospectus-marc-snapshot", () => ({
  resolveMarcSnapshotForProspectus: jest.fn(async () => null),
}));

const mockDb = {
  note: { findUnique: jest.fn() },
  application: { findUnique: jest.fn(), findFirst: jest.fn() },
  ctosReport: { findFirst: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
};

const REF = new Date("2026-09-25T00:00:00.000Z");
const NOTE_CREATED_AT = new Date("2026-09-26T02:00:00.000Z");

function ctosRow(year: number, account: Record<string, unknown>) {
  return { financial_year: year, dates: { pldd: `${year}-12-31`, bsdd: null }, account };
}

/** Application financial_statements + owned CTOS at Financial approval. */
const APPROVED_INPUTS = {
  financialStatements: {
    questionnaire: { financial_year_end: "2026-12-31" },
    unaudited_by_year: {
      "2026": {
        turnover: 12_000_000,
        plnpat: 1_300_000,
        plnpbt: 1_600_000,
        bscatot: 5_000_000,
        curlib: 2_500_000,
        bsfatot: 3_000_000,
        cashAndBank: 800_000,
        tradeReceivables: 1_500_000,
        interest_cost: 100_000,
        pldd: "2026-12-31",
      },
    },
  },
  ctosFinancials: [
    ctosRow(2024, { turnover: 9_000_000, plnpat: 700_000, totass: 8_000_000, totlib: 3_000_000 }),
    ctosRow(2025, { turnover: 10_000_000, plnpat: 900_000, totass: 9_000_000, totlib: 4_000_000 }),
  ],
  ref: REF,
};

/** What the application and CTOS hold after the Note was created. */
const CHANGED_APPLICATION = {
  id: "app-fs-1",
  submitted_at: new Date("2027-03-01T00:00:00.000Z"),
  financial_statements: {
    questionnaire: { financial_year_end: "2026-12-31" },
    unaudited_by_year: { "2026": { turnover: 1, plnpat: 1, pldd: "2026-12-31" } },
  },
};
const CHANGED_CTOS_REPORT = {
  id: "ctos-newer",
  fetched_at: new Date("2027-03-02T00:00:00.000Z"),
  financials_json: [ctosRow(2025, { turnover: 99_000_000, plnpat: 1 })],
};

function noteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "note-fs-1",
    note_reference: "NOTE-FS-1",
    status: NoteStatus.DRAFT,
    published_at: null,
    source_application_id: "app-fs-1",
    issuer_organization_id: "org-fs-1",
    maturity_date: null,
    target_amount: 100,
    funded_amount: 0,
    issuer_snapshot: { name: "Issuer", industry: "Construction" },
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

function approvedResult(): ApprovedFinancialResult {
  return approvedFinancialResultFromInputs(APPROVED_INPUTS);
}

function expectNoApplicationOrCtosRead(): void {
  expect(mockDb.application.findUnique).not.toHaveBeenCalled();
  expect(mockDb.application.findFirst).not.toHaveBeenCalled();
  expect(mockDb.ctosReport.findFirst).not.toHaveBeenCalled();
  expect(mockDb.ctosReport.findUnique).not.toHaveBeenCalled();
  expect(mockDb.ctosReport.findMany).not.toHaveBeenCalled();
}

async function renderPages() {
  const page2 = buildProspectusPageTwo(
    mapProspectusPageTwoDataToInput(await loadProspectusPageTwoData(mockDb as never, "note-fs-1"))
  );
  const page3 = buildProspectusPageThree(
    mapProspectusPageThreeDataToInput(await loadProspectusPageThreeData(mockDb as never, "note-fs-1"))
  );
  return {
    page2,
    page3,
    html: { page2: buildProspectusPageTwoHtml(page2), page3: buildProspectusPageThreeHtml(page3) },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.application.findUnique.mockResolvedValue(CHANGED_APPLICATION);
  mockDb.application.findFirst.mockResolvedValue(CHANGED_APPLICATION);
  mockDb.ctosReport.findFirst.mockResolvedValue(CHANGED_CTOS_REPORT);
  mockDb.ctosReport.findUnique.mockResolvedValue(CHANGED_CTOS_REPORT);
  mockDb.ctosReport.findMany.mockResolvedValue([CHANGED_CTOS_REPORT]);
});

describe("readProspectusNoteFinancialSnapshot", () => {
  it("returns the parsed snapshot when present", () => {
    const snapshot = noteFinancialSnapshotOf(approvedResult(), NOTE_CREATED_AT);
    expect(readProspectusNoteFinancialSnapshot({ financial_snapshot: snapshot })).toEqual(snapshot);
  });

  it.each([
    ["SQL NULL / JSON null", null],
    ["undefined", undefined],
  ])("throws 409 NOTE_FINANCIAL_SNAPSHOT_MISSING for %s", (_label, value) => {
    expect(() => readProspectusNoteFinancialSnapshot({ financial_snapshot: value })).toThrow(
      expect.objectContaining({
        statusCode: 409,
        code: "NOTE_FINANCIAL_SNAPSHOT_MISSING",
        message:
          "This note has no financial snapshot. Recreate the note from an application with an approved Financial review.",
      })
    );
  });

  it.each([
    ["wrong version", () => ({ ...noteFinancialSnapshotOf(approvedResult()), version: 1 })],
    [
      "malformed approved result",
      () => ({
        ...noteFinancialSnapshotOf(approvedResult()),
        approved_financial_result: { version: 1, years: "broken" },
      }),
    ],
    [
      "a calculated value that is not a number",
      () => {
        const snapshot = noteFinancialSnapshotOf(approvedResult());
        const year = snapshot.approved_financial_result.years[0]!;
        (year.calculated_values as Record<string, unknown>).profit_margin = "9.9";
        return snapshot;
      },
    ],
    ["a non-object value", () => "snapshot"],
  ])("throws 500 NOTE_FINANCIAL_SNAPSHOT_INVALID for %s", (_label, build) => {
    expect(() => readProspectusNoteFinancialSnapshot({ financial_snapshot: build() })).toThrow(
      expect.objectContaining({ statusCode: 500, code: "NOTE_FINANCIAL_SNAPSHOT_INVALID" })
    );
  });
});

describe("Page 2 / Page 3 loaders", () => {
  it("unpublished Note: returns the snapshot's approved result and never reads the application or CTOS", async () => {
    const snapshot = noteFinancialSnapshotOf(approvedResult(), NOTE_CREATED_AT);
    mockDb.note.findUnique.mockResolvedValue(noteRow({ financial_snapshot: snapshot }));

    const page2Data = await loadProspectusPageTwoData(mockDb as never, "note-fs-1");
    const page3Data = await loadProspectusPageThreeData(mockDb as never, "note-fs-1");

    expect(page2Data.approvedFinancialResult).toEqual(snapshot.approved_financial_result);
    expect(page3Data.approvedFinancialResult).toEqual(snapshot.approved_financial_result);
    expectNoApplicationOrCtosRead();
  });

  it.each([
    ["missing (409)", null, 409, "NOTE_FINANCIAL_SNAPSHOT_MISSING"],
    ["malformed (500)", { version: 2, captured_at: "x" }, 500, "NOTE_FINANCIAL_SNAPSHOT_INVALID"],
  ])(
    "unpublished Note with a %s snapshot: both loaders throw, no fallback read",
    async (_label, financialSnapshot, statusCode, code) => {
      mockDb.note.findUnique.mockResolvedValue(noteRow({ financial_snapshot: financialSnapshot }));

      await expect(loadProspectusPageTwoData(mockDb as never, "note-fs-1")).rejects.toMatchObject({
        statusCode,
        code,
      });
      await expect(loadProspectusPageThreeData(mockDb as never, "note-fs-1")).rejects.toMatchObject({
        statusCode,
        code,
      });
      expectNoApplicationOrCtosRead();
    }
  );

  it.each([
    ["without a financial snapshot", null],
    ["with a malformed financial snapshot", { broken: true }],
  ])("published Note %s: no financial input and no error", async (_label, financialSnapshot) => {
    mockDb.note.findUnique.mockResolvedValue(
      noteRow({
        status: NoteStatus.PUBLISHED,
        published_at: new Date("2026-10-01T00:00:00.000Z"),
        financial_snapshot: financialSnapshot,
      })
    );

    const page2Data = await loadProspectusPageTwoData(mockDb as never, "note-fs-1");
    const page3Data = await loadProspectusPageThreeData(mockDb as never, "note-fs-1");

    expect(page2Data.approvedFinancialResult).toBeNull();
    expect(page3Data.approvedFinancialResult).toBeNull();
    expectNoApplicationOrCtosRead();
  });
});

describe("snapshot isolation (application / CTOS changes after Note creation)", () => {
  it("Page 2 and Page 3 render the approved figures, not the changed application or CTOS", async () => {
    mockDb.note.findUnique.mockResolvedValue(
      noteRow({ financial_snapshot: noteFinancialSnapshotOf(approvedResult(), NOTE_CREATED_AT) })
    );

    const { page2, page3 } = await renderPages();

    expect(page2.financialComparisonSource.years.map((year) => year.year)).toEqual([2024, 2025, 2026]);
    const revenue = page2.financialComparisonMetrics.rows.find((row) => row.key === "revenue");
    expect(revenue?.values).toEqual(["9", "10", "12"]);
    expect(page3.incomeStatement.rows.find((row) => row.key === "revenue")?.values).toEqual([
      "9",
      "10",
      "12",
    ]);
    expectNoApplicationOrCtosRead();
  });

  it("the same snapshot renders identical Page 2 / Page 3 output whatever the application and CTOS hold", async () => {
    mockDb.note.findUnique.mockResolvedValue(
      noteRow({ financial_snapshot: noteFinancialSnapshotOf(approvedResult(), NOTE_CREATED_AT) })
    );
    const before = await renderPages();

    mockDb.application.findUnique.mockResolvedValue({
      ...CHANGED_APPLICATION,
      financial_statements: { unaudited_by_year: {} },
    });
    mockDb.ctosReport.findFirst.mockResolvedValue(null);
    const after = await renderPages();

    expect(after.html).toEqual(before.html);
    expectNoApplicationOrCtosRead();
  });

  it("mutating the inputs the snapshot was built from does not change the stored copy", async () => {
    const inputs = JSON.parse(JSON.stringify(APPROVED_INPUTS)) as typeof APPROVED_INPUTS;
    const snapshot = noteFinancialSnapshotOf(
      approvedFinancialResultFromInputs({ ...inputs, ref: REF }),
      NOTE_CREATED_AT
    );
    mockDb.note.findUnique.mockResolvedValue(noteRow({ financial_snapshot: snapshot }));
    const before = await renderPages();

    (inputs.financialStatements.unaudited_by_year["2026"] as Record<string, unknown>).turnover = 1;
    (inputs.ctosFinancials[1]!.account as Record<string, unknown>).turnover = 1;
    const after = await renderPages();

    expect(after.html).toEqual(before.html);
  });

  it("selects the snapshot's years on any later day (no year selection at render time)", async () => {
    mockDb.note.findUnique.mockResolvedValue(
      noteRow({ financial_snapshot: noteFinancialSnapshotOf(approvedResult(), NOTE_CREATED_AT) })
    );
    const now = await renderPages();

    jest.useFakeTimers({ now: new Date("2031-06-30T00:00:00.000Z"), doNotFake: ["nextTick", "setImmediate"] });
    try {
      const later = await renderPages();
      expect(later.page2.financialComparisonSource.years.map((year) => year.year)).toEqual(
        now.page2.financialComparisonSource.years.map((year) => year.year)
      );
      expect(later.html).toEqual(now.html);
    } finally {
      jest.useRealTimers();
    }
  });
});
