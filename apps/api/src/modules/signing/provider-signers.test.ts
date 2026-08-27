import { buildDocumentProviderSigners } from "./provider-signers";

const fieldA = { fieldtype: "sign", top: 459, left: 140, width: 100, height: 30, pageindex: 1 };
const fieldB = { fieldtype: "sign", top: 526, left: 140, width: 100, height: 30, pageindex: 1 };

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
