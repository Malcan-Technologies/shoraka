import { COMPANY, companyCopyrightLine, companyTelHref } from "./company";

describe("company identity", () => {
  it("keeps the public company facts used in footers", () => {
    expect(COMPANY.legalName).toBe("Shoraka Global Resources Sdn. Bhd.");
    expect(COMPANY.registrationNumber).toBe("201501030089 (1155412-V)");
    expect(COMPANY.email).toBe("enquiry@cashsouk.com");
    expect(COMPANY.phone).toBe("03-2708 8100");
    expect(COMPANY.address).toContain("Wisma Mont Kiara");
    expect(companyTelHref()).toBe("tel:+60327088100");
    expect(companyCopyrightLine(new Date("2026-09-14T00:00:00.000Z"))).toBe(
      "Copyright © 2026 Shoraka Global Resources Sdn. Bhd. (Registration No. 201501030089 (1155412-V)). All Rights Reserved."
    );
    expect(companyCopyrightLine()).toContain(`Copyright © ${new Date().getFullYear()}`);
  });
});
