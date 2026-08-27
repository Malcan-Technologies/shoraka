import { detectClientPortalFromLocation } from "./detect-client-portal";

describe("detectClientPortalFromLocation", () => {
  it("maps production hostnames", () => {
    expect(
      detectClientPortalFromLocation({ hostname: "investor.cashsouk.com", port: "" })
    ).toBe("investor");
    expect(detectClientPortalFromLocation({ hostname: "issuer.cashsouk.com", port: "443" })).toBe(
      "issuer"
    );
    expect(detectClientPortalFromLocation({ hostname: "admin.cashsouk.com", port: "" })).toBe(
      "admin"
    );
  });

  it("maps local portal ports and not landing", () => {
    expect(detectClientPortalFromLocation({ hostname: "localhost", port: "3002" })).toBe(
      "investor"
    );
    expect(detectClientPortalFromLocation({ hostname: "localhost", port: "3001" })).toBe("issuer");
    expect(detectClientPortalFromLocation({ hostname: "localhost", port: "3003" })).toBe("admin");
    expect(detectClientPortalFromLocation({ hostname: "localhost", port: "3000" })).toBeNull();
    expect(detectClientPortalFromLocation({ hostname: "www.cashsouk.com", port: "" })).toBeNull();
  });
});
