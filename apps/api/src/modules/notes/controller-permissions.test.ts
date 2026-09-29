import * as fs from "fs";
import * as path from "path";

const CONTROLLER = fs.readFileSync(path.join(__dirname, "controller.ts"), "utf8");

/** Permission passed to requirePermission for an `adminNotesRouter.post("<route>", ...)` registration. */
function notesPostPermission(route: string): string | null {
  const needle = `adminNotesRouter.post(\n  "${route}",\n  requirePermission("`;
  const idx = CONTROLLER.indexOf(needle);
  if (idx === -1) return null;
  const start = idx + needle.length;
  return CONTROLLER.slice(start, CONTROLLER.indexOf('")', start));
}

describe("notes trustee letter and late charge waiver permissions", () => {
  it.each([
    "/:id/settlements/:settlementId/settlement-trustee/generate-letter",
    "/:id/settlements/:settlementId/settlement-trustee/mark-submitted-to-trustee",
    "/:id/settlements/:settlementId/settlement-trustee/resend-trustee-email",
    "/:id/settlements/:settlementId/settlement-trustee/mark-completed",
  ])("settlement-phase trustee route %s uses notes.settlement.manage", (route) => {
    expect(notesPostPermission(route)).toBe("notes.settlement.manage");
  });

  it("late charge waiver uses notes.default.manage (Late Payment tab)", () => {
    expect(notesPostPermission("/:id/late-charge/waive")).toBe("notes.default.manage");
  });

  it("keeps disbursement-phase trustee letters on the withdrawal permission helper", () => {
    for (const route of [
      "/:id/generate-letter",
      "/:id/mark-submitted-to-trustee",
      "/:id/resend-trustee-email",
      "/:id/mark-completed",
    ]) {
      const idx = CONTROLLER.indexOf(`withdrawalsRouter.post(\n  "${route}",`);
      expect(idx).toBeGreaterThan(-1);
      expect(CONTROLLER.slice(idx, idx + 400)).toContain("assertWithdrawalManagePermission");
    }
    expect(CONTROLLER).toContain('userHasPermission(req, "investor_withdrawals.manage")');
    expect(CONTROLLER).toContain('userHasPermission(req, "notes.disbursement.manage")');
  });

  it("keeps the other settlement documents on notes.settlement.manage", () => {
    expect(notesPostPermission("/:id/settlements/approve")).toBe("notes.settlement.manage");
    expect(notesPostPermission("/:id/settlements/post")).toBe("notes.settlement.manage");
  });
});
