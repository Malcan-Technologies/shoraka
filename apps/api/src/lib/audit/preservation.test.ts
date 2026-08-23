/**
 * Preservation parity tests for the audit/logging standardization.
 *
 * These are deliberately source-level rather than runtime: they answer "did we silently lose
 * something relative to the reference revision?" for every audit table, event type, legacy column
 * and presentation surface, without needing a database or triggering every business workflow by
 * hand.
 *
 * `preservation-baseline.json` is generated from the reference revision by
 * `scripts/audit-baseline.ts`. Regenerate it only when the product intentionally gains an event.
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import baseline from "./preservation-baseline.json";

const REPO_ROOT = join(__dirname, "../../../../..");
const API_ROOT = join(__dirname, "../../..");
const API_SRC = join(API_ROOT, "src");
const SCHEMA_PATH = join(API_ROOT, "prisma/schema.prisma");
const MIGRATIONS_DIR = join(API_ROOT, "prisma/migrations");

const AUDIT_TABLE_MODELS = [
  "accessLog",
  "securityLog",
  "onboardingLog",
  "applicationLog",
  "applicationReviewEvent",
  "legalDocumentAuditLog",
  "productLog",
  "noteEvent",
  "noteAdminAction",
  "gatewayPaymentEvent",
  "notificationLog",
] as const;

/**
 * The only modules allowed to call `create` on an audit table. Anything else means a business module
 * is bypassing the standardized writer and will miss the forensic columns.
 */
const APPROVED_WRITER_FILES = [
  "src/lib/audit/account-logs.ts",
  "src/lib/audit/note-events.ts",
  "src/modules/applications/logs/repository.ts",
  "src/modules/applications/logs/review-events.ts",
  "src/modules/products/audit.ts",
  "src/modules/payment/gateway-events.ts",
  "src/modules/legal-documents/audit-log-service.ts",
  "src/modules/notification/service.ts",
  // Dev-only RegTank handler bound to a separate Prisma client; out of scope for standardization.
  "src/modules/regtank/webhook-handler-dev.ts",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full) && !/\.(test|spec)\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

function readRepoFile(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

const apiFiles = walk(API_SRC);
const schema = readFileSync(SCHEMA_PATH, "utf8");

function modelBlock(modelName: string): string {
  const match = schema.match(new RegExp(`\\nmodel ${modelName} \\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`Model ${modelName} not found in schema`);
  return match[1];
}

describe("audit preservation: tables", () => {
  const currentTables = [...schema.matchAll(/@@map\("([a-z_0-9]+)"\)/g)].map((m) => m[1]).sort();

  it("removes no table from the reference revision", () => {
    const removed = baseline.tables.filter((table) => !currentTables.includes(table));
    expect(removed).toEqual([]);
  });

  it("renames no table (count and membership are unchanged)", () => {
    expect(currentTables).toEqual(baseline.tables);
  });

  it("keeps every legacy log table that looked redundant, rather than dropping it", () => {
    // Flagged in the report as possible future cleanup; must still exist today.
    for (const table of ["application_review_events", "note_admin_actions", "onboarding_logs"]) {
      expect(currentTables).toContain(table);
    }
  });
});

describe("audit preservation: migrations are additive", () => {
  const auditMigrations = readdirSync(MIGRATIONS_DIR).filter((name) =>
    name.includes("audit_standard_forensic_columns")
  );

  it("ships the standardization migration", () => {
    expect(auditMigrations.length).toBe(1);
  });

  /** Strips `--` comments so prose describing the safety rules is not mistaken for a statement. */
  function executableSql(name: string): string {
    return readFileSync(join(MIGRATIONS_DIR, name, "migration.sql"), "utf8")
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");
  }

  it("contains no destructive statement", () => {
    for (const name of auditMigrations) {
      const sql = executableSql(name);
      expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN|CONSTRAINT)/i);
      expect(sql).not.toMatch(/RENAME/i);
      expect(sql).not.toMatch(/DELETE\s+FROM/i);
      expect(sql).not.toMatch(/TRUNCATE/i);
      expect(sql).not.toMatch(/UPDATE\s+"/i);
      expect(sql).not.toMatch(/ALTER COLUMN/i);
      // Every added column must be nullable so existing rows stay valid.
      expect(sql).not.toMatch(/ADD COLUMN[^;]*NOT NULL/i);
    }
  });

  it("only adds columns and indexes", () => {
    for (const name of auditMigrations) {
      const statements = executableSql(name)
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith("--"));
      for (const statement of statements) {
        expect(statement).toMatch(/^(ALTER TABLE|CREATE (UNIQUE )?INDEX)/i);
        if (/^ALTER TABLE/i.test(statement)) {
          expect(statement).toMatch(/ADD COLUMN/i);
        }
      }
    }
  });
});

describe("audit preservation: no new event types", () => {
  const declaredApplicationEvents = [
    ...new Set(
      [
        ...readRepoFile("apps/api/src/modules/applications/logs/types.ts").matchAll(
          /^ {2}([A-Z0-9_]+) = "([A-Z0-9_]+)",?$/gm
        ),
      ].map((m) => m[2])
    ),
  ];

  it("declares exactly the reference set of application log event types", () => {
    expect(declaredApplicationEvents.sort()).toEqual(baseline.eventTypes.applicationLog);
  });

  it("declares exactly the reference set of legal document event types", () => {
    const declared = [
      ...readRepoFile("apps/api/src/modules/legal-documents/schemas.ts").matchAll(
        /"(LEGAL_[A-Z0-9_]+)"/g
      ),
    ].map((m) => m[1]);
    expect([...new Set(declared)].sort()).toEqual(baseline.eventTypes.legalDocument);
  });

  it("writes no note event type that the reference revision did not write", () => {
    const written = new Set<string>();
    for (const file of apiFiles.filter((f) => f.includes("/notes/"))) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/event_?[Tt]ype:\s*"([A-Z0-9_]+)"/g)) written.add(m[1]);
      for (const m of src.matchAll(/logEvent\(\s*\w+,\s*[\w.]+,\s*"([A-Z0-9_]+)"/g)) {
        written.add(m[1]);
      }
    }
    const added = [...written].filter((e) => !baseline.eventTypes.noteEvent.includes(e));
    expect(added).toEqual([]);
  });

  it("does not introduce the nofix55-only event types", () => {
    // Explicitly deferred to a later coverage phase.
    const deferred = [
      "APPLICATION_REVIEW_STARTED",
      "APPLICATION_AMENDMENT_ACKNOWLEDGED",
      "APPLICATION_ARCHIVED",
      "APPLICATION_DRAFT_DELETED",
      "APPLICATION_DOCUMENT_UPLOADED",
      "APPLICATION_DOCUMENT_REMOVED",
      "APPLICATION_DOCUMENT_REPLACED",
      "CONTRACT_ACCEPTANCE_CHANGES_REQUESTED",
      "INVOICE_ACCEPTANCE_CHANGES_REQUESTED",
      "SIGNING_PACKAGE_DECLINED",
      "SIGNING_PACKAGE_EXPIRED",
    ];
    for (const event of deferred) {
      expect(declaredApplicationEvents).not.toContain(event);
    }
  });
});

describe("audit preservation: writer coverage", () => {
  const allApiSource = apiFiles.map((file) => readFileSync(file, "utf8")).join("\n");

  /**
   * Declared but unwritten on the reference revision too. Flagged in the report, not deleted.
   * Anything NEW appearing here is a writer we dropped.
   */
  const KNOWN_UNWRITTEN_EVENTS = new Set(["SECTION_REVIEWED_PENDING", "ITEM_REVIEWED_PENDING"]);

  /**
   * This is a "did the string vanish from the codebase" regression guard, not a
   * "does this event have a live writer" check — it matches any reference, including
   * reader/label code, so it does not (and cannot) distinguish a real writer call site
   * from a dead enum member that only survives in a case/label map. The authoritative
   * per-event writer classification lives in `origin-main-preservation-inventory.md`
   * §3.4, which lists `APPLICATION_APPROVED` and `CONTRACT_OFFER_REJECTED` as declared
   * with no production writer; those are intentionally not in `KNOWN_UNWRITTEN_EVENTS`
   * because a reader/label reference to them already exists and must keep existing.
   */
  it("keeps at least a source reference for every application log event that had one", () => {
    const missing: string[] = [];
    for (const event of baseline.eventTypes.applicationLog) {
      if (KNOWN_UNWRITTEN_EVENTS.has(event)) continue;
      const referenced =
        allApiSource.includes(`ApplicationLogEventType.${event}`) ||
        allApiSource.includes(`"${event}"`);
      if (!referenced) missing.push(event);
    }
    expect(missing).toEqual([]);
  });

  it("routes every audit table write through an approved standardized writer", () => {
    const violations: string[] = [];
    for (const file of apiFiles) {
      const relativePath = file.slice(API_ROOT.length + 1);
      if (APPROVED_WRITER_FILES.includes(relativePath)) continue;
      const src = readFileSync(file, "utf8");
      for (const model of AUDIT_TABLE_MODELS) {
        if (new RegExp(`\\.${model}\\.create\\b`).test(src)) {
          violations.push(`${relativePath}::${model}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("never mutates or deletes an audit row", () => {
    /**
     * Pre-existing on the reference revision: rolling back a product whose creation failed removes
     * the product row and its logs together, so no log can outlive its product. Preserved as-is and
     * flagged in the report rather than changed.
     */
    const KNOWN_ROLLBACK_DELETES = ["src/modules/products/repository.ts::productLog.deleteMany"];

    const violations: string[] = [];
    for (const file of apiFiles) {
      const src = readFileSync(file, "utf8");
      for (const model of AUDIT_TABLE_MODELS) {
        for (const op of ["update", "updateMany", "delete", "deleteMany", "upsert"]) {
          if (new RegExp(`\\.${model}\\.${op}\\b`).test(src)) {
            violations.push(`${file.slice(API_ROOT.length + 1)}::${model}.${op}`);
          }
        }
      }
    }
    expect(violations.filter((v) => !KNOWN_ROLLBACK_DELETES.includes(v))).toEqual([]);
  });
});

describe("audit preservation: legacy columns still written", () => {
  /** Column names each standardized writer must still populate, per the reference revision. */
  const LEGACY_COLUMNS: Record<string, string[]> = {
    "src/modules/applications/logs/repository.ts": [
      "user_id",
      "application_id",
      "event_type",
      "level",
      "target",
      "action",
      "review_cycle",
      "remark",
      "entity_id",
      "ip_address",
      "user_agent",
      "device_info",
      "portal",
      "metadata",
    ],
    "src/lib/audit/note-events.ts": [
      "note_id",
      "event_type",
      "actor_user_id",
      "actor_role",
      "portal",
      "ip_address",
      "user_agent",
      "correlation_id",
      "metadata",
      "action_type",
      "before_state",
      "after_state",
    ],
    "src/lib/audit/account-logs.ts": [
      "user_id",
      "event_type",
      "portal",
      "ip_address",
      "user_agent",
      "device_info",
      "device_type",
      "cognito_event",
      "success",
      "metadata",
      "role",
      "organization_name",
      "investor_organization_id",
      "issuer_organization_id",
    ],
    "src/modules/products/audit.ts": [
      "user_id",
      "product_id",
      "event_type",
      "ip_address",
      "user_agent",
      "device_info",
      "metadata",
    ],
    "src/modules/applications/logs/review-events.ts": [
      "application_id",
      "event_type",
      "scope",
      "scope_key",
      "old_status",
      "new_status",
      "reviewer_user_id",
      "remark",
    ],
    "src/modules/payment/gateway-events.ts": [
      "gateway_payment_id",
      "type",
      "actor_user_id",
      "from_status",
      "to_status",
      "reason",
      "metadata",
    ],
    "src/modules/legal-documents/audit-log-service.ts": [
      "action",
      "legal_document_id",
      "legal_document_version_id",
      "document_type",
      "version_number",
      "document_hash",
      "actor_user_id",
      "actor_name_snapshot",
      "actor_email_snapshot",
      "before_json",
      "after_json",
      "reason",
      "ip_address",
      "user_agent",
      "correlation_id",
    ],
  };

  for (const [relativePath, columns] of Object.entries(LEGACY_COLUMNS)) {
    it(`${relativePath} still writes every legacy column`, () => {
      const src = readFileSync(join(API_ROOT, relativePath), "utf8");
      const missing = columns.filter((column) => !new RegExp(`\\b${column}:`).test(src));
      expect(missing).toEqual([]);
    });
  }

  it("keeps the reviewer remark as a first-class column on both application audit tables", () => {
    expect(modelBlock("ApplicationLog")).toMatch(/\bremark\s+String\?/);
    expect(modelBlock("ApplicationReviewEvent")).toMatch(/\bremark\s+String\?/);
  });
});

describe("audit preservation: metadata is never rewritten", () => {
  /**
   * Several admin surfaces render metadata generically (`Object.entries`) or gate a "View details"
   * expander on metadata being truthy, so injecting keys would change what users see and what CSV
   * exports contain. Writers must pass the caller's metadata straight through.
   */
  const WRITERS_THAT_PASS_METADATA_THROUGH = [
    "src/modules/applications/logs/repository.ts",
    "src/lib/audit/note-events.ts",
    "src/lib/audit/account-logs.ts",
    "src/modules/products/audit.ts",
  ];

  for (const relativePath of WRITERS_THAT_PASS_METADATA_THROUGH) {
    it(`${relativePath} does not merge derived keys into metadata`, () => {
      const src = readFileSync(join(API_ROOT, relativePath), "utf8");
      expect(src).not.toMatch(/withActorSnapshot/);
      expect(src).not.toMatch(/\.\.\.\s*(params\.)?metadata/);
      expect(src).not.toMatch(/metadata\.[A-Za-z]+\s*=/);
    });
  }

  it("stores actor snapshots in dedicated columns, never in metadata", () => {
    const snapshot = readFileSync(join(API_ROOT, "src/lib/audit/snapshot.ts"), "utf8");
    expect(snapshot).toMatch(/actor_name_snapshot/);
    expect(snapshot).not.toMatch(/actorName/);
  });
});

describe("audit preservation: writers add no query to the write path", () => {
  /**
   * Many callers wrap the audit write in a best-effort try/catch inside a business transaction. A
   * lookup inside the writer turns a transient read failure into a permanently lost audit row, and
   * can leave a Postgres transaction aborted. Derive from what the caller already holds instead.
   */
  const ZERO_QUERY_WRITERS = [
    "src/modules/applications/logs/repository.ts",
    "src/modules/applications/logs/review-events.ts",
    "src/lib/audit/note-events.ts",
    "src/lib/audit/account-logs.ts",
    "src/modules/products/audit.ts",
    "src/modules/payment/gateway-events.ts",
  ];

  /** Split a module into top-level function blocks so readers sharing the file are not scanned. */
  function topLevelFunctions(src: string): string[] {
    const starts = [...src.matchAll(/^(?:export )?(?:async )?function \w+/gm)].map((m) => m.index!);
    return starts.map((start, i) => src.slice(start, starts[i + 1] ?? src.length));
  }

  for (const relativePath of ZERO_QUERY_WRITERS) {
    it(`${relativePath} issues no read before writing`, () => {
      const src = readFileSync(join(API_ROOT, relativePath), "utf8");
      const writerBlocks = topLevelFunctions(src).filter((block) => /\.create\(\{/.test(block));
      expect(writerBlocks.length).toBeGreaterThan(0);
      for (const block of writerBlocks) {
        expect(block).not.toMatch(/\.(findUnique|findFirst|findMany|count|aggregate)\(/);
        expect(block).not.toMatch(/loadAuditActorSnapshot/);
      }
    });
  }
});

describe("audit preservation: compliance evidence fields", () => {
  const cases: { requirement: string; model: string; columns: string[] }[] = [
    {
      requirement: "legal acceptance/consent: version, hash, timestamp, IP, identity, organization",
      model: "LegalDocumentAcceptance",
      columns: [
        "legal_document_version_id",
        "legal_document_id",
        "version_number",
        "document_hash",
        "accepted_at",
        "accepted_ip_address",
        "accepted_user_agent",
        "user_id",
        "user_name_snapshot",
        "user_email_snapshot",
        "organization_id",
        "organization_name_snapshot",
        "acknowledgement_text",
      ],
    },
    {
      requirement: "legal document lifecycle: actor identity snapshot, hash, IP, correlation",
      model: "LegalDocumentAuditLog",
      columns: [
        "document_hash",
        "actor_user_id",
        "actor_name_snapshot",
        "actor_email_snapshot",
        "before_json",
        "after_json",
        "ip_address",
        "correlation_id",
      ],
    },
    {
      requirement: "AML/onboarding decision: decision, timestamp, decision maker, organization",
      model: "OnboardingLog",
      columns: [
        "event_type",
        "created_at",
        "user_id",
        "actor_user_id",
        "investor_organization_id",
        "issuer_organization_id",
        "organization_name",
        "metadata",
      ],
    },
    {
      requirement: "signing: document hash, provider reference, per-document status",
      model: "SigningDocument",
      columns: ["signed_file_sha256", "provider_contract_ref", "status"],
    },
    {
      requirement: "signing: signer identity, role, per-signatory status and timestamps",
      model: "SigningRecipient",
      columns: ["name", "email", "ic_number", "role_key", "role_label", "status", "completed_at"],
    },
    {
      requirement: "signing: per-document-per-signatory signature timestamp",
      model: "SigningAssignment",
      columns: ["status", "signed_at"],
    },
    {
      requirement: "offer: issue timestamp, acceptance deadline, approved terms reference",
      model: "SigningEnvelope",
      columns: ["sent_at", "completed_at", "voided_at", "expires_at", "product_version"],
    },
    {
      requirement: "payment: status transition, reason, actor",
      model: "GatewayPaymentEvent",
      columns: ["type", "from_status", "to_status", "reason", "actor_user_id", "created_at"],
    },
    {
      requirement: "per-note sequence: note reference and second-level event timestamps",
      model: "NoteEvent",
      columns: ["note_id", "event_type", "created_at", "metadata"],
    },
  ];

  for (const { requirement, model, columns } of cases) {
    it(`${model} still holds the evidence for ${requirement}`, () => {
      const block = modelBlock(model);
      const missing = columns.filter(
        (column) => !new RegExp(`^\\s*${column}\\s+`, "m").test(block)
      );
      expect(missing).toEqual([]);
    });
  }
});

describe("audit standardization: shared field conventions", () => {
  const STANDARD_COLUMN_EXPECTATIONS: Record<string, string[]> = {
    AccessLog: ["actor_type", "target_type", "target_id", "source", "correlation_id"],
    SecurityLog: ["actor_type", "target_type", "target_id", "source", "portal", "correlation_id"],
    OnboardingLog: [
      "actor_type",
      "actor_user_id",
      "organization_kind",
      "target_type",
      "target_id",
      "source",
      "correlation_id",
    ],
    ApplicationLog: ["actor_type", "target_type", "target_id", "source", "correlation_id"],
    ApplicationReviewEvent: [
      "actor_type",
      "source",
      "portal",
      "ip_address",
      "user_agent",
      "correlation_id",
      "metadata",
    ],
    LegalDocumentAuditLog: ["actor_type", "target_type", "target_id", "source", "portal"],
    ProductLog: ["actor_type", "target_type", "target_id", "source", "portal", "correlation_id"],
    NoteEvent: ["actor_type", "target_type", "target_id", "source"],
    NoteAdminAction: ["actor_type", "portal", "target_type", "target_id", "source", "metadata"],
    GatewayPaymentEvent: [
      "actor_type",
      "target_type",
      "target_id",
      "source",
      "portal",
      "ip_address",
      "user_agent",
      "correlation_id",
    ],
    NotificationLog: ["actor_type", "source", "portal", "correlation_id"],
  };

  for (const [model, columns] of Object.entries(STANDARD_COLUMN_EXPECTATIONS)) {
    it(`${model} carries the standard forensic columns`, () => {
      const block = modelBlock(model);
      const missing = columns.filter(
        (column) => !new RegExp(`^\\s*${column}\\s+`, "m").test(block)
      );
      expect(missing).toEqual([]);
    });

    it(`${model} declares every added forensic column nullable`, () => {
      const block = modelBlock(model);
      for (const column of columns) {
        // `notification_logs.target_type` and `onboarding_logs.*_organization_id` predate this work
        // and keep their original nullability.
        const declaration = block.match(new RegExp(`^\\s*${column}\\s+(\\S+)`, "m"));
        if (!declaration) continue;
        if (model === "NotificationLog" && column === "target_type") continue;
        expect(declaration[1]).toMatch(/\?$/);
      }
    });
  }

  it("does not apply the audit target vocabulary to notification_logs.target_type", () => {
    // That column already means "audience type" (ALL_USERS / INVESTORS / ...) on the reference
    // revision; overloading it would corrupt existing rows.
    const block = modelBlock("NotificationLog");
    expect(block).toMatch(/target_type\s+String\b/);
    expect(block).not.toMatch(/^\s*target_id\s+/m);
  });
});
