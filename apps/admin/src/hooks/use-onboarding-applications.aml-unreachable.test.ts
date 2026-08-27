/**
 * Regression guard for the audit finding that `AML_APPROVED` is UNREACHABLE from the current
 * Admin UI (see docs/audit/audit-event-surface-matrix.md §2.3 and §9 #11).
 *
 * `useApproveAmlScreening` (a manual admin AML approval/override hook) is fully wired end-to-end
 * on the backend — route, service, SDK method, hook — but no `.tsx` component calls it, so the
 * `AML_APPROVED` writer can never fire in production. Live AML progression is automatic via
 * `ONBOARDING_STATUS_UPDATED` + `metadata.amlApproved:true`.
 *
 * If this test starts failing, a component now calls the hook: `AML_APPROVED` has become
 * reachable, and the audit docs (surface matrix, catalog, product gap review, registry.json)
 * must be updated back from UNREACHABLE to LIVE — do not just delete this test.
 */
jest.mock("@cashsouk/config", () => ({
  createApiClient: jest.fn(),
  useAuthToken: jest.fn(),
}));
jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));

import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { useApproveAmlScreening } from "./use-onboarding-applications";

const ADMIN_SRC = join(__dirname, "..");

function collectFiles(dir: string, extension: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      collectFiles(fullPath, extension, out);
    } else if (entry.endsWith(extension)) {
      out.push(fullPath);
    }
  }
  return out;
}

describe("AML_APPROVED unreachability (audit finding, 2026-08-24)", () => {
  it("useApproveAmlScreening hook still exists (fully wired backend plumbing, intentionally dormant)", () => {
    expect(typeof useApproveAmlScreening).toBe("function");
  });

  it("no .tsx component in the admin app calls useApproveAmlScreening", () => {
    const tsxFiles = collectFiles(ADMIN_SRC, ".tsx");
    const callers = tsxFiles.filter((file) =>
      readFileSync(file, "utf8").includes("useApproveAmlScreening")
    );
    expect(callers).toEqual([]);
  });

  it("useApproveAmlScreening has exactly one occurrence in .ts sources — its own definition", () => {
    const tsFiles = collectFiles(ADMIN_SRC, ".ts").filter((file) => !file.endsWith(".test.ts"));
    const occurrences = tsFiles.filter((file) =>
      readFileSync(file, "utf8").includes("useApproveAmlScreening")
    );
    expect(occurrences).toEqual([join(ADMIN_SRC, "hooks/use-onboarding-applications.ts")]);
  });
});
