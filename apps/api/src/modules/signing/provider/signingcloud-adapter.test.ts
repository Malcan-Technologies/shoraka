import { parseSigningCloudContractDetails } from "./signingcloud-adapter";

describe("parseSigningCloudContractDetails", () => {
  it("parses nested data object with addressee signstates", () => {
    const result = parseSigningCloudContractDetails({
      data: {
        state: 4,
        contractnumber: "ABC",
        addressee: [
          { email: "Ali@Co.My", realname: "Ali", signstate: 1 },
          { email: "bob@co.my", realname: "Bob", signstate: 0 },
          { email: "cara@co.my", realname: "Cara", signstate: 2 },
        ],
      },
    });

    expect(result.documentState).toBe(4);
    expect(result.signers).toEqual([
      { email: "ali@co.my", status: "SIGNED", name: "Ali" },
      { email: "bob@co.my", status: "PENDING", name: "Bob" },
      { email: "cara@co.my", status: "REJECTED", name: "Cara" },
    ]);
  });

  it("parses data when it is a JSON string", () => {
    const result = parseSigningCloudContractDetails({
      data: JSON.stringify({
        state: 2,
        addressee: [{ email: "x@y.z", signstate: 1 }],
      }),
    });

    expect(result.documentState).toBe(2);
    expect(result.signers).toEqual([{ email: "x@y.z", status: "SIGNED", name: null }]);
  });

  it("parses signerinfo rows and string signstate labels", () => {
    const result = parseSigningCloudContractDetails({
      contractInfo: {
        state: "4",
        signerinfo: [
          { Email: "One@Co.My", Name: "One", signState: "signed" },
          { email: "two@co.my", realname: "Two", status: "rejected" },
        ],
      },
    });

    expect(result.documentState).toBe(4);
    expect(result.signers).toEqual([
      { email: "one@co.my", status: "SIGNED", name: "One" },
      { email: "two@co.my", status: "REJECTED", name: "Two" },
    ]);
  });
});
