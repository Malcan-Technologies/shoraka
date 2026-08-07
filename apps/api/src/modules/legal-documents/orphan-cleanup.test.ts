import { selectLegalDocumentOrphanCandidates } from "./orphan-cleanup";

describe("selectLegalDocumentOrphanCandidates", () => {
  const now = new Date("2026-08-07T00:00:00.000Z");

  it("keeps referenced keys and non-prefix keys", () => {
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

  it("respects minimum age", () => {
    const candidates = selectLegalDocumentOrphanCandidates({
      now,
      minAgeMs: 24 * 60 * 60 * 1000,
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

  it("defaults to dry-run selection without mutation", () => {
    const listed = [
      { key: "legal-documents/a.pdf", lastModified: new Date("2026-01-01"), size: 10 },
    ];
    const first = selectLegalDocumentOrphanCandidates({
      now,
      minAgeMs: 0,
      referencedKeys: [],
      listedKeys: listed,
    });
    const second = selectLegalDocumentOrphanCandidates({
      now,
      minAgeMs: 0,
      referencedKeys: [],
      listedKeys: listed,
    });
    expect(first).toEqual(second);
  });
});
