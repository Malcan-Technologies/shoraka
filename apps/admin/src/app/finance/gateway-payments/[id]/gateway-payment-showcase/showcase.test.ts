/**
 * TEMPORARY GATEWAY PAYMENT SHOWCASE
 * Remove after UI review — see REMOVAL.md in this folder.
 */

import { getGatewayPaymentDetailVisibility } from "../gateway-payment-detail-model";
import {
  ALL_SHOWCASE_EVENT_TYPES,
  PREVIEW_ONLY_TOAST,
  SHOWCASE_QUERY_PARAM,
  SHOWCASE_SCENARIOS,
  buildAllActivityEvents,
  getShowcaseScenario,
  isGatewayPaymentShowcaseEnabled,
} from "./scenarios";

describe("gateway payment showcase activation", () => {
  it("is disabled in production even with query param", () => {
    expect(
      isGatewayPaymentShowcaseEnabled({ get: () => "1" }, "production")
    ).toBe(false);
  });

  it("is disabled without query param in development", () => {
    expect(
      isGatewayPaymentShowcaseEnabled({ get: () => null }, "development")
    ).toBe(false);
  });

  it("enables fixtures only in development/test with query=1", () => {
    expect(
      isGatewayPaymentShowcaseEnabled(
        { get: (name) => (name === SHOWCASE_QUERY_PARAM ? "1" : null) },
        "development"
      )
    ).toBe(true);
    expect(
      isGatewayPaymentShowcaseEnabled(
        { get: (name) => (name === SHOWCASE_QUERY_PARAM ? "1" : null) },
        "test"
      )
    ).toBe(true);
  });
});

describe("gateway payment showcase fixtures", () => {
  it("builds every scenario without crashing", () => {
    for (const scenario of SHOWCASE_SCENARIOS) {
      expect(scenario.payment.id).toBeTruthy();
      expect(scenario.payment.purpose).toBe(scenario.purpose);
      expect(scenario.payment.status).toBe(scenario.status);
      expect(() => getGatewayPaymentDetailVisibility(scenario.payment)).not.toThrow();
    }
  });

  it("uses real action visibility helpers", () => {
    const completedDeposit = getShowcaseScenario("completed-deposit");
    const visibility = getGatewayPaymentDetailVisibility(completedDeposit.payment);
    expect(visibility.showInitiateRefund).toBe(true);
    expect(visibility.showRetryRefund).toBe(false);

    const currency = getShowcaseScenario("currency-mismatch-deposit");
    const currencyVisibility = getGatewayPaymentDetailVisibility(currency.payment);
    expect(currencyVisibility.showCurrencyMismatchCard).toBe(true);
    expect(currencyVisibility.showRetryRefund).toBe(false);

    const wallet = getShowcaseScenario("wallet-funds-not-protected");
    const walletVisibility = getGatewayPaymentDetailVisibility(wallet.payment);
    expect(walletVisibility.showWalletReversalCard).toBe(true);
    expect(walletVisibility.showRetryRefund).toBe(false);
  });

  it("activity timeline includes all supported event types", () => {
    const events = buildAllActivityEvents();
    const types = new Set(events.map((event) => event.type));
    for (const type of ALL_SHOWCASE_EVENT_TYPES) {
      expect(types.has(type)).toBe(true);
    }
  });

  it("preview toast copy is non-destructive", () => {
    expect(PREVIEW_ONLY_TOAST).toContain("Preview only");
    expect(PREVIEW_ONLY_TOAST.toLowerCase()).toContain("no financial action");
  });
});

describe("old temporary showcase remnants", () => {
  it("does not export FORCE_GATEWAY_ACTION_PREVIEWS or PREVIEW_TIMELINE_EVENTS", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pageSource = require("fs").readFileSync(
      require("path").join(__dirname, "..", "page.tsx"),
      "utf8"
    ) as string;
    expect(pageSource).not.toContain("FORCE_GATEWAY_ACTION_PREVIEWS");
    expect(pageSource).not.toContain("PREVIEW_TIMELINE_EVENTS");
  });
});
