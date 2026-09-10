/**
 * @jest-environment node
 */
import { renderToStaticMarkup } from "react-dom/server";
import { PortalBadge } from "./portal-badge";

describe("PortalBadge", () => {
  it("uses investor brown and issuer red", () => {
    const investor = renderToStaticMarkup(<PortalBadge portal="investor" />);
    const issuer = renderToStaticMarkup(<PortalBadge portal="issuer" />);
    expect(investor).toContain("bg-portal-investor-bg");
    expect(investor).toContain("text-portal-investor-text");
    expect(issuer).toContain("bg-portal-issuer-bg");
    expect(issuer).toContain("text-portal-issuer-text");
  });
});
