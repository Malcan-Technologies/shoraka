import fs from "node:fs";
import path from "node:path";
import type { SigningEnvelopeStatus } from "@cashsouk/types";
import { canResyncAdminSigningEnvelope } from "./signing-envelope-resync";

const PANEL_SOURCE = fs.readFileSync(
  path.join(__dirname, "signing-envelope-panel.tsx"),
  "utf8"
);

describe("canResyncAdminSigningEnvelope", () => {
  it.each<SigningEnvelopeStatus>(["SENT", "IN_PROGRESS", "COMPLETED"])(
    "shows Re-sync when canManage and status is %s",
    (status) => {
      expect(canResyncAdminSigningEnvelope(true, status)).toBe(true);
    }
  );

  it.each<SigningEnvelopeStatus>(["DRAFT", "VOIDED", "DECLINED", "EXPIRED"])(
    "hides Re-sync for closed or draft status %s",
    (status) => {
      expect(canResyncAdminSigningEnvelope(true, status)).toBe(false);
    }
  );

  it("hides Re-sync when the admin cannot manage signing", () => {
    expect(canResyncAdminSigningEnvelope(false, "SENT")).toBe(false);
    expect(canResyncAdminSigningEnvelope(false, "COMPLETED")).toBe(false);
  });
});

describe("signing envelope panel Re-sync wiring", () => {
  it("places an outline sm Re-sync button next to Void and invokes the sync mutation", () => {
    expect(PANEL_SOURCE).toContain("useSyncAdminSigningEnvelope");
    expect(PANEL_SOURCE).toContain("canResyncAdminSigningEnvelope");
    expect(PANEL_SOURCE).toContain("onResync={() => handleResync(primary.id)}");
    expect(PANEL_SOURCE).toContain("disabled={resyncDisabled}");
    expect(PANEL_SOURCE).toContain("syncMutation.isPending");
    expect(PANEL_SOURCE).toContain("Re-sync");
    expect(PANEL_SOURCE).toContain('size="sm"');
    expect(PANEL_SOURCE).toContain('variant="outline"');
    expect(PANEL_SOURCE).toContain("onClick={onResync}");
  });
});
