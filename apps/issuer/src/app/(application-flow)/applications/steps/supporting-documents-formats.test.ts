import { formatIssuerAllowedTypesHint, formatIssuerAllowedTypesLabel } from "./supporting-documents-formats";

describe("supporting document accepted formats", () => {
  it("labels PDF and Excel with their extensions", () => {
    expect(formatIssuerAllowedTypesLabel(["pdf"])).toBe("PDF (.pdf)");
    expect(formatIssuerAllowedTypesLabel(["excel"])).toBe("Excel (.xlsx, .xls)");
    expect(formatIssuerAllowedTypesLabel(["pdf", "excel"])).toBe("PDF (.pdf) or Excel (.xlsx, .xls)");
  });

  it("defaults to PDF when no types are configured", () => {
    expect(formatIssuerAllowedTypesLabel([])).toBe("PDF (.pdf)");
    expect(formatIssuerAllowedTypesHint(["excel"])).toBe("Accepted: Excel (.xlsx, .xls)");
  });
});
