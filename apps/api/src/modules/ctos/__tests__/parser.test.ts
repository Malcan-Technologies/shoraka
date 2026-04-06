import { parseCtosReportXml, parseReportingYearFromCtosDates } from "../parser";

describe("parseReportingYearFromCtosDates", () => {
  it("reads ISO date", () => {
    expect(parseReportingYearFromCtosDates("31-12-2018", "2018-12-31")).toBe(2018);
  });

  it("prefers balance sheet date first", () => {
    expect(parseReportingYearFromCtosDates("31-01-2019", "2018-06-30")).toBe(2018);
  });
});

describe("parseCtosReportXml", () => {
  it("extracts reporting_year from account dates when plyear is zero", async () => {
    const xml = `<?xml version="1.0"?>
<report version="5.11.0" xmlns="http://ws.cmctos.com.my/ctosnet/response">
  <enq_report>
    <summary></summary>
    <enquiry>
      <section_summary></section_summary>
      <section_a data="true">
        <record>
          <accounts>
            <account>
              <pldd>31-12-2018</pldd>
              <bsdd>2018-12-31</bsdd>
              <bsfatot>0</bsfatot>
              <othass>0</othass>
              <bscatot>100</bscatot>
              <bsclbank>0</bsclbank>
              <totass>100</totass>
              <curlib>50</curlib>
              <bsslltd>0</bsslltd>
              <bsclstd>0</bsclstd>
              <totlib>50</totlib>
              <bsqpuc>50</bsqpuc>
              <turnover>200</turnover>
              <plnpbt>10</plnpbt>
              <plnpat>8</plnpat>
              <plnetdiv>0</plnetdiv>
              <plyear>0</plyear>
            </account>
          </accounts>
        </record>
      </section_a>
      <section_ccris></section_ccris>
    </enquiry>
  </enq_report>
</report>`;

    const parsed = await parseCtosReportXml(xml);
    expect(parsed.financials_json.length).toBe(1);
    expect(parsed.financials_json[0].reporting_year).toBe(2018);
    expect(parsed.financials_json[0].profit_and_loss.revenue).toBe(200);
  });
});
