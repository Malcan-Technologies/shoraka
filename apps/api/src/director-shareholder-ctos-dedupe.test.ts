import {
  buildUnifiedCtosDirectorShareholdersFromCompanyJson,
  getDirectorShareholderDisplayRows,
} from "@cashsouk/types";

describe("CTOS director display dedupe (same nic_brno)", () => {
  const companyJson = {
    directors: [
      {
        name: "HARI KRISHNAN A/L GOVINDANAIR",
        ic_lcno: null,
        nic_brno: "630615075495",
        position: "DO",
        party_type: "I",
        equity_percentage: 0,
        equity: 0,
        addr: "ADDR-A",
        appoint: "01-12-2001",
        remark: null,
        resign_date: null,
      },
      {
        name: "HARI KRISHNAN A/L GOVINDANAIR",
        ic_lcno: null,
        nic_brno: "630615075495",
        position: "DO",
        party_type: "I",
        equity_percentage: 0,
        equity: 0,
        addr: "ADDR-B",
        appoint: "01-12-2001",
        remark: "Da team",
        resign_date: null,
      },
    ],
  };

  it("buildUnifiedCtosDirectorShareholdersFromCompanyJson returns one party per nic", () => {
    const rows = buildUnifiedCtosDirectorShareholdersFromCompanyJson(companyJson);
    expect(rows).toHaveLength(1);
    expect(rows[0].ic).toBe("630615075495");
    expect(rows[0].name).toContain("HARI");
  });

  it("getDirectorShareholderDisplayRows merges duplicate CTOS rows and fills remark from duplicate", () => {
    const rows = getDirectorShareholderDisplayRows({
      corporateEntities: null,
      directorKycStatus: null,
      organizationCtosCompanyJson: companyJson,
      sentRowIds: null,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].ctosRemark).toBe("Da team");
    expect(rows[0].ctosAddr).toBe("ADDR-A");
  });
});

describe("CTOS display merge: explicit party_type only", () => {
  it("party_type C with same nic_brno merges as one company", () => {
    const companyJson = {
      directors: [
        {
          name: "ACME SDN BHD",
          ic_lcno: null,
          nic_brno: "202001000001",
          party_type: "C",
          position: "SO",
          equity_percentage: 6,
          equity: 0,
        },
        {
          name: "ACME SDN BHD",
          ic_lcno: null,
          nic_brno: "202001000001",
          party_type: "C",
          position: "SO",
          equity_percentage: 6,
          equity: 0,
          remark: "note",
        },
      ],
    };
    const rows = buildUnifiedCtosDirectorShareholdersFromCompanyJson(companyJson);
    expect(rows).toHaveLength(1);
    expect(rows[0].isIndividual).toBe(false);
    expect(rows[0].sharePercentage).toBe(6);
  });

  it("missing party_type rows are excluded from unified list and display", () => {
    const companyJson = {
      directors: [
        {
          name: "SAME NAME",
          ic_lcno: "900101011234",
          nic_brno: null,
          party_type: null,
          position: "DO",
          equity_percentage: 0,
          equity: 0,
        },
        {
          name: "SAME NAME",
          ic_lcno: "900101011234",
          nic_brno: null,
          party_type: null,
          position: "DO",
          equity_percentage: 0,
          equity: 0,
        },
      ],
    };
    expect(buildUnifiedCtosDirectorShareholdersFromCompanyJson(companyJson)).toHaveLength(0);
    expect(
      getDirectorShareholderDisplayRows({
        corporateEntities: null,
        directorKycStatus: null,
        organizationCtosCompanyJson: companyJson,
        sentRowIds: null,
      })
    ).toHaveLength(0);
  });

  it("invalid party_type rows are excluded from unified list and display", () => {
    const companyJson = {
      directors: [
        {
          name: "X",
          ic_lcno: "111",
          nic_brno: null,
          party_type: "X",
          position: "DO",
          equity_percentage: 0,
          equity: 0,
        },
        {
          name: "X",
          ic_lcno: "111",
          nic_brno: null,
          party_type: "X",
          position: "DO",
          equity_percentage: 0,
          equity: 0,
        },
      ],
    };
    expect(buildUnifiedCtosDirectorShareholdersFromCompanyJson(companyJson)).toHaveLength(0);
    expect(
      getDirectorShareholderDisplayRows({
        corporateEntities: null,
        directorKycStatus: null,
        organizationCtosCompanyJson: companyJson,
        sentRowIds: null,
      })
    ).toHaveLength(0);
  });

  it("only explicit I rows appear when mixed with missing party_type", () => {
    const companyJson = {
      directors: [
        {
          name: "KEEP ME",
          ic_lcno: null,
          nic_brno: "630615075495",
          party_type: "I",
          position: "DO",
          equity_percentage: 0,
          equity: 0,
        },
        {
          name: "DROP ME",
          ic_lcno: "900101011234",
          nic_brno: null,
          party_type: null,
          position: "DO",
          equity_percentage: 0,
          equity: 0,
        },
      ],
    };
    const rows = buildUnifiedCtosDirectorShareholdersFromCompanyJson(companyJson);
    expect(rows).toHaveLength(1);
    expect(rows[0].ic).toBe("630615075495");
    expect(rows[0].name).toContain("KEEP");
  });
});

describe("CTOS display merge: SC does not contribute shareholder", () => {
  it("duplicate corporate CTOS rows with position SC merge without shareholder flag", () => {
    const companyJson = {
      directors: [
        {
          name: "FOO BHD",
          ic_lcno: null,
          nic_brno: "130586H",
          position: "SC",
          party_type: "C",
          equity_percentage: 10,
          equity: 0,
        },
        {
          name: "FOO BHD",
          ic_lcno: null,
          nic_brno: "130586H",
          position: "SC",
          party_type: "C",
          equity_percentage: 5,
          equity: 0,
        },
      ],
    };
    const rows = buildUnifiedCtosDirectorShareholdersFromCompanyJson(companyJson);
    expect(rows).toHaveLength(1);
    expect(rows[0].isShareholder).toBe(false);
    expect(rows[0].isDirector).toBe(false);
    expect(rows[0].sharePercentage).toBe(10);
  });
});
