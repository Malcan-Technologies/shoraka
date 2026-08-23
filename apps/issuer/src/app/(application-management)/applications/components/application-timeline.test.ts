import type { ApplicationLogEntry } from "@/hooks/use-application-logs";
import { buildApplicationTimeline } from "./application-timeline";
import type { NormalizedApplication } from "../status";

function makeApp(): NormalizedApplication {
  return {
    id: "app_1",
    status: "SUBMITTED",
    updatedAt: "2026-08-01T00:00:00.000Z",
    applicationDate: "2026-08-01",
    submittedAt: "2026-08-01T00:00:00.000Z",
  } as unknown as NormalizedApplication;
}

function makeLog(
  overrides: Partial<ApplicationLogEntry> & Pick<ApplicationLogEntry, "id" | "event_type">
): ApplicationLogEntry {
  return {
    created_at: "2026-08-24T10:00:00.000Z",
    metadata: {},
    ...overrides,
  };
}

describe("buildApplicationTimeline", () => {
  const app = makeApp();

  it("hides item review and non-amendment section review from issuer application detail", () => {
    const timeline = buildApplicationTimeline(
      [
        makeLog({ id: "item", event_type: "APPLICATION_ITEM_REVIEW_UPDATED" }),
        makeLog({
          id: "approved",
          event_type: "APPLICATION_SECTION_REVIEW_UPDATED",
          metadata: { newStatus: "APPROVED" },
        }),
        makeLog({
          id: "pending",
          event_type: "APPLICATION_SECTION_REVIEW_UPDATED",
          metadata: { newStatus: "PENDING" },
        }),
        makeLog({ id: "review", event_type: "APPLICATION_REVIEW_STARTED" }),
      ],
      app
    );

    expect(timeline.map((item) => item.id)).toEqual(["review"]);
    expect(timeline.map((item) => item.label)).not.toContain("An item review was updated");
    expect(timeline.map((item) => item.label)).not.toContain("A section review was updated");
  });

  it("shows amendment section review as Changes Requested", () => {
    const timeline = buildApplicationTimeline(
      [
        makeLog({
          id: "req",
          event_type: "APPLICATION_SECTION_REVIEW_UPDATED",
          metadata: { newStatus: "REQUEST_AMENDMENT" },
          activity: "A section review was updated",
        }),
        makeLog({
          id: "requested",
          event_type: "APPLICATION_SECTION_REVIEW_UPDATED",
          metadata: { newStatus: "AMENDMENT_REQUESTED" },
        }),
      ],
      app
    );

    expect(timeline).toHaveLength(2);
    expect(timeline.every((item) => item.label === "Changes Requested")).toBe(true);
    expect(timeline.every((item) => item.description !== "A section review was updated")).toBe(true);
    expect(timeline.find((item) => item.id === "req")?.description).toBe(
      "Please make the requested changes."
    );
  });

  it("keeps document, review started, amendment acknowledged, and archived events visible", () => {
    const timeline = buildApplicationTimeline(
      [
        makeLog({ id: "started", event_type: "APPLICATION_REVIEW_STARTED" }),
        makeLog({ id: "ack", event_type: "APPLICATION_AMENDMENT_ACKNOWLEDGED" }),
        makeLog({ id: "archived", event_type: "APPLICATION_ARCHIVED" }),
        makeLog({ id: "uploaded", event_type: "APPLICATION_DOCUMENT_UPLOADED" }),
        makeLog({ id: "removed", event_type: "APPLICATION_DOCUMENT_REMOVED" }),
        makeLog({ id: "replaced", event_type: "APPLICATION_DOCUMENT_REPLACED" }),
      ],
      app
    );

    expect(timeline.map((item) => item.id).sort()).toEqual(
      ["ack", "archived", "removed", "replaced", "started", "uploaded"].sort()
    );
  });
});
