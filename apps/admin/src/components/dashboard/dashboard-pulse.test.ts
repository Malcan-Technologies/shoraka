jest.mock("@cashsouk/config", () => jest.requireActual("@cashsouk/config/src/currency"));

import { SC_PAR90_LIMIT_PERCENT } from "@cashsouk/types";
import {
  distressedPulseCopy,
  ledgerPulseCopy,
  par90PulseCopy,
  workQueuedPulseCopy,
} from "./dashboard-pulse";

describe("ledgerPulseCopy", () => {
  it("labels a non-negative ledger as balanced", () => {
    expect(ledgerPulseCopy(8858720)).toEqual({
      label: "Balanced",
      tone: "success",
      netLabel: "RM 8,858,720.00 net",
    });
    expect(ledgerPulseCopy(0).label).toBe("Balanced");
  });

  it("labels a negative ledger as negative", () => {
    expect(ledgerPulseCopy(-1200)).toEqual({
      label: "Negative",
      tone: "rejected",
      netLabel: "RM -1,200.00 net",
    });
  });
});

describe("par90PulseCopy", () => {
  it("treats PAR at or under the SC limit as inside", () => {
    expect(par90PulseCopy(1.64)).toEqual({
      percentLabel: "1.6%",
      status: "inside",
      subtitle: `limit ${SC_PAR90_LIMIT_PERCENT.toFixed(1)}% · SC test`,
      tone: "success",
    });
    expect(par90PulseCopy(SC_PAR90_LIMIT_PERCENT).status).toBe("inside");
  });

  it("treats PAR above the SC limit as over", () => {
    expect(par90PulseCopy(6.21)).toMatchObject({
      percentLabel: "6.2%",
      status: "over",
      tone: "rejected",
    });
  });
});

describe("distressedPulseCopy", () => {
  it("sums arrears and default and flags a rejected tone when any exist", () => {
    expect(distressedPulseCopy(7, 2)).toEqual({
      total: 9,
      subtitle: "7 arrears · 2 default",
      tone: "rejected",
    });
    expect(distressedPulseCopy(0, 0).tone).toBe("neutral");
  });
});

describe("workQueuedPulseCopy", () => {
  it("names the queue count", () => {
    expect(workQueuedPulseCopy(53, 8)).toEqual({
      itemsLabel: "53",
      subtitle: "items · 8 queues",
    });
    expect(workQueuedPulseCopy(1, 1).subtitle).toBe("items · 1 queue");
  });
});
