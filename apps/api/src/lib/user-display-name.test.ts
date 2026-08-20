import { formatUserDisplayName } from "./user-display-name";

describe("formatUserDisplayName", () => {
  it("prefers a full name, then email, and skips blanks", () => {
    expect(
      formatUserDisplayName({ first_name: "Ada", last_name: "Admin", email: "ada@cashsouk.com" })
    ).toBe("Ada Admin");
    expect(
      formatUserDisplayName({ first_name: "  ", last_name: null, email: "ops@cashsouk.com" })
    ).toBe("ops@cashsouk.com");
    expect(formatUserDisplayName({ first_name: "", last_name: "", email: "" })).toBeNull();
    expect(formatUserDisplayName(null)).toBeNull();
  });
});
