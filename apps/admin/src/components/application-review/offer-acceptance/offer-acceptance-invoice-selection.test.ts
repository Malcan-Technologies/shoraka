import {
  isOtherInvoiceTabId,
  otherInvoiceApplicationHref,
  otherInvoiceTabId,
  parseOtherInvoiceTabId,
  resolveDefaultOfferAcceptanceInvoiceTabId,
  resolveThisAppInvoiceIdForStages,
  shouldListOtherFacilityInvoices,
  thisInvoiceTabId,
} from "./offer-acceptance-invoice-selection";

describe("offer-acceptance invoice selection", () => {
  it("treats other:* tabs as other-app invoices and does not feed them into the stage model", () => {
    expect(isOtherInvoiceTabId(otherInvoiceTabId("inv-other"))).toBe(true);
    expect(isOtherInvoiceTabId(thisInvoiceTabId("inv-this"))).toBe(false);
    expect(parseOtherInvoiceTabId(otherInvoiceTabId("inv-other"))).toBe("inv-other");
    expect(
      resolveThisAppInvoiceIdForStages({
        selectedTabId: otherInvoiceTabId("inv-other"),
        thisAppInvoiceIds: ["inv-this"],
      })
    ).toBeNull();
    expect(
      resolveThisAppInvoiceIdForStages({
        selectedTabId: thisInvoiceTabId("inv-this"),
        thisAppInvoiceIds: ["inv-a", "inv-this"],
      })
    ).toBe("inv-this");
  });

  it("defaults to this application's invoice and never to a sibling", () => {
    expect(resolveDefaultOfferAcceptanceInvoiceTabId(["inv-a", "inv-this"])).toBe(
      thisInvoiceTabId("inv-this")
    );
    expect(resolveDefaultOfferAcceptanceInvoiceTabId([])).toBeNull();
  });

  it("lists sibling invoices only on invoice-under-facility", () => {
    expect(shouldListOtherFacilityInvoices("existing_contract")).toBe(true);
    expect(shouldListOtherFacilityInvoices("new_contract")).toBe(false);
    expect(shouldListOtherFacilityInvoices("invoice_only")).toBe(false);
  });

  it("omits Open that application unless the other invoice has application id and product id", () => {
    expect(
      otherInvoiceApplicationHref({ applicationId: "app-2", productId: "prod-1" })
    ).toBe("/applications/prod-1/app-2");
    expect(otherInvoiceApplicationHref({ applicationId: "app-2" })).toBeNull();
    expect(otherInvoiceApplicationHref({ productId: "prod-1" })).toBeNull();
    expect(otherInvoiceApplicationHref({})).toBeNull();
  });
});
