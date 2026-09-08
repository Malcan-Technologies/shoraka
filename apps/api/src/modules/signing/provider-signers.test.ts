import { buildDocumentProviderSigners } from "./provider-signers";

const fieldA = { fieldtype: "sign", top: 459, left: 140, width: 100, height: 30, pageindex: 1 };
const fieldB = { fieldtype: "sign", top: 526, left: 140, width: 100, height: 30, pageindex: 1 };
const dateA = { fieldtype: "signdate", top: 500, left: 180, width: 70, height: 14, pageindex: 1 };
const dateB = { fieldtype: "signdate", top: 567, left: 180, width: 70, height: 14, pageindex: 1 };

describe("buildDocumentProviderSigners", () => {
  it("keeps distinct signers separate", () => {
    expect(
      buildDocumentProviderSigners([
        { email: "director@example.com", signset: [fieldA] },
        { email: "guarantor@example.com", signset: [fieldB] },
      ])
    ).toEqual([
      { email: "director@example.com", signset: [fieldA] },
      { email: "guarantor@example.com", signset: [fieldB] },
    ]);
  });

  it("merges the signature fields of one person signing for several parties", () => {
    expect(
      buildDocumentProviderSigners([
        { email: "Signer@Example.com", signset: [fieldA] },
        { email: "signer@example.com ", signset: [fieldB] },
      ])
    ).toEqual([{ email: "Signer@Example.com", signset: [fieldA, fieldB] }]);
    expect(fieldA).toEqual({
      fieldtype: "sign",
      top: 459,
      left: 140,
      width: 100,
      height: 30,
      pageindex: 1,
    });
  });

  it("keeps signature and date fields when merging duplicate emails", () => {
    expect(
      buildDocumentProviderSigners([
        { email: "signer@example.com", signset: [fieldA, dateA] },
        { email: "signer@example.com", signset: [fieldB, dateB] },
      ])
    ).toEqual([{ email: "signer@example.com", signset: [fieldA, dateA, fieldB, dateB] }]);
  });

  it("leaves signset undefined when no assignment carries fields", () => {
    expect(buildDocumentProviderSigners([{ email: "signer@example.com" }])).toEqual([
      { email: "signer@example.com", signset: undefined },
    ]);
  });

  it("keeps the fields of a merged signer when a sibling assignment has none", () => {
    expect(
      buildDocumentProviderSigners([
        { email: "signer@example.com", signset: [fieldA] },
        { email: "signer@example.com" },
      ])
    ).toEqual([{ email: "signer@example.com", signset: [fieldA] }]);
  });
});
