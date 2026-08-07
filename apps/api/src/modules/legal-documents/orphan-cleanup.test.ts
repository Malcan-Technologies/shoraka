import {
  assertDestructiveCleanupAllowed,
  assertLegalDocumentCleanupPrefix,
  DEFAULT_LEGAL_ORPHAN_MIN_AGE_MS,
  deleteLegalDocumentOrphanCandidates,
  parseCleanupCliArgs,
  selectLegalDocumentOrphanCandidates,
} from "./orphan-cleanup";
import { LEGAL_DOCUMENT_S3_PREFIX } from "../../lib/s3/legal-document-object";

describe("selectLegalDocumentOrphanCandidates", () => {
  const now = new Date("2026-08-07T00:00:00.000Z");

  it("keeps referenced object and skips outside-prefix keys", () => {
    const candidates = selectLegalDocumentOrphanCandidates({
      now,
      minAgeMs: 0,
      referencedKeys: ["legal-documents/keep.pdf"],
      listedKeys: [
        { key: "legal-documents/keep.pdf", lastModified: new Date("2026-01-01") },
        { key: "legal-documents/orphan.pdf", lastModified: new Date("2026-01-01") },
        { key: "other/orphan.pdf", lastModified: new Date("2026-01-01") },
      ],
    });
    expect(candidates.map((c) => c.key)).toEqual(["legal-documents/orphan.pdf"]);
  });

  it("selects unreferenced old object and skips recent object", () => {
    const candidates = selectLegalDocumentOrphanCandidates({
      now,
      minAgeMs: DEFAULT_LEGAL_ORPHAN_MIN_AGE_MS,
      referencedKeys: [],
      listedKeys: [
        {
          key: "legal-documents/new.pdf",
          lastModified: new Date("2026-08-06T20:00:00.000Z"),
        },
        {
          key: "legal-documents/old.pdf",
          lastModified: new Date("2026-08-01T00:00:00.000Z"),
        },
      ],
    });
    expect(candidates.map((c) => c.key)).toEqual(["legal-documents/old.pdf"]);
  });

  it("skips missing LastModified (fail closed for age)", () => {
    const candidates = selectLegalDocumentOrphanCandidates({
      now,
      minAgeMs: 0,
      referencedKeys: [],
      listedKeys: [
        { key: "legal-documents/no-date.pdf", lastModified: null },
        { key: "legal-documents/dated.pdf", lastModified: new Date("2026-01-01") },
      ],
    });
    expect(candidates.map((c) => c.key)).toEqual(["legal-documents/dated.pdf"]);
  });

  it("protects shared/historical keys via exact referenced set", () => {
    const shared = "legal-documents/shared.pdf";
    const candidates = selectLegalDocumentOrphanCandidates({
      now,
      minAgeMs: 0,
      referencedKeys: [shared, shared],
      listedKeys: [
        { key: shared, lastModified: new Date("2026-01-01") },
        { key: "legal-documents/orphan.pdf", lastModified: new Date("2026-01-01") },
      ],
    });
    expect(candidates.map((c) => c.key)).toEqual(["legal-documents/orphan.pdf"]);
  });

  it("fails closed on empty or invalid prefix", () => {
    expect(() => assertLegalDocumentCleanupPrefix("")).toThrow(/PREFIX_INVALID/);
    expect(() => assertLegalDocumentCleanupPrefix("legal-documents")).toThrow(/end with/);
    expect(() => assertLegalDocumentCleanupPrefix("../evil/")).toThrow(/PREFIX_INVALID/);
    expect(assertLegalDocumentCleanupPrefix(LEGAL_DOCUMENT_S3_PREFIX)).toBe(
      LEGAL_DOCUMENT_S3_PREFIX
    );
  });
});

describe("parseCleanupCliArgs / production guard", () => {
  it("enables delete only for exact --delete token", () => {
    expect(parseCleanupCliArgs(["node", "script"]).doDelete).toBe(false);
    expect(parseCleanupCliArgs(["node", "script", "--delete-all"]).doDelete).toBe(false);
    expect(parseCleanupCliArgs(["node", "script", "--delete"]).doDelete).toBe(true);
    expect(
      parseCleanupCliArgs(["node", "script", "--delete", "--confirm-production"])
        .confirmProduction
    ).toBe(true);
    expect(parseCleanupCliArgs(["node", "script", "--min-age-hours=0"]).minAgeHours).toBe(0);
  });

  it("refuses production-like destructive runs without confirm flag", () => {
    expect(() =>
      assertDestructiveCleanupAllowed({
        doDelete: true,
        confirmProduction: false,
        nodeEnv: "production",
        bucket: "dev-bucket",
      })
    ).toThrow(/confirm-production/);

    expect(() =>
      assertDestructiveCleanupAllowed({
        doDelete: true,
        confirmProduction: false,
        nodeEnv: "development",
        bucket: "cashsouk-prod",
      })
    ).toThrow(/confirm-production/);

    expect(() =>
      assertDestructiveCleanupAllowed({
        doDelete: true,
        confirmProduction: true,
        nodeEnv: "production",
        bucket: "cashsouk-prod",
      })
    ).not.toThrow();

    expect(() =>
      assertDestructiveCleanupAllowed({
        doDelete: false,
        confirmProduction: false,
        nodeEnv: "production",
        bucket: "cashsouk-prod",
      })
    ).not.toThrow();
  });
});

describe("deleteLegalDocumentOrphanCandidates", () => {
  it("dry-run path is selection-only (zero deletes when not called)", () => {
    const listed = [
      { key: "legal-documents/a.pdf", lastModified: new Date("2026-01-01"), size: 10 },
    ];
    const candidates = selectLegalDocumentOrphanCandidates({
      now: new Date("2026-08-07T00:00:00.000Z"),
      minAgeMs: 0,
      referencedKeys: [],
      listedKeys: listed,
    });
    expect(candidates).toHaveLength(1);
  });

  it("re-checks references before delete and skips newly referenced keys", async () => {
    const deleteObject = jest.fn(async () => undefined);
    const isReferenced = jest
      .fn()
      .mockResolvedValueOnce(true) // became referenced after scan
      .mockResolvedValueOnce(false);

    const result = await deleteLegalDocumentOrphanCandidates({
      candidates: [
        { key: "legal-documents/race.pdf", lastModified: new Date("2026-01-01"), size: 1 },
        { key: "legal-documents/orphan.pdf", lastModified: new Date("2026-01-01"), size: 1 },
      ],
      isReferenced,
      deleteObject,
    });

    expect(result).toEqual({
      deleted: 1,
      failed: 0,
      skippedReferenced: 1,
      skippedInvalidPrefix: 0,
    });
    expect(deleteObject).toHaveBeenCalledTimes(1);
    expect(deleteObject).toHaveBeenCalledWith("legal-documents/orphan.pdf");
  });

  it("continues when one delete fails", async () => {
    const deleteObject = jest
      .fn()
      .mockRejectedValueOnce(new Error("s3 down"))
      .mockResolvedValueOnce(undefined);

    const result = await deleteLegalDocumentOrphanCandidates({
      candidates: [
        { key: "legal-documents/a.pdf", lastModified: new Date("2026-01-01"), size: 1 },
        { key: "legal-documents/b.pdf", lastModified: new Date("2026-01-01"), size: 1 },
      ],
      isReferenced: async () => false,
      deleteObject,
    });

    expect(result.deleted).toBe(1);
    expect(result.failed).toBe(1);
  });

  it("skips keys outside prefix at delete time", async () => {
    const deleteObject = jest.fn(async () => undefined);
    const result = await deleteLegalDocumentOrphanCandidates({
      candidates: [
        { key: "evil/outside.pdf", lastModified: new Date("2026-01-01"), size: 1 },
      ],
      isReferenced: async () => false,
      deleteObject,
    });
    expect(result.skippedInvalidPrefix).toBe(1);
    expect(deleteObject).not.toHaveBeenCalled();
  });
});
