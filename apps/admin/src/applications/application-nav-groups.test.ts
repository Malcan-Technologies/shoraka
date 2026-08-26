import type { ApplicationNavCountItem, Product } from "@cashsouk/types";
import {
  activeProductPendingActionTotal,
  buildApplicationSidebarGroups,
  firstActiveActionQueuePath,
} from "./application-nav-groups";

function product(partial: Partial<Product> & Pick<Product, "id" | "version">): Product {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    status: "ACTIVE",
    workflow: [{ config: { name: "Invoice financing" } }],
    ...partial,
  };
}

const navCounts: ApplicationNavCountItem[] = [
  { baseProductId: "invoice", financingTypeLabel: "Invoice", total: 5, actionRequired: 2 },
  { baseProductId: "retired", financingTypeLabel: "Retired", total: 1, actionRequired: 1 },
  { baseProductId: "orphan", financingTypeLabel: "Orphan product", total: 3, actionRequired: 1 },
];

describe("buildApplicationSidebarGroups", () => {
  it("groups live versions, keeps inactive products that still have apps, and adds orphan counts", () => {
    const groups = buildApplicationSidebarGroups(
      [
        product({
          id: "invoice-v2",
          base_id: "invoice",
          version: 2,
          status: "ACTIVE",
          workflow: [{ config: { name: "Invoice financing" } }],
        }),
        product({
          id: "invoice-v1",
          base_id: "invoice",
          version: 1,
          status: "INACTIVE",
        }),
        product({
          id: "retired-v1",
          base_id: "retired",
          version: 1,
          status: "INACTIVE",
          workflow: [{ config: { name: "Retired facility" } }],
        }),
        product({
          id: "empty-inactive",
          base_id: "empty-inactive",
          version: 1,
          status: "INACTIVE",
        }),
      ],
      navCounts
    );

    expect(groups.map((g) => g.baseKey)).toEqual(["invoice", "orphan", "retired"]);
    expect(groups[0]).toMatchObject({
      baseKey: "invoice",
      isInactive: false,
      pendingActionCount: 2,
      queuePath: "/applications/invoice",
    });
    expect(groups.find((g) => g.baseKey === "orphan")).toMatchObject({
      isInactive: true,
      pendingActionCount: 1,
      productTitle: "Orphan product",
    });
    expect(groups.find((g) => g.baseKey === "retired")?.isInactive).toBe(true);
  });
});

describe("activeProductPendingActionTotal", () => {
  it("sums only active product queues", () => {
    const groups = buildApplicationSidebarGroups(
      [
        product({ id: "invoice", base_id: "invoice", version: 1, status: "ACTIVE" }),
        product({ id: "retired", base_id: "retired", version: 1, status: "INACTIVE" }),
      ],
      navCounts
    );
    expect(activeProductPendingActionTotal(groups)).toBe(2);
  });
});

describe("buildApplicationSidebarGroups count matching", () => {
  it("attaches version-keyed counts to the live product group", () => {
    const groups = buildApplicationSidebarGroups(
      [
        product({
          id: "invoice-v2",
          base_id: "invoice",
          version: 2,
          status: "ACTIVE",
        }),
      ],
      [{ baseProductId: "invoice-v2", financingTypeLabel: "Invoice", total: 4, actionRequired: 3 }]
    );

    expect(groups).toEqual([
      expect.objectContaining({
        baseKey: "invoice",
        isInactive: false,
        pendingActionCount: 3,
      }),
    ]);
    expect(activeProductPendingActionTotal(groups)).toBe(3);
  });
});

describe("firstActiveActionQueuePath", () => {
  it("prefers the first active group that has pending actions", () => {
    const groups = buildApplicationSidebarGroups(
      [
        product({
          id: "clear",
          base_id: "clear",
          version: 1,
          status: "ACTIVE",
          workflow: [{ config: { name: "Clear" } }],
        }),
        product({
          id: "invoice",
          base_id: "invoice",
          version: 1,
          status: "ACTIVE",
        }),
      ],
      [
        { baseProductId: "clear", financingTypeLabel: "Clear", total: 2, actionRequired: 0 },
        { baseProductId: "invoice", financingTypeLabel: "Invoice", total: 5, actionRequired: 2 },
      ]
    );
    expect(firstActiveActionQueuePath(groups)).toBe("/applications/invoice");
  });
});
