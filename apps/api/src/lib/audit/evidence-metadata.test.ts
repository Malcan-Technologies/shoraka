/**
 * Metadata contract tests for the compliance evidence attached to existing business events.
 *
 * The evidence requirements are satisfied by enriching the event that already represents the
 * business action, never by adding events. These tests read the writer call sites and assert the
 * required keys are still present in the payload, so a refactor cannot quietly drop a remark, a
 * reference number, a status transition or a timestamp that compliance depends on.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const API_SRC = join(__dirname, "..", "..");

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (full.endsWith(".ts") && !full.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

const ALL_SOURCE = sourceFiles(API_SRC)
  .map((file) => readFileSync(file, "utf8"))
  .join("\n/* ---file boundary--- */\n");

/**
 * Isolates each writer payload that logs the given event type, by walking back to the enclosing
 * call's opening brace and forward to its close.
 */
function payloadsForEvent(eventType: string): string[] {
  const payloads: string[] = [];
  // The window spans a ternary, since several writers select the event type conditionally.
  const marker = new RegExp(`eventType:[\\s\\S]{0,300}?\\b${eventType}\\b`, "g");
  for (const match of ALL_SOURCE.matchAll(marker)) {
    // Walk back to the call's opening brace.
    let depth = 0;
    let start = -1;
    for (let i = match.index!; i >= 0; i -= 1) {
      const char = ALL_SOURCE[i];
      if (char === "}") depth += 1;
      else if (char === "{") {
        if (depth === 0) {
          start = i;
          break;
        }
        depth -= 1;
      }
    }
    if (start === -1) continue;
    depth = 0;
    let end = -1;
    for (let i = start; i < ALL_SOURCE.length; i += 1) {
      if (ALL_SOURCE[i] === "{") depth += 1;
      else if (ALL_SOURCE[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) continue;
    payloads.push(ALL_SOURCE.slice(start, end + 1));
  }
  return payloads;
}

describe("audit evidence: every writer of an event carries its required evidence", () => {
  const cases: { requirement: string; eventType: string; keys: string[] }[] = [
    {
      requirement: "offer acceptance: acceptor, acceptance timestamp, contract reference",
      eventType: "CONTRACT_OFFER_ACCEPTANCE_SUBMITTED",
      keys: ["userId", "applicationId", "contract_id", "submitted_at", "offer_acceptance_status"],
    },
    {
      requirement: "offer acceptance resubmission keeps the same evidence",
      eventType: "CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED",
      keys: ["userId", "applicationId", "contract_id", "submitted_at", "offer_acceptance_status"],
    },
    {
      requirement: "invoice acceptance: acceptor, acceptance timestamp, invoice reference",
      eventType: "INVOICE_OFFER_ACCEPTANCE_SUBMITTED",
      keys: ["userId", "applicationId", "invoice_id", "submitted_at"],
    },
    {
      requirement: "approval for signing: approver and contract reference",
      eventType: "CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING",
      keys: ["userId", "applicationId", "contract_id"],
    },
    {
      requirement: "approval for signing: approver and invoice reference",
      eventType: "INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING",
      keys: ["userId", "applicationId", "invoice_id"],
    },
    {
      requirement: "facility occupancy: before and after values with the contract reference",
      eventType: "CONTRACT_FACILITY_OCCUPANCY_UPDATED",
      keys: ["applicationId", "metadata"],
    },
  ];

  for (const { requirement, eventType, keys } of cases) {
    it(`${eventType} carries evidence for ${requirement}`, () => {
      const payloads = payloadsForEvent(eventType);
      expect(payloads.length).toBeGreaterThan(0);
      for (const payload of payloads) {
        const missing = keys.filter((key) => !new RegExp(`\\b${key}\\b`).test(payload));
        expect(missing).toEqual([]);
      }
    });
  }
});

describe("audit evidence: reviewer remarks reach storage", () => {
  it("keeps remark a first-class argument on the application activity writer", () => {
    const service = readFileSync(join(API_SRC, "modules/applications/logs/service.ts"), "utf8");
    const types = readFileSync(join(API_SRC, "modules/applications/logs/types.ts"), "utf8");
    const repository = readFileSync(
      join(API_SRC, "modules/applications/logs/repository.ts"),
      "utf8"
    );
    const attach = readFileSync(
      join(API_SRC, "modules/applications/logs/attach-display-references.ts"),
      "utf8"
    );
    expect(types).toMatch(/remark\?:/);
    expect(repository).toMatch(/remark: params\.remark/);
    // Display-ref attach must spread the original params so remark and other first-class fields
    // cannot be dropped. The service then writes that full object (`next`), falling back to
    // `params` if the lookup fails, on the same db client the caller passed for the transaction.
    expect(attach).toMatch(/return \{ \.\.\.params, metadata \}/);
    expect(service).toMatch(/let next = params/);
    expect(service).toMatch(/next = await attachApplicationLogDisplayReferences\(params, client\)/);
    expect(service).toMatch(/next = params/);
    expect(service).toMatch(/createApplicationLog\(next, db\)/);
  });

  it("keeps the reviewer remark column on the review event table", () => {
    const schema = readFileSync(join(API_SRC, "..", "prisma", "schema.prisma"), "utf8");
    const block = schema.slice(schema.indexOf("model ApplicationReviewEvent"));
    const body = block.slice(0, block.indexOf("\n}"));
    expect(body).toMatch(/^\s*remark\s+/m);
    expect(body).toMatch(/^\s*old_status\s+/m);
    expect(body).toMatch(/^\s*new_status\s+/m);
  });
});

describe("audit evidence: status transitions keep both sides", () => {
  const BEFORE_AFTER_MODELS: Record<string, [string, string]> = {
    ApplicationReviewEvent: ["old_status", "new_status"],
    GatewayPaymentEvent: ["from_status", "to_status"],
    NoteAdminAction: ["before_state", "after_state"],
    LegalDocumentAuditLog: ["before_json", "after_json"],
  };

  const schema = readFileSync(join(API_SRC, "..", "prisma", "schema.prisma"), "utf8");

  for (const [model, [before, after]] of Object.entries(BEFORE_AFTER_MODELS)) {
    it(`${model} keeps ${before} and ${after}`, () => {
      const start = schema.indexOf(`model ${model} {`);
      expect(start).toBeGreaterThan(-1);
      const body = schema.slice(start, schema.indexOf("\n}", start));
      expect(body).toMatch(new RegExp(`^\\s*${before}\\s+`, "m"));
      expect(body).toMatch(new RegExp(`^\\s*${after}\\s+`, "m"));
    });
  }
});
