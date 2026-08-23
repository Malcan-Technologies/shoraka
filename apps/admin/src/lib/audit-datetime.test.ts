import { formatAuditDateTime } from "./audit-datetime";

describe("formatAuditDateTime", () => {
  it("returns an em dash for empty values", () => {
    expect(formatAuditDateTime(null)).toBe("—");
    expect(formatAuditDateTime(undefined)).toBe("—");
    expect(formatAuditDateTime("")).toBe("—");
  });

  it("formats a valid ISO timestamp in en-MY", () => {
    const formatted = formatAuditDateTime("2026-08-16T08:30:00.000Z");
    expect(formatted).not.toBe("—");
    expect(formatted).toMatch(/2026/);
  });

  it("can include seconds for detail views", () => {
    const formatted = formatAuditDateTime("2026-08-16T08:30:45.000Z", { seconds: true });
    expect(formatted).toMatch(/2026/);
  });
});
