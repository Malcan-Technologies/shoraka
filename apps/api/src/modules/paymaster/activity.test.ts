import {
  applicationLogBelongsToPaymaster,
  listAdminPaymasterActivity,
  selectPaymasterIdentityActivityLogs,
} from "./activity";

jest.mock("../../lib/prisma", () => ({
  prisma: {
    paymaster: { findUnique: jest.fn() },
    applicationLog: { findMany: jest.fn() },
    issuerOrganization: { findMany: jest.fn() },
    application: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
  },
}));

jest.mock("../../lib/user-display-name", () => ({
  loadUserDisplayNameMap: jest.fn(async (_db: unknown, userIds: Array<string | null>) => {
    const names = new Map<string, string>();
    for (const id of userIds) {
      if (id === "admin-a") names.set(id, "Admin A");
      if (id === "issuer-user") names.set(id, "Issuer User");
    }
    return names;
  }),
}));

import { prisma } from "../../lib/prisma";

const paymasterId = "pm_abc";
const otherPaymasterId = "pm_other";

function logRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "log-1",
    event_type: "PAYMASTER_CREATED",
    created_at: new Date("2026-08-10T01:14:00.000Z"),
    remark: "ABC (202134567890) created as Unverified.",
    user_id: "issuer-user",
    portal: "ISSUER",
    entity_id: paymasterId,
    application_id: "app-a",
    metadata: {
      paymaster_id: paymasterId,
      issuer_organization_id: "org-a",
      application_id: "app-a",
      related_party: false,
      verification_status: "UNVERIFIED",
      legalName: "ABC Trading Sdn Bhd",
      registrationNumber: "202134567890",
    },
    ...overrides,
  };
}

describe("Paymaster identity Activity filter", () => {
  it("keeps only identity events for the requested paymaster_id", () => {
    const created = logRow();
    const other = logRow({
      id: "log-other",
      event_type: "PAYMASTER_LINKED_TO_ISSUER",
      entity_id: otherPaymasterId,
      metadata: { paymaster_id: otherPaymasterId, issuer_organization_id: "org-z" },
    });
    const noticeShaped = logRow({
      id: "log-notice-shaped",
      event_type: "PAYMASTER_NOTICE_GENERATED",
      metadata: { paymaster_id: paymasterId },
    });
    const selected = selectPaymasterIdentityActivityLogs(
      [created, other, noticeShaped] as never,
      paymasterId
    );
    expect(selected.map((row) => row.id)).toEqual(["log-1"]);
    expect(applicationLogBelongsToPaymaster(other, paymasterId)).toBe(false);
  });

  it("does not match by registration number, legal name, issuer, or application alone", () => {
    const byName = logRow({
      entity_id: otherPaymasterId,
      metadata: {
        paymaster_id: otherPaymasterId,
        legalName: "ABC Trading Sdn Bhd",
        registrationNumber: "202134567890",
        issuer_organization_id: "org-a",
        application_id: "app-a",
      },
    });
    expect(applicationLogBelongsToPaymaster(byName, paymasterId)).toBe(false);
  });

  it("orders by timestamp newest first and keeps every issuer link row", () => {
    const created = logRow({ id: "created", created_at: new Date("2026-08-10T01:14:00.000Z") });
    const verified = logRow({
      id: "verified",
      event_type: "PAYMASTER_VERIFIED",
      created_at: new Date("2026-08-12T03:30:00.000Z"),
      metadata: {
        paymaster_id: paymasterId,
        previous_status: "UNVERIFIED",
        new_status: "VERIFIED",
        verification_status: "VERIFIED",
      },
    });
    const linkedB = logRow({
      id: "linked-b",
      event_type: "PAYMASTER_LINKED_TO_ISSUER",
      created_at: new Date("2026-08-20T07:42:00.000Z"),
      metadata: { paymaster_id: paymasterId, issuer_organization_id: "org-b", related_party: true },
    });
    const linkedC = logRow({
      id: "linked-c",
      event_type: "PAYMASTER_LINKED_TO_ISSUER",
      created_at: new Date("2026-08-25T07:42:00.000Z"),
      metadata: { paymaster_id: paymasterId, issuer_organization_id: "org-c", related_party: false },
    });
    const selected = selectPaymasterIdentityActivityLogs(
      [created, linkedC, verified, linkedB] as never,
      paymasterId
    );
    expect(selected.map((row) => row.id)).toEqual(["linked-c", "linked-b", "verified", "created"]);
    expect(selected.filter((row) => row.event_type === "PAYMASTER_LINKED_TO_ISSUER")).toHaveLength(2);
    expect(selected.filter((row) => row.event_type === "PAYMASTER_VERIFIED")).toHaveLength(1);
    expect(selected.filter((row) => row.event_type === "PAYMASTER_CREATED")).toHaveLength(1);
  });

  it("does not fabricate an initial Linked event when only Created exists for the first issuer", () => {
    const created = logRow();
    const selected = selectPaymasterIdentityActivityLogs([created] as never, paymasterId);
    expect(selected).toHaveLength(1);
    expect(selected[0]?.event_type).toBe("PAYMASTER_CREATED");
    expect(selected.some((row) => row.event_type === "PAYMASTER_LINKED_TO_ISSUER")).toBe(false);
  });
});

describe("listAdminPaymasterActivity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.paymaster.findUnique as jest.Mock).mockResolvedValue({ id: paymasterId });
    (prisma.issuerOrganization.findMany as jest.Mock).mockResolvedValue([
      { id: "org-a", name: "Harbour Manufacturing", display_reference: "ISS-A" },
      { id: "org-b", name: "Issuer B", display_reference: "ISS-B" },
      { id: "org-c", name: "Issuer C", display_reference: "ISS-C" },
    ]);
    (prisma.application.findMany as jest.Mock).mockResolvedValue([
      {
        id: "app-a",
        display_reference: "APP-A",
        financing_type: { product_id: "prod-1" },
      },
      {
        id: "app-b",
        display_reference: "APP-B",
        financing_type: { product_id: "prod-1" },
      },
    ]);
  });

  it("404s when the Paymaster does not exist", async () => {
    (prisma.paymaster.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(listAdminPaymasterActivity(paymasterId)).rejects.toMatchObject({
      statusCode: 404,
      code: "PAYMASTER_NOT_FOUND",
    });
    expect(prisma.applicationLog.findMany).not.toHaveBeenCalled();
  });

  it("returns Created, Verified, and each later issuer link without inventing the initial link", async () => {
    (prisma.applicationLog.findMany as jest.Mock).mockResolvedValue([
      logRow({
        id: "linked-c",
        event_type: "PAYMASTER_LINKED_TO_ISSUER",
        created_at: new Date("2026-08-25T07:42:00.000Z"),
        application_id: "app-b",
        metadata: {
          paymaster_id: paymasterId,
          issuer_organization_id: "org-c",
          application_id: "app-b",
          related_party: false,
        },
      }),
      logRow({
        id: "linked-b",
        event_type: "PAYMASTER_LINKED_TO_ISSUER",
        created_at: new Date("2026-08-20T07:42:00.000Z"),
        application_id: "app-b",
        metadata: {
          paymaster_id: paymasterId,
          issuer_organization_id: "org-b",
          application_id: "app-b",
          related_party: true,
        },
      }),
      logRow({
        id: "verified",
        event_type: "PAYMASTER_VERIFIED",
        created_at: new Date("2026-08-12T03:30:00.000Z"),
        user_id: "admin-a",
        portal: "ADMIN",
        metadata: {
          paymaster_id: paymasterId,
          previous_status: "UNVERIFIED",
          new_status: "VERIFIED",
          verification_status: "VERIFIED",
          application_id: "app-a",
        },
      }),
      logRow({ id: "created" }),
      logRow({
        id: "other-pm",
        event_type: "PAYMASTER_LINKED_TO_ISSUER",
        entity_id: otherPaymasterId,
        metadata: { paymaster_id: otherPaymasterId, issuer_organization_id: "org-z" },
      }),
    ]);

    const { events } = await listAdminPaymasterActivity(paymasterId);

    expect(prisma.applicationLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          event_type: {
            in: ["PAYMASTER_CREATED", "PAYMASTER_LINKED_TO_ISSUER", "PAYMASTER_VERIFIED"],
          },
        }),
        orderBy: { created_at: "desc" },
      })
    );
    const where = (prisma.applicationLog.findMany as jest.Mock).mock.calls[0][0].where;
    expect(JSON.stringify(where)).not.toMatch(/legalName|registration_number|registrationNumber/);
    expect(events.map((event) => event.id)).toEqual(["linked-c", "linked-b", "verified", "created"]);
    expect(events.some((event) => event.paymasterId !== paymasterId)).toBe(false);
    expect(events.filter((event) => event.eventType === "PAYMASTER_LINKED_TO_ISSUER")).toEqual([
      expect.objectContaining({
        id: "linked-c",
        issuerOrganizationId: "org-c",
        issuerName: "Issuer C",
        relatedParty: false,
      }),
      expect.objectContaining({
        id: "linked-b",
        issuerOrganizationId: "org-b",
        issuerName: "Issuer B",
        relatedParty: true,
      }),
    ]);
    expect(events.find((event) => event.eventType === "PAYMASTER_CREATED")).toMatchObject({
      issuerName: "Harbour Manufacturing",
      applicationDisplayReference: "APP-A",
      applicationProductId: "prod-1",
      verificationStatus: "UNVERIFIED",
      actorName: "Issuer User",
    });
    expect(events.filter((event) => event.eventType === "PAYMASTER_VERIFIED")).toEqual([
      expect.objectContaining({
        actorName: "Admin A",
        previousStatus: "UNVERIFIED",
        newStatus: "VERIFIED",
      }),
    ]);
  });
});

describe("Paymaster Activity reader does not notify or write", () => {
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");

  it("is a read-only Admin query of existing application_logs rows", () => {
    const src = readFileSync(join(__dirname, "activity.ts"), "utf8");
    expect(src).toContain("prisma.applicationLog.findMany");
    expect(src).not.toMatch(/writePaymasterIdentityApplicationLog|logApplicationActivity/);
    expect(src).not.toMatch(/sendTyped|NotificationService|createInternal/);
    expect(src).not.toMatch(/applicationLog\.create|applicationLog\.update/);
  });

  it("does not expose Activity on the issuer Paymaster router", () => {
    const src = readFileSync(join(__dirname, "controller.ts"), "utf8");
    const issuerBlock = src.slice(
      src.indexOf("export function createIssuerPaymasterRouter"),
      src.indexOf("export const adminPaymasterRouter")
    );
    expect(issuerBlock).not.toMatch(/activity/);
    expect(src).toMatch(/\/:id\/activity/);
    expect(src).toMatch(/listAdminPaymasterActivity/);
    expect(src).toMatch(/paymasters\.view/);
  });
});
