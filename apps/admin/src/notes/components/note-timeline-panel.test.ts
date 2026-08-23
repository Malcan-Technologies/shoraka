import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ADMIN_NOTE_OPERATIONAL_EVENT_TYPES,
  formatNoteActivity,
} from "@cashsouk/types";

const timeline = readFileSync(join(__dirname, "note-timeline-panel.tsx"), "utf8");
const mapper = readFileSync(
  join(__dirname, "../../components/audit/contextual-audit-mappers.ts"),
  "utf8"
);
const auditTabs = readFileSync(join(__dirname, "../../lib/audit-tabs.ts"), "utf8");

describe("Admin Note operational Activity", () => {
  it("uses the shared formatter for remaining operational Note events", () => {
    expect(timeline).toContain("formatNoteActivity");
    expect(timeline).toContain("ADMIN_NOTE_OPERATIONAL_EVENT_TYPES");
    expect(timeline).not.toContain("Prospectus review created");
    expect(timeline).not.toContain("Settlement trustee letter generated");
    expect(timeline).not.toContain("NOTE_PROSPECTUS_REVIEW_CREATED:");
  });

  it("does not render raw event type names for operational Note Activity", () => {
    for (const eventType of ADMIN_NOTE_OPERATIONAL_EVENT_TYPES) {
      const copy = formatNoteActivity("admin", eventType);
      expect(copy.title).not.toBe(eventType);
      expect(copy.title).not.toMatch(/_/);
      expect(copy.description).not.toContain(eventType);
    }
  });

  it("leaves Note raw Audit History on the forensic mapper", () => {
    expect(mapper).toContain("formatAuditEventLabel");
    expect(mapper).not.toContain("formatNoteActivity");
    expect(auditTabs).toContain("export function formatAuditEventLabel");
  });
});
