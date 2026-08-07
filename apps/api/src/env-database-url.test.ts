import { readFileSync } from "fs";
import { join } from "path";

describe("apps/api/.env DATABASE_URL uniqueness", () => {
  it("has exactly one active DATABASE_URL declaration", () => {
    const envPath = join(__dirname, "../.env");
    const text = readFileSync(envPath, "utf8");
    const active = text.split(/\r?\n/).filter((line) => line.startsWith("DATABASE_URL="));
    expect(active).toHaveLength(1);
    // Never assert on password; only host/db shape after redaction.
    const redacted = active[0].replace(/:[^:@/]+@/, ":***@");
    expect(redacted).toMatch(/^DATABASE_URL=.*@localhost:5432\/cashsouk_dev/);
  });
});
