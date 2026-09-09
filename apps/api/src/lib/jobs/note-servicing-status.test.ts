jest.mock("../prisma", () => ({
  prisma: {},
}));

jest.mock("../../modules/notification/service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("../../modules/notes/servicing-letters/service", () => ({
  generateAndSendServicingLetter: jest.fn(),
  resendServicingLetter: jest.fn(),
}));

jest.mock("../../modules/admin/book-metrics-snapshot", () => ({
  writeTodayBookMetricsSnapshot: jest.fn(),
}));

import { shouldSendArrearsLetter } from "./note-servicing-status";

describe("shouldSendArrearsLetter", () => {
  it("generates when no letter exists", () => {
    expect(shouldSendArrearsLetter(null)).toBe("generate");
  });

  it("retries when a letter was stored without a successful send", () => {
    expect(shouldSendArrearsLetter({ sent_at: null })).toBe("retry");
  });

  it("skips when a letter has already been emailed", () => {
    expect(shouldSendArrearsLetter({ sent_at: new Date("2026-09-09T00:00:00.000Z") })).toBe("skip");
  });
});
