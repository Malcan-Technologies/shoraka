import { parseCtosReportXml, parseYearFromPldd } from "../parser";

describe("parseYearFromPldd", () => {
  it("reads DD-MM-YYYY", () => {
    expect(parseYearFromPldd("31-12-2018")).toBe(2018);
  });

  it("reads ISO date", () => {
    expect(parseYearFromPldd("2018-12-31")).toBe(2018);
  });

  it("uses pldd year only (no bsdd fallback in this helper)", () => {
    expect(parseYearFromPldd("31-01-2019")).toBe(2019);
  });
});

describe("parseCtosReportXml", () => {
  it("extracts financial_year from pldd calendar year and account codenames", async () => {
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
              <plyear>50000</plyear>
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
    expect(parsed.financials_json[0].financial_year).toBe(2018);
    expect(parsed.financials_json[0].account.turnover).toBe(200);
    expect(parsed.financials_json[0].account.plyear).toBe(50000);
  });

  it("individual ptype I: person_json set, company null, no financials even with accounts", async () => {
    const xml = `<?xml version="1.0"?>
<report version="5.11.0" xmlns="http://ws.cmctos.com.my/ctosnet/response">
  <enq_report>
    <summary>
      <enq_sum ptype="I"></enq_sum>
    </summary>
    <enquiry>
      <section_summary></section_summary>
      <section_a data="true">
        <record>
          <name>JANE TEST</name>
          <nic_brno>800808088888</nic_brno>
          <nationality>MYS</nationality>
          <birth_date>1980-08-08</birth_date>
          <addr>10 Jalan Test</addr>
          <accounts>
            <account>
              <pldd>31-12-2018</pldd>
              <bsdd>2018-12-31</bsdd>
              <plyear>0</plyear>
              <turnover>999</turnover>
            </account>
          </accounts>
        </record>
      </section_a>
      <section_ccris></section_ccris>
    </enquiry>
  </enq_report>
</report>`;

    const parsed = await parseCtosReportXml(xml);
    expect(parsed.company_json).toBeNull();
    expect(parsed.financials_json.length).toBe(0);
    expect(parsed.person_json).toEqual({
      name: "JANE TEST",
      nic_brno: "800808088888",
      ic_lcno: null,
      nationality: "MYS",
      birth_date: "1980-08-08",
      addr: "10 Jalan Test",
    });
  });

  it("keeps first account only when duplicate calendar year from pldd", async () => {
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
              <pldd>31-12-2022</pldd>
              <bsdd>2022-12-31</bsdd>
              <plyear>1000000</plyear>
              <turnover>100</turnover>
            </account>
            <account>
              <pldd>30-06-2022</pldd>
              <bsdd>2022-06-30</bsdd>
              <plyear>2000000</plyear>
              <turnover>999</turnover>
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
    expect(parsed.financials_json[0].account.turnover).toBe(100);
  });
});
