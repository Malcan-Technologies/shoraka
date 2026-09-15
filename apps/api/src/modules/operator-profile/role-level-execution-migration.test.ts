import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("role-level execution bindings migration", () => {
  const sql = readFileSync(
    join(
      __dirname,
      "../../../prisma/migrations/20260913120000_role_level_execution_bindings/migration.sql"
    ),
    "utf8"
  );

  it("copies the FA pair onto Investor and Agent and maps JSG/DoA to equivalent roles", () => {
    expect(sql).toContain('CREATE TYPE "OperatorDocumentExecutionRole"');
    expect(sql).toContain("'FA_INVESTOR'");
    expect(sql).toContain("'FA_AGENT'");
    expect(sql).toContain("'FA_ISSUER_WITNESS'");
    expect(sql).toContain("'JSG_GUARANTOR_WITNESS'");
    expect(sql).toContain("'JSG_OPERATOR_WITNESS'");
    expect(sql).toContain("'DOA_ASSIGNOR_WITNESS'");
    expect(sql).toContain("'FA_AGENT'::\"OperatorDocumentExecutionRole\"");
    expect(sql).toContain('"document_kind"');
    expect(sql.indexOf("DROP INDEX IF EXISTS \"operator_doc_exec_bindings_profile_kind_signer_key\"")).toBeLessThan(
      sql.indexOf("INSERT INTO \"operator_document_execution_bindings\"")
    );
    expect(sql.indexOf("INSERT INTO \"operator_document_execution_bindings\"")).toBeLessThan(
      sql.indexOf('DROP COLUMN "document_kind"')
    );
    expect(sql).toContain("WHEN \"document_kind\" = 'FA' THEN 'FA_INVESTOR'");
    expect(sql).toContain("WHEN \"document_kind\" = 'JSG' THEN 'JSG_OPERATOR'");
    expect(sql).toContain('DROP COLUMN "document_kind"');
    expect(sql).toContain('DROP COLUMN "signer_index"');
    expect(sql).toContain("operator_doc_exec_bindings_profile_role_slot_key");
    expect(sql).toContain('DROP TYPE "OperatorDocumentKind"');
  });
});
