import { AuditLogAggregator } from "./aggregator";
import { AuditLogAdapter, UnifiedActivity, ActivityFilters, ActivityCategory } from "./adapters/base";
import { ActivityDomain } from "@cashsouk/types";

// Mock data record type
interface MockRecord {
  id: string;
  user_id: string;
  text: string;
  created_at: Date;
}

// Mock adapter to test aggregator logic without real database calls
class MockAdapter implements AuditLogAdapter<MockRecord> {
  constructor(
    public readonly name: string,
    public readonly category: ActivityCategory,
    public readonly domain: ActivityDomain,
    private mockData: MockRecord[]
  ) {}

  async query(_userId: string, _filters: ActivityFilters): Promise<MockRecord[]> {
    return this.mockData;
  }

  async count(_userId: string, _filters: ActivityFilters): Promise<number> {
    return this.mockData.length;
  }

  transform(record: MockRecord): UnifiedActivity {
    return {
      id: record.id,
      user_id: record.user_id,
      category: this.category,
      domain: this.domain,
      event_type: "MOCK_EVENT",
      activity: record.text,
      title: record.text,
      description: `${record.text} description`,
      created_at: record.created_at,
      source_table: "mock",
    };
  }

  buildPresentation() {
    return { title: "Mock Event", description: "Mock description" };
  }

  getEventTypes() { return ["MOCK_EVENT"]; }
}

describe("AuditLogAggregator", () => {
  const userId = "user1";

  it("should merge and sort activities from multiple adapters", async () => {
    const aggregator = new AuditLogAggregator();
    // Clear default adapters for testing
    (aggregator as any).adapters = [];

    const date1 = new Date("2026-01-01T10:00:00Z");
    const date2 = new Date("2026-01-01T11:00:00Z");
    const date3 = new Date("2026-01-01T09:00:00Z");

    const adapterA = new MockAdapter("A", "organization", "onboarding", [
      { id: "1", user_id: userId, text: "Later Org", created_at: date2 },
      { id: "2", user_id: userId, text: "Earlier Org", created_at: date3 },
    ]);

    const adapterB = new MockAdapter("B", "organization", "application", [
      { id: "3", user_id: userId, text: "Middle Org", created_at: date1 },
    ]);

    aggregator.registerAdapter(adapterA);
    aggregator.registerAdapter(adapterB);

    const result = await aggregator.aggregate(userId, { limit: 10, offset: 0 });

    expect(result.activities).toHaveLength(3);
    expect(result.activities[0].id).toBe("1"); // date2 (11:00)
    expect(result.activities[1].id).toBe("3"); // date1 (10:00)
    expect(result.activities[2].id).toBe("2"); // date3 (09:00)
  });

  it("should respect pagination filters", async () => {
    const aggregator = new AuditLogAggregator();
    (aggregator as any).adapters = [];

    const data = Array.from({ length: 15 }, (_, i) => ({
      id: `${i}`,
      user_id: userId,
      text: `Activity ${i}`,
      created_at: new Date(2026, 0, i + 1),
    }));

    aggregator.registerAdapter(new MockAdapter("A", "organization", "application", data));

    // Page 1 (limit 10)
    const result1 = await aggregator.aggregate(userId, { limit: 10, offset: 0 });
    expect(result1.activities).toHaveLength(10);
    expect(result1.total).toBe(15);

    // Page 2 (limit 10)
    const result2 = await aggregator.aggregate(userId, { limit: 10, offset: 10 });
    expect(result2.activities).toHaveLength(5);
  });

  it("should filter by category", async () => {
    const aggregator = new AuditLogAggregator();
    (aggregator as any).adapters = [];

    aggregator.registerAdapter(
      new MockAdapter("A", "organization", "onboarding", [
        { id: "1", created_at: new Date(), user_id: userId, text: "Test Activity" },
      ])
    );

    const result = await aggregator.aggregate(userId, {
      limit: 10,
      offset: 0,
      categories: ["organization"]
    });

    expect(result.activities).toHaveLength(1);
    expect(result.activities[0].category).toBe("organization");
  });

  it("should filter by domain", async () => {
    const aggregator = new AuditLogAggregator();
    (aggregator as any).adapters = [];

    aggregator.registerAdapter(
      new MockAdapter("A", "organization", "onboarding", [
        { id: "1", created_at: new Date("2026-01-01T10:00:00Z"), user_id: userId, text: "Onboarding" },
      ])
    );
    aggregator.registerAdapter(
      new MockAdapter("B", "organization", "application", [
        { id: "2", created_at: new Date("2026-01-01T11:00:00Z"), user_id: userId, text: "Application" },
      ])
    );

    const result = await aggregator.aggregate(userId, {
      limit: 10,
      offset: 0,
      domains: ["application"],
    });

    expect(result.activities).toHaveLength(1);
    expect(result.activities[0].domain).toBe("application");
  });

  it("should exclude application activities for investor-scoped requests", async () => {
    const aggregator = new AuditLogAggregator();
    (aggregator as any).adapters = [];

    aggregator.registerAdapter(
      new MockAdapter("Onboarding", "organization", "onboarding", [
        { id: "1", created_at: new Date("2026-01-01T10:00:00Z"), user_id: userId, text: "Onboarding" },
      ])
    );
    aggregator.registerAdapter(
      new MockAdapter("Application", "organization", "application", [
        { id: "2", created_at: new Date("2026-01-01T11:00:00Z"), user_id: userId, text: "Application" },
      ])
    );
    aggregator.registerAdapter(
      new MockAdapter("Note", "organization", "note", [
        { id: "3", created_at: new Date("2026-01-01T12:00:00Z"), user_id: userId, text: "Note" },
      ])
    );

    const result = await aggregator.aggregate(userId, {
      limit: 10,
      offset: 0,
      portalType: "investor",
    });

    expect(result.activities).toHaveLength(2);
    expect(result.activities.map((activity) => activity.domain)).toEqual(["note", "onboarding"]);
    expect(result.total).toBe(2);
    expect(result.unfilteredTotal).toBe(2);
  });
});
