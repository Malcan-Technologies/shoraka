import { format } from "date-fns";
import {
  formatTrusteeInstructionEmailedAt,
  formatTrusteeInstructionEmailedCopy,
} from "./trustee-letter-sent-state";

describe("trustee letter sent state", () => {
  it("returns null when email was not sent", () => {
    expect(formatTrusteeInstructionEmailedCopy(null)).toBeNull();
    expect(formatTrusteeInstructionEmailedCopy(undefined)).toBeNull();
    expect(formatTrusteeInstructionEmailedCopy("")).toBeNull();
    expect(formatTrusteeInstructionEmailedAt(null)).toBeNull();
  });

  it("formats a sent-at timestamp without claiming email on empty values", () => {
    const sentAt = "2026-08-24T04:30:00.000Z";
    const formatted = format(new Date(sentAt), "dd MMM yyyy, h:mm a");
    expect(formatTrusteeInstructionEmailedCopy(sentAt)).toBe(
      `Email delivered to Trustee on ${formatted}`
    );
    expect(formatTrusteeInstructionEmailedAt(sentAt)).toBe(formatted);
    expect(formatTrusteeInstructionEmailedCopy("not-a-date")).toBeNull();
  });
});
