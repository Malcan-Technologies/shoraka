import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("document signers and send phase migration", () => {
  const sql = readFileSync(
    join(
      __dirname,
      "../../../prisma/migrations/20260911140000_document_signers_and_send_phase/migration.sql"
    ),
    "utf8"
  );

  it("maps Investor pairs to document signers and persists send phase columns", () => {
    expect(sql).toContain('CREATE TYPE "OperatorDocumentKind"');
    expect(sql).toContain('CREATE TYPE "SigningEnvelopeSendPhase"');
    expect(sql).toContain('"document_kind"');
    expect(sql).toContain('"signer_index"');
    expect(sql).toContain('WHEN "role_key"::text IN (\'FA_INVESTOR\', \'FA_AGENT\')');
    expect(sql).toContain('agent."role_key" = \'FA_AGENT\'');
    expect(sql).toContain('DROP COLUMN "role_key"');
    expect(sql).toContain('"send_phase"');
    expect(sql).toContain("metadata->'package_send'");
    expect(sql).toContain("operator_doc_exec_bindings_profile_kind_signer_key");
  });
});
