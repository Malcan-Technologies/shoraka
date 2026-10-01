/**
 * SECTION: Admin resubmit comparison — consecutive ApplicationRevision snapshots
 * WHY: "What changed in this application" Financial diff must compare rev N-1 → rev N of the same application.
 */

jest.mock("./repository", () => ({ AdminRepository: jest.fn().mockImplementation(() => ({})) }));
jest.mock("../regtank/repository", () => ({ RegTankRepository: jest.fn().mockImplementation(() => ({})) }));
jest.mock("../regtank/api-client", () => ({ RegTankAPIClient: jest.fn().mockImplementation(() => ({})) }));
jest.mock("../regtank/service", () => ({ RegTankService: jest.fn().mockImplementation(() => ({})) }));
jest.mock("../organization/repository", () => ({ OrganizationRepository: jest.fn().mockImplementation(() => ({})) }));
jest.mock("../notification/service", () => ({ NotificationService: jest.fn().mockImplementation(() => ({})) }));
jest.mock("../products/repository", () => ({ ProductRepository: jest.fn().mockImplementation(() => ({})) }));

const mockApplicationFindUnique = jest.fn();
const mockRevisionFindFirst = jest.fn();
const mockLogFindFirst = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    application: { findUnique: (...args: unknown[]) => mockApplicationFindUnique(...args) },
    applicationRevision: { findFirst: (...args: unknown[]) => mockRevisionFindFirst(...args) },
    applicationLog: { findFirst: (...args: unknown[]) => mockLogFindFirst(...args) },
  },
}));

import { diffIssuerFinancialRevisionSnapshots } from "@cashsouk/types";
import { AdminService } from "./service";

const fsSnap = (bsfatot2027: number) => ({
  application: {
    financial_statements: {
      unaudited_by_year: { "2026": { bsfatot: 100 }, "2027": { bsfatot: bsfatot2027 } },
      admin_input_by_year: { "2025": { bsfatot: 1 } },
    },
  },
});

const revisions: Record<number, unknown> = {
  1: fsSnap(150),
  2: fsSnap(200),
  3: fsSnap(250),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockApplicationFindUnique.mockResolvedValue({ id: "app-1" });
  mockLogFindFirst.mockResolvedValue(null);
  mockRevisionFindFirst.mockImplementation(({ where }: { where: { application_id: string; review_cycle: number } }) =>
    Promise.resolve(
      where.application_id === "app-1" && revisions[where.review_cycle]
        ? { snapshot: revisions[where.review_cycle], submitted_at: new Date("2026-09-01T00:00:00Z") }
        : null
    )
  );
});

describe("getResubmitComparisonSnapshots", () => {
  it("uses the immediately preceding revision of the same application as BEFORE", async () => {
    const result = await new AdminService().getResubmitComparisonSnapshots("app-1", 3);

    const cycles = mockRevisionFindFirst.mock.calls.map(([arg]) => arg.where);
    expect(cycles).toEqual(
      expect.arrayContaining([
        { application_id: "app-1", review_cycle: 3 },
        { application_id: "app-1", review_cycle: 2 },
      ])
    );
    expect(cycles).not.toContainEqual({ application_id: "app-1", review_cycle: 1 });
    expect(result.previous_review_cycle).toBe(2);
    expect(result.next_review_cycle).toBe(3);

    // Rev 2 → rev 3: only FY2027 changed (200 → 250); FY2025 Admin Input never appears.
    const diff = diffIssuerFinancialRevisionSnapshots(result.previous_snapshot, result.next_snapshot);
    expect(diff.map((d) => d.year)).toEqual([2027]);
    expect(diff[0]!.fields.bsfatot).toEqual({ issuerBefore: 200, issuerAfter: 250, changed: true });
  });
});
