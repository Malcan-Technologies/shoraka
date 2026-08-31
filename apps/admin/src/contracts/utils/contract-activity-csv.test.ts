import type { AdminContractActivityEvent } from "@cashsouk/types";
import {
  buildContractActivityCsv,
  contractEventToActivityCsvRow,
  formatContractActivityEventLabel,
} from "./contract-activity-csv";

function event(overrides: Partial<AdminContractActivityEvent> = {}): AdminContractActivityEvent {
  return {
    id: "log-1",
    eventType: "CONTRACT_OFFER_SENT",
    createdAt: "2026-08-18T09:00:00.000Z",
    actorUserId: "user-1",
    actorName: "Ada Admin",
    portal: "ADMIN",
    remark: null,
    metadata: { offered_facility: 500000 },
    applicationId: "app-1",
    ...overrides,
  };
}

describe("formatContractActivityEventLabel", () => {
  it("maps known contract events and title-cases unknown types", () => {
    expect(formatContractActivityEventLabel("CONTRACT_OFFER_SENT")).toBe("Facility Offer Sent");
    expect(formatContractActivityEventLabel("AMENDMENTS_SUBMITTED")).toBe("Amendment Request Sent");
    expect(formatContractActivityEventLabel("APPLICATION_RESUBMITTED")).toBe("Application Resubmitted");
    expect(formatContractActivityEventLabel("CONTRACT_OFFER_ACCEPTED")).toBe("Facility Offer Accepted");
    expect(formatContractActivityEventLabel("CUSTOM_EVENT_TYPE")).toBe("Custom Event Type");
  });

  // Cosmetic-copy regression: canonical wording from activity-notification-copy-standard.md §2
  // ("Facility/Invoice Acceptance Approved for Signing"), aligned with admin-activity-timeline.tsx.
  it("uses the canonical Facility-prefixed wording for acceptance approved for signing", () => {
    expect(formatContractActivityEventLabel("CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING")).toBe(
      "Facility Acceptance Approved for Signing"
    );
  });

  it("uses Title Case for signing-package events, matching the application timeline", () => {
    expect(formatContractActivityEventLabel("SIGNING_PACKAGE_CREATED")).toBe(
      "Signing Package Created"
    );
    expect(formatContractActivityEventLabel("SIGNING_PACKAGE_SENT")).toBe("Signing Package Sent");
    expect(formatContractActivityEventLabel("SIGNING_PACKAGE_COMPLETED")).toBe(
      "Signing Package Completed"
    );
    expect(formatContractActivityEventLabel("SIGNING_PACKAGE_VOIDED")).toBe(
      "Signing Package Voided"
    );
    expect(formatContractActivityEventLabel("SIGNING_PACKAGE_DECLINED")).toBe(
      "Signing Package Declined"
    );
    expect(formatContractActivityEventLabel("SIGNING_PACKAGE_EXPIRED")).toBe(
      "Signing Package Expired"
    );
  });
});

describe("buildContractActivityCsv", () => {
  it("quotes cells and serialises metadata", () => {
    const csv = buildContractActivityCsv([
      event({
        remark: "Facility set at 500k",
        metadata: { offered_facility: 500000 },
      }),
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Timestamp");
    expect(lines[0]).toContain("Event");
    expect(lines[0]).toContain("Actor");
    expect(lines[1]).toContain("Facility Offer Sent");
    expect(lines[1]).toContain("CONTRACT_OFFER_SENT");
    expect(lines[1]).toContain("Facility set at 500k");
    expect(lines[1]).toContain("500000");
    expect(lines[1]).toContain("Ada Admin");
  });

  it("exports an empty table with only the header", () => {
    expect(buildContractActivityCsv([]).split("\n")).toHaveLength(1);
  });

  it("exports occupancy with display references and the raw event type", () => {
    const row = contractEventToActivityCsvRow(
      event({
        eventType: "CONTRACT_FACILITY_OCCUPANCY_UPDATED",
        applicationId: "app-cuid",
        metadata: {
          contract_id: "contract-cuid",
          applicationReference: "APP-CS-2026-001",
          contractReference: "FAC-ARF-202608-A1Z",
          invoiceReference: "INV-ARF-202608-B2Y",
          before: { utilized_facility: 0 },
          after: { utilized_facility: 10000 },
        },
      })
    );
    expect(row.event).toBe("Facility Occupancy Updated");
    expect(row.eventType).toBe("CONTRACT_FACILITY_OCCUPANCY_UPDATED");
    expect(row.targetType).toBe("CONTRACT");
    expect(row.targetReference).toBe("FAC-ARF-202608-A1Z");
    expect(row.metadata).toMatchObject({
      applicationId: "app-cuid",
      contract_id: "contract-cuid",
      applicationReference: "APP-CS-2026-001",
      invoiceReference: "INV-ARF-202608-B2Y",
    });
  });
});
