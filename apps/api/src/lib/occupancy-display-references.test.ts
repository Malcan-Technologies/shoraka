import { emptyCapacitySnapshot } from "./contract-facility";
import {
  buildFacilityOccupancyAuditMetadata,
  occupancyDisplayRefsFromLoaded,
  recordFacilityOccupancyAudit,
} from "./refresh-contract-facility";
import { ApplicationLogEventType } from "../modules/applications/logs/types";

const before = emptyCapacitySnapshot();
const after = { ...emptyCapacitySnapshot(), utilizedFacility: 10_000, availableFacility: 40_000 };

describe("occupancy display references", () => {
  it("snapshots class-B refs from already-loaded rows and never copies DB ids", () => {
    const refs = occupancyDisplayRefsFromLoaded({
      applicationId: "app-cuid",
      contractId: "contract-cuid",
      invoiceId: "invoice-cuid",
      noteId: "note-cuid",
      contractDisplayReference: "FAC-ARF-202608-A1Z",
      originatingApplication: { id: "app-cuid", display_reference: "APP-CS-2026-001" },
      invoice: {
        id: "invoice-cuid",
        display_reference: "INV-ARF-202608-B2Y",
        application: { id: "app-cuid", display_reference: "APP-CS-2026-001" },
      },
      note: { id: "note-cuid", note_reference: "NT-ARF-202608-K9P" },
    });
    expect(refs).toEqual({
      applicationReference: "APP-CS-2026-001",
      contractReference: "FAC-ARF-202608-A1Z",
      invoiceReference: "INV-ARF-202608-B2Y",
      noteReference: "NT-ARF-202608-K9P",
    });
  });

  it("omits display refs when the only available value is the canonical DB id", () => {
    const refs = occupancyDisplayRefsFromLoaded({
      applicationId: "app-cuid",
      contractId: "contract-cuid",
      invoiceId: "invoice-cuid",
      noteId: "note-cuid",
      contractDisplayReference: "contract-cuid",
      originatingApplication: { id: "app-cuid", display_reference: "app-cuid" },
      invoice: {
        id: "invoice-cuid",
        display_reference: "invoice-cuid",
        application: { id: "app-cuid", display_reference: "app-cuid" },
      },
      note: { id: "note-cuid", note_reference: "note-cuid" },
    });
    expect(refs.applicationReference).toBeUndefined();
    expect(refs.contractReference).toBeUndefined();
    expect(refs.invoiceReference).toBeUndefined();
    expect(refs.noteReference).toBeUndefined();
  });

  it("keeps occupancy before/after snapshots beside display refs", () => {
    const metadata = buildFacilityOccupancyAuditMetadata({
      contractId: "contract-cuid",
      before,
      after,
      audit: {
        userId: "user-1",
        reason: "INVOICE_ACCEPTED",
        noteId: "note-cuid",
        invoiceId: "invoice-cuid",
      },
      displayRefs: {
        applicationReference: "APP-CS-2026-001",
        contractReference: "FAC-ARF-202608-A1Z",
        invoiceReference: "INV-ARF-202608-B2Y",
        noteReference: "NT-ARF-202608-K9P",
      },
    });
    expect(metadata).toMatchObject({
      reason: "INVOICE_ACCEPTED",
      contract_id: "contract-cuid",
      note_id: "note-cuid",
      invoice_id: "invoice-cuid",
      applicationReference: "APP-CS-2026-001",
      contractReference: "FAC-ARF-202608-A1Z",
      invoiceReference: "INV-ARF-202608-B2Y",
      noteReference: "NT-ARF-202608-K9P",
      before: { utilized_facility: 0, available_facility: 0 },
      after: { utilized_facility: 10_000, available_facility: 40_000 },
    });
    expect(metadata).not.toHaveProperty("application_id");
  });

  it("writes occupancy application logs with the same display-ref params as logApplicationActivity", async () => {
    const db = {
      applicationLog: { create: jest.fn(async (args: { data: Record<string, unknown> }) => args.data) },
      noteEvent: { create: jest.fn(async (args: { data: Record<string, unknown> }) => args.data) },
    };
    await recordFacilityOccupancyAudit(db as never, {
      contractId: "contract-cuid",
      applicationId: "app-cuid",
      before,
      after,
      audit: {
        userId: "user-1",
        reason: "FUNDING_CLOSED",
        noteId: "note-cuid",
        invoiceId: "invoice-cuid",
        portal: "ADMIN",
      },
      displayRefs: {
        applicationReference: "APP-CS-2026-001",
        contractReference: "FAC-ARF-202608-A1Z",
        invoiceReference: "INV-ARF-202608-B2Y",
        noteReference: "NT-ARF-202608-K9P",
      },
    });
    expect(db.applicationLog.create).toHaveBeenCalledTimes(1);
    const applicationRow = db.applicationLog.create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(applicationRow.event_type).toBe(ApplicationLogEventType.CONTRACT_FACILITY_OCCUPANCY_UPDATED);
    expect(applicationRow.application_id).toBe("app-cuid");
    expect(applicationRow.entity_id).toBe("contract-cuid");
    expect(applicationRow.metadata).toMatchObject({
      applicationReference: "APP-CS-2026-001",
      contractReference: "FAC-ARF-202608-A1Z",
      invoiceReference: "INV-ARF-202608-B2Y",
      noteReference: "NT-ARF-202608-K9P",
      before: expect.any(Object),
      after: expect.any(Object),
    });
    expect(applicationRow.metadata).not.toHaveProperty("application_id");

    expect(db.noteEvent.create).toHaveBeenCalledTimes(1);
    const noteRow = db.noteEvent.create.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(noteRow.event_type).toBe("FACILITY_OCCUPANCY_UPDATED");
    expect(noteRow.metadata).toMatchObject({
      contractReference: "FAC-ARF-202608-A1Z",
      noteReference: "NT-ARF-202608-K9P",
    });
  });
});
