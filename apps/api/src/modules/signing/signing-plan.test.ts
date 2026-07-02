import {
  parseSigningTemplateConfig,
  validateSigningTemplateConfig,
  validateRecipientBindings,
  buildEnvelopePlanFromTemplate,
  computeSigningEnvelopeProgress,
  rollupDocumentStatus,
  rollupRecipientStatus,
  rollupEnvelopeStatus,
  type SigningTemplateConfig,
  type RecipientBinding,
  type SigningEnvelopeDto,
} from "@cashsouk/types";

const TEMPLATE: SigningTemplateConfig = {
  enabled: true,
  routing_mode: "SEQUENTIAL",
  roles: [
    {
      key: "borrower_director",
      label: "Borrower Director",
      party_type: "INTERNAL",
      source_hint: "issuer_director",
      routing_order: 0,
      kyc_required: true,
      min_count: 1,
      max_count: 1,
    },
    {
      key: "guarantor",
      label: "Guarantor",
      party_type: "EXTERNAL",
      source_hint: "guarantor",
      routing_order: 1,
      kyc_required: true,
      min_count: 1,
      max_count: null,
    },
  ],
  documents: [
    {
      key: "offer_letter",
      name: "Offer Letter",
      source: "GENERATED_OFFER_LETTER",
      required: true,
      order: 0,
      signer_role_keys: ["borrower_director"],
    },
    {
      key: "guarantee",
      name: "Guarantee Agreement",
      source: "TEMPLATE",
      required: true,
      order: 1,
      signer_role_keys: ["borrower_director", "guarantor"],
    },
  ],
};

describe("parseSigningTemplateConfig", () => {
  it("defaults to a disabled empty template for null", () => {
    const cfg = parseSigningTemplateConfig(null);
    expect(cfg.enabled).toBe(false);
    expect(cfg.roles).toEqual([]);
    expect(cfg.documents).toEqual([]);
  });

  it("sorts documents by order and defaults kyc_required to true", () => {
    const cfg = parseSigningTemplateConfig({
      enabled: true,
      documents: [
        { key: "b", name: "B", source: "TEMPLATE", order: 2, signer_role_keys: ["r"] },
        { key: "a", name: "A", source: "TEMPLATE", order: 1, signer_role_keys: ["r"] },
      ],
      roles: [{ key: "r", label: "R", party_type: "INTERNAL" }],
    });
    expect(cfg.documents.map((d) => d.key)).toEqual(["a", "b"]);
    expect(cfg.roles[0].kyc_required).toBe(true);
  });
});

describe("validateSigningTemplateConfig", () => {
  it("passes for a well-formed template", () => {
    expect(validateSigningTemplateConfig(TEMPLATE)).toEqual([]);
  });

  it("skips validation when disabled", () => {
    expect(validateSigningTemplateConfig({ ...TEMPLATE, enabled: false, roles: [], documents: [] })).toEqual([]);
  });

  it("flags documents that reference unknown roles", () => {
    const bad: SigningTemplateConfig = {
      ...TEMPLATE,
      documents: [
        { key: "x", name: "X", source: "TEMPLATE", required: true, order: 0, signer_role_keys: ["ghost"] },
      ],
    };
    expect(validateSigningTemplateConfig(bad).some((e) => e.includes('unknown role "ghost"'))).toBe(true);
  });
});

describe("validateRecipientBindings", () => {
  it("passes when counts and contacts are satisfied", () => {
    const bindings: RecipientBinding[] = [
      { role_key: "borrower_director", name: "Ali", email: "ali@co.my" },
      { role_key: "guarantor", name: "Siti", email: "siti@ext.my" },
    ];
    expect(validateRecipientBindings(TEMPLATE, bindings)).toEqual([]);
  });

  it("flags missing required role and bad email", () => {
    const bindings: RecipientBinding[] = [
      { role_key: "borrower_director", name: "Ali", email: "not-an-email" },
    ];
    const errors = validateRecipientBindings(TEMPLATE, bindings);
    expect(errors.some((e) => e.includes("invalid email"))).toBe(true);
    expect(errors.some((e) => e.includes("Guarantor"))).toBe(true);
  });

  it("allows multiple guarantors (max_count null) but caps single-signer roles", () => {
    const bindings: RecipientBinding[] = [
      { role_key: "borrower_director", name: "A", email: "a@co.my" },
      { role_key: "borrower_director", name: "B", email: "b@co.my" },
      { role_key: "guarantor", name: "G1", email: "g1@x.my" },
      { role_key: "guarantor", name: "G2", email: "g2@x.my" },
    ];
    const errors = validateRecipientBindings(TEMPLATE, bindings);
    expect(errors.some((e) => e.includes("Borrower Director") && e.includes("at most 1"))).toBe(true);
    expect(errors.some((e) => e.includes("Guarantor") && e.includes("at most"))).toBe(false);
  });
});

describe("buildEnvelopePlanFromTemplate", () => {
  it("wires the document x recipient matrix per signer_role_keys", () => {
    const bindings: RecipientBinding[] = [
      { role_key: "borrower_director", name: "Ali", email: "ali@co.my", user_id: "AB123" },
      { role_key: "guarantor", name: "Siti", email: "SITI@ext.my", application_guarantor_id: "g_1" },
    ];
    const plan = buildEnvelopePlanFromTemplate(TEMPLATE, bindings);

    expect(plan.routing_mode).toBe("SEQUENTIAL");
    expect(plan.recipients).toHaveLength(2);
    // email is normalized to lowercase
    expect(plan.recipients.find((r) => r.role_key === "guarantor")?.email).toBe("siti@ext.my");
    expect(plan.documents.map((d) => d.key)).toEqual(["offer_letter", "guarantee"]);

    // offer_letter: director only (1); guarantee: director + guarantor (2) => 3 total
    expect(plan.assignments).toHaveLength(3);
    const offerAssignees = plan.assignments.filter((a) => a.document_ref === "offer_letter");
    expect(offerAssignees).toHaveLength(1);
    const guaranteeAssignees = plan.assignments.filter((a) => a.document_ref === "guarantee");
    expect(guaranteeAssignees).toHaveLength(2);
  });

  it("creates one assignment per guarantor when several are bound", () => {
    const bindings: RecipientBinding[] = [
      { role_key: "borrower_director", name: "Ali", email: "ali@co.my" },
      { role_key: "guarantor", name: "G1", email: "g1@x.my" },
      { role_key: "guarantor", name: "G2", email: "g2@x.my" },
    ];
    const plan = buildEnvelopePlanFromTemplate(TEMPLATE, bindings);
    const guaranteeAssignees = plan.assignments.filter((a) => a.document_ref === "guarantee");
    // director + 2 guarantors
    expect(guaranteeAssignees).toHaveLength(3);
    expect(new Set(plan.recipients.map((r) => r.ref)).size).toBe(3);
  });
});

describe("computeSigningEnvelopeProgress", () => {
  const envelope: Pick<SigningEnvelopeDto, "documents" | "recipients" | "assignments"> = {
    documents: [
      { id: "d1", name: "Offer", description: null, source: "GENERATED_OFFER_LETTER", order: 0, required: true, status: "PENDING", signed_s3_key: null },
      { id: "d2", name: "Guarantee", description: null, source: "TEMPLATE", order: 1, required: true, status: "PENDING", signed_s3_key: null },
    ],
    recipients: [
      { id: "r1", role_key: "borrower_director", role_label: "Director", party_type: "INTERNAL", name: "Ali", email: "a@co.my", routing_order: 0, status: "SIGNED", kyc_status: "VERIFIED", completed_at: null },
      { id: "r2", role_key: "guarantor", role_label: "Guarantor", party_type: "EXTERNAL", name: "Siti", email: "s@x.my", routing_order: 1, status: "PENDING", kyc_status: "PENDING", completed_at: null },
    ],
    assignments: [
      { id: "a1", document_id: "d1", recipient_id: "r1", required: true, action: "SIGN", status: "SIGNED", signed_at: "2026-01-01T00:00:00Z" },
      { id: "a2", document_id: "d2", recipient_id: "r1", required: true, action: "SIGN", status: "SIGNED", signed_at: "2026-01-01T00:00:00Z" },
      { id: "a3", document_id: "d2", recipient_id: "r2", required: true, action: "SIGN", status: "PENDING", signed_at: null },
    ],
  };

  it("computes overall, per-recipient and per-document progress", () => {
    const p = computeSigningEnvelopeProgress(envelope);
    expect(p.total_required).toBe(3);
    expect(p.signed).toBe(2);
    expect(p.percent).toBe(67);
    expect(p.by_recipient.find((g) => g.id === "r1")?.complete).toBe(true);
    expect(p.by_recipient.find((g) => g.id === "r2")?.complete).toBe(false);
    expect(p.by_document.find((g) => g.id === "d1")?.complete).toBe(true);
    expect(p.by_document.find((g) => g.id === "d2")?.complete).toBe(false);
  });
});

describe("status roll-up", () => {
  it("rolls a document up to COMPLETED / PARTIALLY_SIGNED / PENDING", () => {
    expect(
      rollupDocumentStatus([
        { status: "SIGNED", required: true },
        { status: "SIGNED", required: true },
      ])
    ).toBe("COMPLETED");
    expect(
      rollupDocumentStatus([
        { status: "SIGNED", required: true },
        { status: "SENT", required: true },
      ])
    ).toBe("PARTIALLY_SIGNED");
    expect(rollupDocumentStatus([{ status: "SENT", required: true }])).toBe("PENDING");
    // optional-only documents never gate to COMPLETED
    expect(rollupDocumentStatus([{ status: "SIGNED", required: false }])).toBe("PENDING");
  });

  it("rolls a recipient up, prioritising DECLINED then full completion", () => {
    expect(rollupRecipientStatus(["SIGNED", "DECLINED"])).toBe("DECLINED");
    expect(rollupRecipientStatus(["SIGNED", "SIGNED"])).toBe("SIGNED");
    expect(rollupRecipientStatus(["SIGNED", "SENT"])).toBe("VIEWED");
    expect(rollupRecipientStatus(["SENT", "SENT"])).toBe("SENT");
    expect(rollupRecipientStatus(["PENDING"])).toBe("PENDING");
  });

  it("rolls the envelope up from the assignment matrix", () => {
    expect(
      rollupEnvelopeStatus([
        { status: "SIGNED", required: true },
        { status: "DECLINED", required: true },
      ])
    ).toBe("DECLINED");
    expect(
      rollupEnvelopeStatus([
        { status: "SIGNED", required: true },
        { status: "SIGNED", required: true },
      ])
    ).toBe("COMPLETED");
    expect(
      rollupEnvelopeStatus([
        { status: "SIGNED", required: true },
        { status: "SENT", required: true },
      ])
    ).toBe("IN_PROGRESS");
    expect(rollupEnvelopeStatus([{ status: "SENT", required: true }])).toBe("SENT");
  });
});
