import { readFileSync } from "fs";
import { join } from "path";
import { APPLICATION_COMREP_DETAIL_KEYS } from "@cashsouk/types";
import { CTOS_ACCOUNT_NUMERIC_CODENAMES } from "../types";

const parser = readFileSync(join(__dirname, "../parser.ts"), "utf8");

describe("CTOS financial parser allowlist", () => {
  it("does not parse or invent ComRep-only application extras", () => {
    for (const key of APPLICATION_COMREP_DETAIL_KEYS) {
      expect(parser).not.toContain(key);
      expect(CTOS_ACCOUNT_NUMERIC_CODENAMES).not.toContain(key);
    }
  });
});
