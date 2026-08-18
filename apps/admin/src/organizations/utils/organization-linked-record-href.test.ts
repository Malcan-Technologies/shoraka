import {
  organizationLinkedRecordHref,
  organizationLinkedRecordTypeLabel,
} from "./organization-linked-record-href";

describe("organizationLinkedRecordHref", () => {
  it("builds an application href when productId is present", () => {
    expect(
      organizationLinkedRecordHref({
        type: "application",
        id: "app-1",
        productId: "invoice financing",
        noteId: null,
      })
    ).toBe("/applications/invoice%20financing/app-1");
  });

  it("disables application view when productId is missing", () => {
    expect(
      organizationLinkedRecordHref({
        type: "application",
        id: "app-1",
        productId: null,
        noteId: null,
      })
    ).toBeNull();
  });

  it("links facilities, notes, and investments", () => {
    expect(
      organizationLinkedRecordHref({
        type: "contract",
        id: "c/1",
        productId: null,
        noteId: null,
      })
    ).toBe("/contracts/c%2F1");
    expect(
      organizationLinkedRecordHref({
        type: "note",
        id: "n-1",
        productId: null,
        noteId: null,
      })
    ).toBe("/notes/n-1");
    expect(
      organizationLinkedRecordHref({
        type: "investment",
        id: "inv-1",
        productId: null,
        noteId: "note-9",
      })
    ).toBe("/notes/note-9");
  });
});

describe("organizationLinkedRecordTypeLabel", () => {
  it("uses Facility for contracts", () => {
    expect(organizationLinkedRecordTypeLabel("contract")).toBe("Facility");
    expect(organizationLinkedRecordTypeLabel("application")).toBe("Application");
    expect(organizationLinkedRecordTypeLabel("note")).toBe("Note");
    expect(organizationLinkedRecordTypeLabel("investment")).toBe("Investment");
  });
});
