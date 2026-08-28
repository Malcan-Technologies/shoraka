import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GatewayPaymentEventType, GatewayPaymentStatus } from "@prisma/client";
import { webhookAuditContext } from "../../lib/audit";
import { recordGatewayPaymentCompletedIfAbsent } from "./gateway-events";

const webhookSrc = readFileSync(join(__dirname, "webhook-service.ts"), "utf8");

describe("fee activity is atomic with capture completion", () => {
  it("does not swallow ONBOARDING_FEE_PAID or APPLICATION_PROCESSING_FEE_PAID writes", () => {
    expect(webhookSrc).not.toMatch(/Failed to write ONBOARDING_FEE_PAID activity/);
    expect(webhookSrc).not.toMatch(/Failed to write APPLICATION_PROCESSING_FEE_PAID activity/);
    const onboardingFn = webhookSrc.slice(webhookSrc.indexOf("async function ensureOnboardingFeePaidActivity"));
    const processingFn = webhookSrc.slice(
      webhookSrc.indexOf("async function ensureApplicationProcessingFeePaidActivity")
    );
    expect(onboardingFn.slice(0, 1800)).not.toMatch(/try\s*\{/);
    expect(processingFn.slice(0, 1800)).not.toMatch(/try\s*\{/);
  });

  it("writes GATEWAY_PAYMENT_COMPLETED once per payment", async () => {
    const created: unknown[] = [];
    const tx = {
      gatewayPaymentEvent: {
        findFirst: jest.fn(async () => (created.length ? { id: "evt-1" } : null)),
        create: jest.fn(async ({ data }: { data: unknown }) => {
          created.push(data);
          return { id: `evt-${created.length}`, ...((data as object) ?? {}) };
        }),
      },
    };

    await recordGatewayPaymentCompletedIfAbsent(tx as never, {
      gatewayPaymentId: "pay-1",
      fromStatus: GatewayPaymentStatus.PAID,
      context: webhookAuditContext(),
    });
    await recordGatewayPaymentCompletedIfAbsent(tx as never, {
      gatewayPaymentId: "pay-1",
      fromStatus: GatewayPaymentStatus.PAID,
      context: webhookAuditContext(),
    });

    expect(created).toHaveLength(1);
    expect(created[0]).toEqual(
      expect.objectContaining({
        gateway_payment_id: "pay-1",
        type: GatewayPaymentEventType.GATEWAY_PAYMENT_COMPLETED,
        to_status: GatewayPaymentStatus.COMPLETED,
        source: "WEBHOOK",
      })
    );
  });
});
