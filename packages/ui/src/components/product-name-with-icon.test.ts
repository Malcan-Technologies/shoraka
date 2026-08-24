import {
  resolveProductIconKind,
  resolveProductImageS3KeyFromSnapshot,
  resolveProductImageS3KeyFromWorkflow,
} from "@cashsouk/types";

describe("resolveProductIconKind", () => {
  it("maps account receivable product titles to the receivable icon", () => {
    expect(resolveProductIconKind("Account Receivable (AR) Financing")).toBe("receivable");
    expect(resolveProductIconKind("Accounts Receivable Financing-i")).toBe("receivable");
    expect(resolveProductIconKind("Invoice financing")).toBe("receivable");
    expect(resolveProductIconKind(null, "invoice_financing")).toBe("receivable");
  });

  it("maps facility product titles to the facility icon", () => {
    expect(resolveProductIconKind("Facility financing")).toBe("facility");
    expect(resolveProductIconKind("Master facility", "contract")).toBe("facility");
  });

  it("falls back to generic when the product is unnamed or unknown", () => {
    expect(resolveProductIconKind(null, null)).toBe("generic");
    expect(resolveProductIconKind("Working capital")).toBe("generic");
  });
});

describe("resolveProductImageS3KeyFromWorkflow", () => {
  it("reads the financing-type catalog image used on the application wizard", () => {
    expect(
      resolveProductImageS3KeyFromWorkflow([
        {
          id: "financing_type",
          name: "Financing Type",
          config: {
            name: "Account Receivable (AR) Financing",
            image: { s3_key: "products/ar-financing.png" },
          },
        },
      ])
    ).toBe("products/ar-financing.png");
  });

  it("ignores keys that are not product catalog uploads", () => {
    expect(
      resolveProductImageS3KeyFromWorkflow([
        { id: "financing_type", config: { s3_key: "applications/app-1/file.png" } },
      ])
    ).toBeNull();
  });
});

describe("resolveProductImageS3KeyFromSnapshot", () => {
  it("reads the frozen image_s3_key", () => {
    expect(resolveProductImageS3KeyFromSnapshot({ image_s3_key: "products/ar.png" })).toBe(
      "products/ar.png"
    );
  });
});
