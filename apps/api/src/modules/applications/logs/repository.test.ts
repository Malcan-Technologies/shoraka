import { AUDIT_ACTOR_TYPE, AUDIT_SOURCE, internalAuditContext } from "../../../lib/audit";
import { createApplicationLog } from "./repository";
import { ApplicationLogEventType } from "./types";

function fakeDb() {
  const created: unknown[] = [];
  return {
    created,
    db: {
      applicationLog: {
        create: jest.fn(async ({ data }: { data: unknown }) => {
          created.push(data);
          return data;
        }),
      },
    } as never,
  };
}

describe("createApplicationLog system-derived rows", () => {
  it("stores a null actor and INTERNAL source when CTOS resets a section", async () => {
    const { db, created } = fakeDb();
    await createApplicationLog(
      {
        userId: null,
        applicationId: "app-1",
        eventType: ApplicationLogEventType.SECTION_REVIEWED_PENDING,
        portal: null,
        context: internalAuditContext(),
        source: AUDIT_SOURCE.INTERNAL,
        metadata: { scope: "section", scope_key: "financial" },
      },
      db
    );

    expect(created[0]).toEqual(
      expect.objectContaining({
        user_id: null,
        actor_type: AUDIT_ACTOR_TYPE.SYSTEM,
        source: AUDIT_SOURCE.INTERNAL,
        portal: null,
      })
    );
  });
});
