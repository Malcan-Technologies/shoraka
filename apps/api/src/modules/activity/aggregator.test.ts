import { AuditLogAggregator } from "./aggregator";
import { AuditLogAdapter, UnifiedActivity, ActivityFilters } from "./adapters/base";

// Mock adapter
class MockAdapter implements AuditLogAdapter<any> {
  constructor(
    public readonly name: string,
    public readonly category: any,
    private mockData: any[]
  ) {}

  async query(userId: string, filters: ActivityFilters): Promise<any[]> {
    return this.mockData;
  }

  transform(record: any): UnifiedActivity {
    return {
      id: record.id,
      user_id: record.user_id,
      category: this.category,
      event_type: "MOCK_EVENT",
      activity: record.text,
      created_at: record.created_at,
      source_table: "mock",
    };
  }

  buildDescription() { return ""; }
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

    const adapterA = new MockAdapter("A", "security", [
      { id: "1", user_id: userId, text: "Later Security", created_at: date2 },
      { id: "2", user_id: userId, text: "Earlier Security", created_at: date3 },
    ]);

    const adapterB = new MockAdapter("B", "onboarding", [
      { id: "3", user_id: userId, text: "Middle Onboarding", created_at: date1 },
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

    aggregator.registerAdapter(new MockAdapter("A", "security", data));

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

    aggregator.registerAdapter(new MockAdapter("A", "security", [{ id: "1", created_at: new Date() }]));
    aggregator.registerAdapter(new MockAdapter("B", "onboarding", [{ id: "2", created_at: new Date() }]));

    const result = await aggregator.aggregate(userId, {
      limit: 10,
      offset: 0,
      categories: ["security"]
    });

    expect(result.activities).toHaveLength(1);
    expect(result.activities[0].category).toBe("security");
  });
});
