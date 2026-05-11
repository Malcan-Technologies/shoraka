import { isRegtankAmendmentInProgress } from "./is-regtank-amendment-in-progress";

describe("isRegtankAmendmentInProgress", () => {
  it("returns false for URL_GENERATED -> WAIT_FOR_APPROVAL", () => {
    expect(
      isRegtankAmendmentInProgress([
        { status: "URL_GENERATED", timestamp: "2026-01-01T00:00:00.000Z" },
        { status: "WAIT_FOR_APPROVAL", timestamp: "2026-01-02T00:00:00.000Z" },
      ])
    ).toBe(false);
  });

  it("returns true for URL_GENERATED -> WAIT_FOR_APPROVAL -> URL_GENERATED", () => {
    expect(
      isRegtankAmendmentInProgress([
        { status: "URL_GENERATED", timestamp: "2026-01-01T00:00:00.000Z" },
        { status: "WAIT_FOR_APPROVAL", timestamp: "2026-01-02T00:00:00.000Z" },
        { status: "URL_GENERATED", timestamp: "2026-01-03T00:00:00.000Z" },
      ])
    ).toBe(true);
  });

  it("returns false for URL_GENERATED -> WAIT_FOR_APPROVAL -> URL_GENERATED -> WAIT_FOR_APPROVAL", () => {
    expect(
      isRegtankAmendmentInProgress([
        { status: "URL_GENERATED", timestamp: "2026-01-01T00:00:00.000Z" },
        { status: "WAIT_FOR_APPROVAL", timestamp: "2026-01-02T00:00:00.000Z" },
        { status: "URL_GENERATED", timestamp: "2026-01-03T00:00:00.000Z" },
        { status: "WAIT_FOR_APPROVAL", timestamp: "2026-01-04T00:00:00.000Z" },
      ])
    ).toBe(false);
  });

  it("returns false for URL_GENERATED only (no WAIT_FOR_APPROVAL seen)", () => {
    expect(
      isRegtankAmendmentInProgress([
        { status: "URL_GENERATED", timestamp: "2026-01-01T00:00:00.000Z" },
      ])
    ).toBe(false);
  });

  it("parses JSON-string payload items and ignores invalid payloads", () => {
    expect(
      isRegtankAmendmentInProgress([
        { status: "URL_GENERATED", timestamp: "2026-01-01T00:00:00.000Z" },
        JSON.stringify({ status: "WAIT_FOR_APPROVAL", timestamp: "2026-01-02T00:00:00.000Z" }),
        "not-json",
        JSON.stringify({ status: "URL_GENERATED", timestamp: "2026-01-03T00:00:00.000Z" }),
      ])
    ).toBe(true);
  });

  it("sorts by timestamp when all entries have valid timestamps", () => {
    // Provided in reverse order, but timestamps indicate correct meaning order.
    expect(
      isRegtankAmendmentInProgress([
        { status: "URL_GENERATED", timestamp: "2026-01-03T00:00:00.000Z" },
        { status: "WAIT_FOR_APPROVAL", timestamp: "2026-01-02T00:00:00.000Z" },
        { status: "URL_GENERATED", timestamp: "2026-01-01T00:00:00.000Z" },
      ])
    ).toBe(true);
  });

  it("preserves array order when any timestamp is missing", () => {
    // If we sorted by timestamp, this would likely match "in progress".
    // But because timestamp is missing on one item, we keep input order:
    // URL_GENERATED, WAIT_FOR_APPROVAL, (URL_GENERATED missing timestamp) => latest meaningful
    // meaningful last would be URL_GENERATED (missing ts), but WAIT exists before => true.
    // Flip order to ensure we get false.
    expect(
      isRegtankAmendmentInProgress([
        { status: "URL_GENERATED", timestamp: "2026-01-03T00:00:00.000Z" },
        { status: "URL_GENERATED" }, // missing timestamp -> keep input order
        { status: "WAIT_FOR_APPROVAL", timestamp: "2026-01-02T00:00:00.000Z" },
      ])
    ).toBe(false);
  });
});

