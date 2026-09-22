import { changePasswordSchema, createAdminUserSchema } from "./schemas";
import { PASSWORD_POLICY_MESSAGE } from "@cashsouk/types";

describe("auth password schemas", () => {
  it("accepts a strong new password", () => {
    const parsed = changePasswordSchema.parse({
      currentPassword: "old-secret",
      newPassword: "Tr0ub4dor&3",
    });
    expect(parsed.newPassword).toBe("Tr0ub4dor&3");
  });

  it("rejects common and incomplete passwords", () => {
    const weak = changePasswordSchema.safeParse({
      currentPassword: "old-secret",
      newPassword: "Password1!",
    });
    expect(weak.success).toBe(false);
    if (!weak.success) {
      expect(weak.error.issues[0]?.message).toBe(PASSWORD_POLICY_MESSAGE);
    }

    const temp = createAdminUserSchema.safeParse({
      email: "admin@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      tempPassword: "welcome1",
    });
    expect(temp.success).toBe(false);
  });
});
