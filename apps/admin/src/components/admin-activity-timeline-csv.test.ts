import type { ApplicationLogEntry } from "@/hooks/use-application-logs";
import { applicationLogToActivityCsvRow } from "./application-log-activity-csv";

function makeLog(overrides: Partial<ApplicationLogEntry> = {}): ApplicationLogEntry {
  return {
    id: "log-1",
    event_type: "APPLICATION_SUBMITTED",
    activity: null,
    actor_id: "user-1",
    application_id: "app-internal-1",
    metadata: null,
    ip_address: null,
    created_at: "2026-08-18T09:00:00.000Z",
    remark: null,
    entityId: null,
    review_cycle: null,
    actor_type: "ADMIN",
    source: "API",
    target_type: "APPLICATION",
    target_id: "app-internal-1",
    portal: "ADMIN",
    correlation_id: "corr-1",
    ...overrides,
  };
}

describe("applicationLogToActivityCsvRow", () => {
  it("uses canonical applicationReference as CSV Target Reference and exports internal target id", () => {
    const row = applicationLogToActivityCsvRow(
      makeLog({
        event_type: "APPLICATION_SUBMITTED",
        target_type: "APPLICATION",
        target_id: "app-internal-1",
        application_id: "app-internal-1",
        metadata: {
          applicationReference: "APP-ARF-202608-K71",
        },
      }),
      "Application Submitted"
    );

    expect(row.targetType).toBe("APPLICATION");
    expect(row.targetReference).toBe("APP-ARF-202608-K71");
    expect(row.extra?.["Target Internal ID"]).toBe("app-internal-1");
  });

  it("uses canonical contractReference as CSV Target Reference for contract events", () => {
    const row = applicationLogToActivityCsvRow(
      makeLog({
        event_type: "CONTRACT_OFFER_SENT",
        target_type: "CONTRACT",
        target_id: "contract-internal-1",
        application_id: "app-internal-1",
        metadata: {
          contractReference: "CON-ARF-202608-A1Z",
          applicationReference: "APP-ARF-202608-K71",
        },
      }),
      "Facility Offer Sent"
    );

    expect(row.targetType).toBe("CONTRACT");
    expect(row.targetReference).toBe("CON-ARF-202608-A1Z");
    expect(row.extra?.["Target Internal ID"]).toBe("contract-internal-1");
  });

  it("falls back to internal ids when canonical display references are missing", () => {
    const row = applicationLogToActivityCsvRow(
      makeLog({
        target_type: "APPLICATION",
        target_id: "app-internal-1",
        metadata: {},
      })
      ,
      "Application Submitted"
    );

    expect(row.targetReference).toBe("app-internal-1");
    expect(row.extra?.["Target Internal ID"]).toBe("app-internal-1");
  });
});

