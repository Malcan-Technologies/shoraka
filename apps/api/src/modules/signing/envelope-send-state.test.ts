import { ENVELOPE_SEND_STALE_MS, isEnvelopeSendStale, readEnvelopeSendState } from "./envelope-send-state";

describe("readEnvelopeSendState", () => {
  it("treats missing phase as idle", () => {
    expect(readEnvelopeSendState({})).toEqual({
      phase: "IDLE",
      inProgress: false,
      error: null,
      startedAt: null,
    });
  });

  it("reads an in-progress send", () => {
    const startedAt = new Date().toISOString();
    expect(
      readEnvelopeSendState({
        send_phase: "PREPARING",
        send_error: null,
        send_started_at: startedAt,
      })
    ).toEqual({ phase: "PREPARING", inProgress: true, error: null, startedAt });
  });

  it("expires a stale in-progress send", () => {
    const startedAt = new Date(Date.now() - ENVELOPE_SEND_STALE_MS - 1000).toISOString();
    const state = readEnvelopeSendState({
      send_phase: "DELIVERING",
      send_error: null,
      send_started_at: startedAt,
    });
    expect(state.inProgress).toBe(false);
    expect(state.phase).toBe("FAILED");
    expect(state.error).toMatch(/timed out/i);
  });
});

describe("isEnvelopeSendStale", () => {
  it("is false for idle or sent packages", () => {
    expect(isEnvelopeSendStale({ phase: "IDLE", startedAt: null })).toBe(false);
    expect(isEnvelopeSendStale({ phase: "SENT", startedAt: new Date() })).toBe(false);
  });
});
