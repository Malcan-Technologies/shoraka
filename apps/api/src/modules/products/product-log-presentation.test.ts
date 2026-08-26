import { buildAuditCsv } from "../../lib/audit-csv";
import { productNameFromLogMetadata } from "./product-log-presentation";

function csvForLog(input: {
  eventType: string;
  eventLabel: string;
  metadata: Record<string, unknown> | null;
  productId?: string | null;
  actor?: string;
  actorEmail?: string;
}) {
  return buildAuditCsv(
    [
      {
        timestamp: "2026-08-27T00:00:00.000Z",
        event: input.eventLabel,
        eventType: input.eventType,
        actor: input.actor ?? "Ada Admin",
        actorType: "ADMIN",
        actorEmail: input.actorEmail ?? "ada@example.com",
        extra: {
          "Product Name": productNameFromLogMetadata(input.metadata) ?? "",
          "Product ID": input.productId ?? "prod_1",
        },
      },
    ],
    ["Product Name", "Product ID", "IP Address", "Device", "User Agent"]
  );
}

describe("productNameFromLogMetadata", () => {
  it("reads PRODUCT_CREATED / UPDATED / DELETED workflow config.name", () => {
    const metadata = {
      workflow: [{ config: { name: "Invoice Financing" } }],
    };
    expect(productNameFromLogMetadata(metadata)).toBe("Invoice Financing");
  });

  it("falls back to config.type.name when config.name is absent", () => {
    const metadata = {
      workflow: [{ config: { type: { name: "Receivables Financing" } } }],
    };
    expect(productNameFromLogMetadata(metadata)).toBe("Receivables Financing");
  });

  it("does not invent a name for PRODUCT_INACTIVATED / PRODUCT_REACTIVATED", () => {
    expect(
      productNameFromLogMetadata({
        previous_status: "ACTIVE",
        new_status: "INACTIVE",
      })
    ).toBeNull();
    expect(productNameFromLogMetadata({ product_name: "Legacy Name", name: "Also Legacy" })).toBeNull();
  });
});

describe("Products Audit CSV Product Name", () => {
  it("uses workflow config.name for PRODUCT_CREATED, PRODUCT_UPDATED, and PRODUCT_DELETED", () => {
    for (const [eventType, eventLabel] of [
      ["PRODUCT_CREATED", "Product Created"],
      ["PRODUCT_UPDATED", "Product Updated"],
      ["PRODUCT_DELETED", "Product Deleted"],
    ] as const) {
      const csv = csvForLog({
        eventType,
        eventLabel,
        metadata: { workflow: [{ config: { name: "Invoice Financing" } }] },
        productId: "abc123",
      });
      expect(csv).toContain("Invoice Financing");
      expect(csv).toContain(eventType);
      expect(csv).toContain(eventLabel);
      expect(csv).toContain("Ada Admin");
      expect(csv).toContain("abc123");
    }
  });

  it("uses config.type.name when config.name is missing", () => {
    const csv = csvForLog({
      eventType: "PRODUCT_UPDATED",
      eventLabel: "Product Updated",
      metadata: { workflow: [{ config: { type: { name: "Receivables Financing" } } }] },
    });
    expect(csv).toContain("Receivables Financing");
    expect(csv).toContain("PRODUCT_UPDATED");
  });

  it("leaves PRODUCT_INACTIVATED / PRODUCT_REACTIVATED Product Name blank", () => {
    for (const [eventType, eventLabel] of [
      ["PRODUCT_INACTIVATED", "Product Inactivated"],
      ["PRODUCT_REACTIVATED", "Product Reactivated"],
    ] as const) {
      const metadata = { previous_status: "ACTIVE", new_status: "INACTIVE" };
      expect(productNameFromLogMetadata(metadata)).toBeNull();
      const csv = csvForLog({
        eventType,
        eventLabel,
        metadata,
        productId: "prod_inactive",
      });
      expect(csv).toContain(eventType);
      expect(csv).toContain(eventLabel);
      expect(csv).toContain("prod_inactive");
      expect(csv).toContain("Ada Admin");
    }
  });
});
