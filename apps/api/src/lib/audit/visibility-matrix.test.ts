import {
  EVENT_CATALOGUE,
  EVENT_LAYER,
  EVENT_LIFECYCLE,
  historicalReaderEventTypes,
  liveWriterEventTypes,
  userVisibleApplicationEventTypes,
  userVisibleOrganizationEventTypes,
} from "./visibility-matrix";

describe("visibility matrix", () => {
  it("classifies every catalogue entry with a layer and lifecycle", () => {
    for (const [eventType, entry] of Object.entries(EVENT_CATALOGUE)) {
      expect(entry.layer).toBeTruthy();
      expect(entry.lifecycle).toBeTruthy();
      expect(entry.table).toBeTruthy();
      expect(eventType.length).toBeGreaterThan(0);
    }
  });

  it("keeps historical APPLICATION_APPROVED as a reader, not a live writer", () => {
    expect(EVENT_CATALOGUE.APPLICATION_APPROVED.lifecycle).toBe(EVENT_LIFECYCLE.HISTORICAL_READER);
    expect(liveWriterEventTypes()).not.toContain("APPLICATION_APPROVED");
    expect(historicalReaderEventTypes()).toContain("APPLICATION_APPROVED");
    expect(userVisibleApplicationEventTypes()).toContain("APPLICATION_APPROVED");
  });

  it("does not advertise DEV webhook types as user milestones", () => {
    expect(EVENT_CATALOGUE.WEBHOOK_APPROVED.lifecycle).toBe(EVENT_LIFECYCLE.DEV_ONLY);
    expect(userVisibleOrganizationEventTypes()).not.toContain("WEBHOOK_APPROVED");
  });

  it("shows COD amendment as a user milestone without exposing the forensic status event", () => {
    expect(EVENT_CATALOGUE.ONBOARDING_AMENDMENT_REQUIRED.userVisible).toBe(true);
    expect(userVisibleOrganizationEventTypes()).toContain("ONBOARDING_AMENDMENT_REQUIRED");
    expect(userVisibleOrganizationEventTypes()).not.toContain("ONBOARDING_STATUS_UPDATED");
  });

  it("shows signing completed/declined/expired to users, not created/voided", () => {
    const visible = userVisibleApplicationEventTypes();
    expect(visible).toContain("SIGNING_PACKAGE_SENT");
    expect(visible).toContain("SIGNING_PACKAGE_COMPLETED");
    expect(visible).toContain("SIGNING_PACKAGE_DECLINED");
    expect(visible).toContain("SIGNING_PACKAGE_EXPIRED");
    expect(visible).not.toContain("SIGNING_PACKAGE_CREATED");
    expect(visible).not.toContain("SIGNING_PACKAGE_VOIDED");
  });

  it("keeps review events as admin activity", () => {
    expect(EVENT_CATALOGUE.SECTION_REVIEWED_APPROVED.layer).toBe(EVENT_LAYER.ADMIN_ACTIVITY);
    expect(userVisibleApplicationEventTypes()).not.toContain("SECTION_REVIEWED_APPROVED");
  });

  it("treats occupancy dual IDs as two layers, not duplicates", () => {
    expect(EVENT_CATALOGUE.CONTRACT_FACILITY_OCCUPANCY_UPDATED.layer).toBe(
      EVENT_LAYER.APPLICATION_TIMELINE
    );
    expect(EVENT_CATALOGUE.FACILITY_OCCUPANCY_UPDATED.layer).toBe(EVENT_LAYER.NOTE_TIMELINE);
  });
});
