import {
  classifyNoteFinancialSnapshotBackfill,
  parseBackfillCliArgs,
  type NoteFinancialSnapshotBackfillFacts,
  type NoteFingerprintCheck,
} from "./note-financial-snapshot-backfill";

const NOTE_CREATED_AT = new Date("2026-03-01T00:00:00.000Z");

const VALID_SNAPSHOT = {
  version: 1,
  captured_at: NOTE_CREATED_AT.toISOString(),
  reference_date: "2026-02-01T00:00:00.000Z",
  financial_statements: null,
  ctos: null,
  source: {
    application_id: "app_1",
    review_cycle: 1,
    application_submitted_at: "2026-02-01T00:00:00.000Z",
    financial_review: { status: "APPROVED", reviewed_at: null, reviewer_user_id: null },
  },
};

function facts(
  overrides: {
    note?: Partial<NoteFinancialSnapshotBackfillFacts["note"]>;
    review?: NoteFinancialSnapshotBackfillFacts["review"];
    fingerprint?: NoteFingerprintCheck | null;
    sourceApplication?: NoteFinancialSnapshotBackfillFacts["sourceApplication"];
  } = {}
): NoteFinancialSnapshotBackfillFacts {
  return {
    note: {
      id: "note_1",
      sourceApplicationId: "app_1",
      status: "DRAFT",
      publishedAt: null,
      createdAt: NOTE_CREATED_AT,
      financialSnapshot: null,
      ...overrides.note,
    },
    review: overrides.review === undefined ? null : overrides.review,
    fingerprint: overrides.fingerprint === undefined ? null : overrides.fingerprint,
    sourceApplication:
      overrides.sourceApplication === undefined
        ? {
            status: "COMPLETED",
            financialReviewStatus: "APPROVED",
            financialReviewedAt: new Date("2026-02-15T00:00:00.000Z"),
          }
        : overrides.sourceApplication,
  };
}

const MATCHING: NoteFingerprintCheck = {
  kind: "COMPUTED",
  storedFingerprint: "abc",
  currentFingerprint: "abc",
};
const MISMATCHING: NoteFingerprintCheck = {
  kind: "COMPUTED",
  storedFingerprint: "abc",
  currentFingerprint: "def",
};

describe("classifyNoteFinancialSnapshotBackfill", () => {
  it("returns HAS_SNAPSHOT for a valid snapshot, not eligible", () => {
    const result = classifyNoteFinancialSnapshotBackfill(
      facts({ note: { financialSnapshot: VALID_SNAPSHOT } })
    );
    expect(result.classification).toBe("HAS_SNAPSHOT");
    expect(result.eligibleForBackfill).toBe(false);
    expect(result.sourceDrift).toBeNull();
  });

  it("flags a valid snapshot that references another application, still HAS_SNAPSHOT", () => {
    const result = classifyNoteFinancialSnapshotBackfill(
      facts({ note: { financialSnapshot: VALID_SNAPSHOT, sourceApplicationId: "app_other" } })
    );
    expect(result.classification).toBe("HAS_SNAPSHOT");
    expect(result.eligibleForBackfill).toBe(false);
    expect(result.reason).toMatch(/different|differs/);
  });

  it("classifies no review row, unpublished, final source as A and eligible", () => {
    const result = classifyNoteFinancialSnapshotBackfill(facts());
    expect(result.classification).toBe("A_NO_APPROVED_PROSPECTUS");
    expect(result.sourceDrift).toBeNull();
    expect(result.blockers).toEqual([]);
    expect(result.eligibleForBackfill).toBe(true);
  });

  it.each(["DRAFT", "READY_FOR_REVIEW", "SUPERSEDED"])(
    "classifies a %s review on an unpublished Note as A and eligible",
    (status) => {
      const result = classifyNoteFinancialSnapshotBackfill(facts({ review: { status } }));
      expect(result.classification).toBe("A_NO_APPROVED_PROSPECTUS");
      expect(result.eligibleForBackfill).toBe(true);
    }
  );

  it("treats an unpublished leftover (published_at set, status DRAFT) as not published", () => {
    const result = classifyNoteFinancialSnapshotBackfill(
      facts({ note: { status: "DRAFT", publishedAt: new Date() }, review: { status: "DRAFT" } })
    );
    expect(result.classification).toBe("A_NO_APPROVED_PROSPECTUS");
  });

  it("blocks A when the source application is missing", () => {
    const result = classifyNoteFinancialSnapshotBackfill(facts({ sourceApplication: null }));
    expect(result.classification).toBe("A_NO_APPROVED_PROSPECTUS");
    expect(result.eligibleForBackfill).toBe(false);
    expect(result.blockers).toEqual(["SOURCE_APPLICATION_MISSING"]);
    expect(result.reason).toMatch(/Source application not found/);
  });

  it("blocks A when the source application is not COMPLETED", () => {
    const result = classifyNoteFinancialSnapshotBackfill(
      facts({
        sourceApplication: {
          status: "UNDER_REVIEW",
          financialReviewStatus: "APPROVED",
          financialReviewedAt: null,
        },
      })
    );
    expect(result.eligibleForBackfill).toBe(false);
    expect(result.blockers).toEqual(["SOURCE_APPLICATION_NOT_COMPLETED"]);
    expect(result.reason).toMatch(/UNDER_REVIEW, not COMPLETED/);
  });

  it.each([null, "PENDING", "AMENDMENT_REQUESTED"])(
    "blocks A when the Financial review is %s",
    (financialReviewStatus) => {
      const result = classifyNoteFinancialSnapshotBackfill(
        facts({
          sourceApplication: {
            status: "COMPLETED",
            financialReviewStatus,
            financialReviewedAt: null,
          },
        })
      );
      expect(result.eligibleForBackfill).toBe(false);
      expect(result.blockers).toEqual(["FINANCIAL_REVIEW_NOT_APPROVED"]);
      expect(result.reason).toMatch(/not APPROVED/);
    }
  );

  it("blocks A when the Financial review was approved after the Note was created", () => {
    const result = classifyNoteFinancialSnapshotBackfill(
      facts({
        sourceApplication: {
          status: "COMPLETED",
          financialReviewStatus: "APPROVED",
          financialReviewedAt: new Date("2026-03-02T00:00:00.000Z"),
        },
      })
    );
    expect(result.eligibleForBackfill).toBe(false);
    expect(result.blockers).toEqual(["FINANCIAL_REVIEWED_AFTER_NOTE_CREATED"]);
  });

  it.each(["APPROVED", "READY_FOR_PUBLISH"])(
    "classifies a %s review with matching fingerprint as B + D, not eligible",
    (status) => {
      const result = classifyNoteFinancialSnapshotBackfill(
        facts({ review: { status }, fingerprint: MATCHING })
      );
      expect(result.classification).toBe("B_APPROVED_PROSPECTUS");
      expect(result.sourceDrift).toBe("D_SOURCES_UNCHANGED");
      expect(result.eligibleForBackfill).toBe(false);
      expect(result.reason).toMatch(/legacy path/);
    }
  );

  it("classifies an approved review with mismatching fingerprint as B + E with the defect caveat", () => {
    const result = classifyNoteFinancialSnapshotBackfill(
      facts({ review: { status: "APPROVED" }, fingerprint: MISMATCHING })
    );
    expect(result.classification).toBe("B_APPROVED_PROSPECTUS");
    expect(result.sourceDrift).toBe("E_SOURCES_MAY_HAVE_CHANGED");
    expect(result.eligibleForBackfill).toBe(false);
    expect(result.reason).toMatch(/differs from the stored one/);
    expect(result.reason).toMatch(/number-storage defect/);
    expect(result.reason).toMatch(/cannot be reconstructed/);
  });

  it.each<[string, NoteFingerprintCheck | null, RegExp]>([
    ["missing inputs", { kind: "MISSING_INPUTS", missing: ["approved_snapshot"] }, /missing approved_snapshot/],
    [
      "missing content and fingerprint",
      { kind: "MISSING_INPUTS", missing: ["approved_content", "render_fingerprint"] },
      /missing approved_content, render_fingerprint/,
    ],
    ["inconsistent stored fingerprint", { kind: "STORED_FINGERPRINT_INCONSISTENT" }, /cannot be trusted/],
    ["recompute failure", { kind: "RECOMPUTE_FAILED", error: "Error: boom" }, /recompute failed \(Error: boom\)/],
    ["no check supplied", null, /not checked/],
  ])("classifies an approved review with %s as B + E", (_label, fingerprint, reasonPattern) => {
    const result = classifyNoteFinancialSnapshotBackfill(
      facts({ review: { status: "READY_FOR_PUBLISH" }, fingerprint })
    );
    expect(result.classification).toBe("B_APPROVED_PROSPECTUS");
    expect(result.sourceDrift).toBe("E_SOURCES_MAY_HAVE_CHANGED");
    expect(result.eligibleForBackfill).toBe(false);
    expect(result.reason).toMatch(reasonPattern);
  });

  it("treats an unrecognised review status as approved and never eligible", () => {
    const result = classifyNoteFinancialSnapshotBackfill(
      facts({ review: { status: "SOMETHING_NEW" }, fingerprint: MATCHING })
    );
    expect(result.classification).toBe("B_APPROVED_PROSPECTUS");
    expect(result.eligibleForBackfill).toBe(false);
    expect(result.reason).toMatch(/unrecognised status/);
  });

  it.each<[string, NoteFingerprintCheck, string]>([
    ["matching", MATCHING, "D_SOURCES_UNCHANGED"],
    ["mismatching", MISMATCHING, "E_SOURCES_MAY_HAVE_CHANGED"],
  ])("classifies a published Note with %s fingerprint as C, not eligible", (_l, fp, drift) => {
    const result = classifyNoteFinancialSnapshotBackfill(
      facts({
        note: { status: "PUBLISHED", publishedAt: new Date("2026-03-05T00:00:00.000Z") },
        review: { status: "APPROVED" },
        fingerprint: fp,
      })
    );
    expect(result.classification).toBe("C_PUBLISHED_PROSPECTUS");
    expect(result.sourceDrift).toBe(drift);
    expect(result.eligibleForBackfill).toBe(false);
  });

  it("classifies a PUBLISHED review as C even when the Note is not listed", () => {
    const result = classifyNoteFinancialSnapshotBackfill(
      facts({ review: { status: "PUBLISHED" }, fingerprint: MATCHING })
    );
    expect(result.classification).toBe("C_PUBLISHED_PROSPECTUS");
    expect(result.eligibleForBackfill).toBe(false);
  });

  it("classifies a published Note with no review row as C + E", () => {
    const result = classifyNoteFinancialSnapshotBackfill(
      facts({
        note: { status: "FUNDING", publishedAt: new Date("2026-03-05T00:00:00.000Z") },
        fingerprint: { kind: "MISSING_INPUTS", missing: ["approved_snapshot", "approved_content"] },
      })
    );
    expect(result.classification).toBe("C_PUBLISHED_PROSPECTUS");
    expect(result.sourceDrift).toBe("E_SOURCES_MAY_HAVE_CHANGED");
    expect(result.eligibleForBackfill).toBe(false);
  });

  it.each([
    ["wrong version", { ...VALID_SNAPSHOT, version: 2 }],
    ["not an object", "garbage"],
    ["missing source", { ...VALID_SNAPSHOT, source: null }],
  ])("treats a malformed snapshot (%s) as no snapshot, says so, and never marks it eligible", (_l, value) => {
    const result = classifyNoteFinancialSnapshotBackfill(facts({ note: { financialSnapshot: value } }));
    expect(result.classification).toBe("A_NO_APPROVED_PROSPECTUS");
    expect(result.blockers).toContain("MALFORMED_SNAPSHOT_PRESENT");
    expect(result.reason).toMatch(/malformed; treated as no snapshot/);
    expect(result.eligibleForBackfill).toBe(false);
  });
});

describe("parseBackfillCliArgs", () => {
  it("defaults to dry-run", () => {
    expect(parseBackfillCliArgs([])).toEqual({
      ok: true,
      options: { mode: "dry-run", json: false, noteId: null },
    });
  });

  it("applies only with both flags", () => {
    const result = parseBackfillCliArgs(["--apply", "--confirm-class-a-only"]);
    expect(result).toEqual({ ok: true, options: { mode: "apply", json: false, noteId: null } });
  });

  it.each([["--apply"], ["--confirm-class-a-only"]])("rejects %s on its own", (flag) => {
    const result = parseBackfillCliArgs([flag]);
    expect(result.ok).toBe(false);
  });

  it("parses --json, --note and a pnpm pass-through separator", () => {
    expect(parseBackfillCliArgs(["--", "--json", "--note", "note_9"])).toEqual({
      ok: true,
      options: { mode: "dry-run", json: true, noteId: "note_9" },
    });
  });

  it.each([[["--note"]], [["--note", "--json"]], [["--aply"]], [["--json", "--json"]]])(
    "rejects invalid arguments %j",
    (argv) => {
      expect(parseBackfillCliArgs(argv).ok).toBe(false);
    }
  );
});
