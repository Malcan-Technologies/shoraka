import type { PortalType } from "@cashsouk/types";
import { accountHref, orgHref, orgListHref } from "./admin-directory-hrefs";

describe("admin directory hrefs", () => {
  it("builds user account detail paths", () => {
    expect(accountHref("ABCDE")).toBe("/accounts/ABCDE");
  });

  it("builds issuer and investor list and detail paths", () => {
    expect(orgListHref("issuer")).toBe("/issuers");
    expect(orgListHref("investor")).toBe("/investors");
    expect(orgHref("issuer", "org-1")).toBe("/issuers/org-1");
    expect(orgHref("investor", "org-2")).toBe("/investors/org-2");
  });

  it("encodes ids in detail paths", () => {
    expect(accountHref("A B")).toBe("/accounts/A%20B");
    expect(orgHref("issuer" as PortalType, "a/b")).toBe("/issuers/a%2Fb");
  });
});
