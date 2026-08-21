import type { AdminContractActivityEvent } from "@cashsouk/types";
import { buildContractActivityCsv, formatContractActivityEventLabel } from "./contract-activity-csv";

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
    expect(formatContractActivityEventLabel("CONTRACT_OFFER_SENT")).toBe("Facility offer sent");
    expect(formatContractActivityEventLabel("CONTRACT_OFFER_ACCEPTED")).toBe("Facility offer signed");
    expect(formatContractActivityEventLabel("CUSTOM_EVENT_TYPE")).toBe("Custom Event Type");
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
    expect(lines[0]).toContain("createdAt");
    expect(lines[0]).toContain("event");
    expect(lines[0]).toContain("actor");
    expect(lines[1]).toContain("Facility offer sent");
    expect(lines[1]).toContain("CONTRACT_OFFER_SENT");
    expect(lines[1]).toContain("Facility set at 500k");
    expect(lines[1]).toContain("500000");
    expect(lines[1]).toContain("Ada Admin");
  });

  it("exports an empty table with only the header", () => {
    expect(buildContractActivityCsv([]).split("\n")).toHaveLength(1);
  });
});
