import { ZodError } from "zod";
import { formatZodMessage } from "../../lib/http/error-handler";
import { operatorProfilePatchSchema, orgMasterPatchSchema } from "./schemas";
import { updateOrganizationProfileSchema } from "../organization/schemas";

describe("secondary-onboarding phone schemas", () => {
  it("CASE D: stores a local Malaysian number as E.164 on the operator profile", () => {
    const parsed = operatorProfilePatchSchema.parse({ responsiblePersonPhone: "0182316817" });
    expect(parsed.responsiblePersonPhone).toBe("+60182316817");
  });

  it("CASE E: keeps an international E.164 number", () => {
    const parsed = operatorProfilePatchSchema.parse({ responsiblePersonPhone: "+447911123456" });
    expect(parsed.responsiblePersonPhone).toBe("+447911123456");
  });

  it("CASE G: operator contact number errors do not include the API field name", () => {
    const result = operatorProfilePatchSchema.safeParse({ responsiblePersonPhone: "not-a-phone" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(formatZodMessage(result.error)).toBe("Enter a valid contact number.");
    expect(formatZodMessage(result.error)).not.toMatch(/responsiblePersonPhone/);
  });

  it("normalizes issuer company phone the same way", () => {
    const parsed = orgMasterPatchSchema.parse({ phoneNumber: "0182316817" });
    expect(parsed.phoneNumber).toBe("+60182316817");
  });

  it("normalizes organization profile and PIC contact numbers", () => {
    const org = updateOrganizationProfileSchema.parse({ phoneNumber: "0182316817" });
    expect(org.phoneNumber).toBe("+60182316817");
    const pic = updateOrganizationProfileSchema.parse({
      contactPerson: { contact: "0182316817", email: "ops@acme.test" },
    });
    expect(pic.contactPerson?.contact).toBe("+60182316817");
  });
});

describe("formatZodMessage field paths", () => {
  it("does not prefix the first Zod path onto a human message", () => {
    const err = new ZodError([
      { code: "custom", path: ["responsiblePersonPhone"], message: "Enter a valid phone number." },
    ]);
    expect(formatZodMessage(err)).toBe("Enter a valid contact number.");
  });
});
