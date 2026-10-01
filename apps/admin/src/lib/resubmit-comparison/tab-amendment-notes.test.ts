import { resubmitTabBarRemarks } from "./tab-amendment-notes";

const section = { scope: "section", scope_key: "supporting_documents", remark: "Section remark" };
const docItem = { scope: "item", scope_key: "supporting_documents:legal_docs:0:SSM", remark: "On a row" };
const unmatched = { scope: "item", scope_key: "supporting_documents:legal_docs:9:Gone", remark: "No row" };
const business = { scope: "section", scope_key: "business_details", remark: "Business remark" };

describe("resubmitTabBarRemarks", () => {
  it("documents tab: section remark only, item remarks left to rows", () => {
    expect(resubmitTabBarRemarks("supporting_documents", undefined, [section, docItem, unmatched, business])).toEqual([
      section,
    ]);
  });

  it("documents tab: appends additional (unmatched) remarks after the section remark, de-duplicated", () => {
    expect(
      resubmitTabBarRemarks("supporting_documents", undefined, [section, docItem, unmatched], [
        unmatched,
        { ...unmatched },
        section,
      ])
    ).toEqual([section, unmatched]);
  });

  it("additional remarks show even without a section remark", () => {
    expect(resubmitTabBarRemarks("supporting_documents", undefined, [docItem, unmatched], [unmatched])).toEqual([
      unmatched,
    ]);
  });

  it("other tabs unchanged without additional remarks", () => {
    expect(resubmitTabBarRemarks("business_details", undefined, [section, docItem, business])).toEqual([business]);
    expect(resubmitTabBarRemarks("business_details", undefined, undefined)).toEqual([]);
  });
});
