import fs from "node:fs";
import path from "node:path";

const hookSource = fs.readFileSync(path.join(__dirname, "use-signing-envelopes.ts"), "utf8");

describe("useSyncAdminSigningEnvelope", () => {
  it("POSTs via the admin sync client method and invalidates on success and error", () => {
    expect(hookSource).toContain("export function useSyncAdminSigningEnvelope");
    expect(hookSource).toContain("apiClient.syncAdminSigningEnvelopeFromProvider(envelopeId)");
    expect(hookSource).toContain("invalidateAfterSigningMutation(queryClient, applicationId)");
    expect(hookSource).toMatch(
      /onSuccess: \(\) => \{\s*invalidateAfterSigningMutation\(queryClient, applicationId\);\s*\},\s*onError: \(\) => \{\s*invalidateAfterSigningMutation\(queryClient, applicationId\);\s*\},/
    );
  });
});
