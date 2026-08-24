import {
  parseSigningTemplateConfig,
  parseSigningPackagesConfig,
  resolveSigningTemplateForOffer,
  writeSigningPackagesConfig,
  signingTemplateDocumentCategoryKey,
  parseSigningTemplateDocumentCategoryKey,
  isSigningTemplateDocumentCategoryKey,
  validateSigningTemplateConfig,
  validateRecipientBindings,
  buildEnvelopePlanFromTemplate,
  computeSigningEnvelopeProgress,
  findUnsignedSigningAssignmentForRecipient,
  normalizeSigningEmail,
  rollupDocumentStatus,
  rollupRecipientStatus,
  rollupEnvelopeStatus,
  needsSigningEnvelope,
  canDirectAcceptInvoice,
  workflowHasSigningPackage,
  resolveCompletedSigningEnvelopeWhere,
  SIGNING_PACKAGES_WORKFLOW_KEY,
  SIGNING_TEMPLATE_WORKFLOW_KEY,
  SIGNING_TEMPLATE_DOCUMENT_CATEGORY_KEY,
  type SigningTemplateConfig,
  type RecipientBinding,
  type SigningEnvelopeDto,
} from "@cashsouk/types";

const SAMPLE_IC = "820508105871";

const TEMPLATE: SigningTemplateConfig = {
  enabled: true,
  roles: [
    {
      key: "issuer_director",
      label: "Borrower Director",
      source_hint: "issuer_director",
      routing_order: 0,
      kyc_required: true,
      min_count: 1,
      max_count: 1,
    },
    {
      key: "guarantor",
      label: "Guarantor",
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
      signer_role_keys: ["issuer_director"],
    },
    {
      key: "guarantee",
      name: "Guarantee Agreement",
      source: "TEMPLATE",
      required: true,
      order: 1,
      signer_role_keys: ["issuer_director", "guarantor"],
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
        {
          key: "b",
          name: "B",
          source: "TEMPLATE",
          order: 2,
          signer_role_keys: ["issuer_director"],
        },
        {
          key: "a",
          name: "A",
          source: "TEMPLATE",
          order: 1,
          signer_role_keys: ["issuer_director"],
        },
      ],
      roles: [{ key: "issuer_director", label: "Director" }],
    });
    expect(cfg.documents.map((d) => d.key)).toEqual(["a", "b"]);
    expect(cfg.roles[0].kyc_required).toBe(true);
  });

  it("keeps offer-letter-only templates without auto-injecting guarantor agreement", () => {
    const cfg = parseSigningTemplateConfig({
      enabled: true,
      roles: [{ key: "issuer_director", label: "Director" }],
      documents: [
        {
          key: "offer_letter",
          name: "Offer letter",
          source: "GENERATED_OFFER_LETTER",
          order: 0,
          signer_role_keys: ["issuer_director"],
        },
      ],
    });
    expect(cfg.documents.map((d) => d.key)).toEqual(["offer_letter"]);
    expect(cfg.roles.map((role) => role.key)).toEqual(["issuer_director"]);
  });

  it("preserves an explicit guarantor agreement document from the product template", () => {
    const cfg = parseSigningTemplateConfig({
      enabled: true,
      roles: [
        { key: "issuer_director", label: "Director" },
        { key: "guarantor", label: "Guarantor" },
      ],
      documents: [
        {
          key: "offer_letter",
          name: "Offer letter",
          source: "GENERATED_OFFER_LETTER",
          order: 0,
          signer_role_keys: ["issuer_director"],
        },
        {
          key: "guarantor_agreement",
          name: "Guarantor Agreement",
          source: "TEMPLATE",
          order: 1,
          signer_role_keys: ["guarantor"],
        },
      ],
    });
    expect(cfg.documents.map((d) => d.key)).toEqual(["offer_letter", "guarantor_agreement"]);
    expect(cfg.documents[1]?.source).toBe("TEMPLATE");
    expect(cfg.documents[1]?.signer_role_keys).toEqual(["guarantor"]);
    expect(cfg.roles.some((role) => role.key === "guarantor")).toBe(true);
  });

  it("discards legacy supporting_docs links (post-app uploads are store-only)", () => {
    const cfg = parseSigningTemplateConfig({
      enabled: true,
      roles: [{ key: "issuer_director", label: "Director" }],
      documents: [
        {
          key: "offer_letter",
          name: "Offer letter",
          source: "GENERATED_OFFER_LETTER",
          order: 0,
          signer_role_keys: ["issuer_director"],
        },
      ],
      supporting_docs: [
        {
          step_key: "financial:0",
          label: "Board Resolution",
          required: true,
          signer_role_keys: ["issuer_director"],
        },
      ],
    });
    expect(cfg.supporting_docs).toEqual([]);
    const plan = buildEnvelopePlanFromTemplate(cfg, [
      { role_key: "issuer_director", name: "Ali", email: "ali@co.my", ic_number: SAMPLE_IC },
    ]);
    expect(plan.documents.map((d) => d.key)).toEqual(["offer_letter"]);
    expect(plan.documents.some((d) => d.key.startsWith("supporting_"))).toBe(false);
  });
});

describe("parseSigningPackagesConfig", () => {
  const contractBody = {
    enabled: false,
    roles: [{ key: "issuer_director", label: "Director" }],
    documents: [
      {
        key: "facility",
        name: "Facility Agreement",
        source: "TEMPLATE",
        order: 0,
        signer_role_keys: ["issuer_director"],
      },
    ],
  };

  const invoiceBody = {
    enabled: false,
    roles: [{ key: "issuer_director", label: "Director" }],
    documents: [
      {
        key: "invoice_letter",
        name: "Invoice Offer Letter",
        source: "GENERATED_OFFER_LETTER",
        order: 0,
        signer_role_keys: ["issuer_director"],
      },
    ],
  };

  it("exposes SIGNING_PACKAGES_WORKFLOW_KEY as signing_packages", () => {
    expect(SIGNING_PACKAGES_WORKFLOW_KEY).toBe("signing_packages");
    expect(SIGNING_TEMPLATE_WORKFLOW_KEY).toBe("signing_template");
  });

  it("parses flat signing_packages template", () => {
    const packages = parseSigningPackagesConfig({
      [SIGNING_PACKAGES_WORKFLOW_KEY]: contractBody,
    });
    expect(packages.documents.map((d) => d.key)).toEqual(["facility"]);
  });

  it("migrates legacy dual contract/invoice by preferring contract when both have documents", () => {
    const packages = parseSigningPackagesConfig({
      [SIGNING_PACKAGES_WORKFLOW_KEY]: {
        contract: contractBody,
        invoice: invoiceBody,
      },
    });
    expect(packages.documents.map((d) => d.key)).toEqual(["facility"]);
  });

  it("migrates legacy dual by preferring invoice when contract has no documents", () => {
    const packages = parseSigningPackagesConfig({
      [SIGNING_PACKAGES_WORKFLOW_KEY]: {
        contract: { enabled: false, roles: [], documents: [] },
        invoice: invoiceBody,
      },
    });
    expect(packages.documents.map((d) => d.key)).toEqual(["invoice_letter"]);
  });

  it("migrates legacy signing_template to a single package", () => {
    const packages = parseSigningPackagesConfig({
      [SIGNING_TEMPLATE_WORKFLOW_KEY]: contractBody,
    });
    expect(packages.documents.map((d) => d.key)).toEqual(["facility"]);
  });

  it("returns empty defaults when neither key is present", () => {
    const packages = parseSigningPackagesConfig({});
    expect(packages.roles).toEqual([]);
    expect(packages.documents).toEqual([]);
  });

  it("prefers signing_packages over legacy signing_template when both exist", () => {
    const packages = parseSigningPackagesConfig({
      [SIGNING_PACKAGES_WORKFLOW_KEY]: contractBody,
      [SIGNING_TEMPLATE_WORKFLOW_KEY]: {
        enabled: true,
        roles: [{ key: "guarantor", label: "Guarantor" }],
        documents: [
          {
            key: "legacy_only",
            name: "Legacy",
            source: "TEMPLATE",
            order: 0,
            signer_role_keys: ["guarantor"],
          },
        ],
      },
    });
    expect(packages.documents.map((d) => d.key)).toEqual(["facility"]);
  });

  it("ignores legacy enabled when parsing packages (no enable fork)", () => {
    const packages = parseSigningPackagesConfig({
      [SIGNING_PACKAGES_WORKFLOW_KEY]: { ...contractBody, enabled: false },
    });
    expect(resolveSigningTemplateForOffer({ packages, kind: "contract" }).documents[0]?.key).toBe(
      "facility"
    );
    expect(resolveSigningTemplateForOffer({ packages, kind: "invoice" }).documents[0]?.key).toBe(
      "facility"
    );
  });
});

describe("needsSigningEnvelope", () => {
  it("is true for contract offers", () => {
    expect(needsSigningEnvelope({ kind: "contract" })).toBe(true);
  });

  it("is true for invoice-only offers (no contract_id)", () => {
    expect(needsSigningEnvelope({ kind: "invoice", invoiceContractId: null })).toBe(true);
    expect(needsSigningEnvelope({ kind: "invoice", invoiceContractId: undefined })).toBe(true);
  });

  it("is false for contract-linked invoice offers", () => {
    expect(needsSigningEnvelope({ kind: "invoice", invoiceContractId: "contract-1" })).toBe(false);
  });
});

describe("canDirectAcceptInvoice", () => {
  it("is true when contract-linked and contract envelope is COMPLETED", () => {
    expect(
      canDirectAcceptInvoice({
        invoiceContractId: "contract-1",
        hasCompletedContractEnvelope: true,
      })
    ).toBe(true);
  });

  it("is false when contract-linked but contract envelope is not COMPLETED", () => {
    expect(
      canDirectAcceptInvoice({
        invoiceContractId: "contract-1",
        hasCompletedContractEnvelope: false,
      })
    ).toBe(false);
  });

  it("is false for invoice-only even if a completed envelope flag is true", () => {
    expect(
      canDirectAcceptInvoice({
        invoiceContractId: null,
        hasCompletedContractEnvelope: true,
      })
    ).toBe(false);
  });
});

describe("resolveSigningTemplateForOffer", () => {
  it("returns the same package for contract and invoice kinds", () => {
    const packages = parseSigningPackagesConfig({
      [SIGNING_PACKAGES_WORKFLOW_KEY]: {
        roles: [{ key: "issuer_director", label: "Director" }],
        documents: [
          {
            key: "facility",
            name: "Facility",
            source: "TEMPLATE",
            order: 0,
            signer_role_keys: ["issuer_director"],
          },
        ],
      },
    });
    expect(resolveSigningTemplateForOffer({ packages, kind: "contract" }).documents[0]?.key).toBe(
      "facility"
    );
    expect(resolveSigningTemplateForOffer({ packages, kind: "invoice" }).documents[0]?.key).toBe(
      "facility"
    );
  });
});

describe("writeSigningPackagesConfig", () => {
  it("writes flat signing_packages and removes legacy signing_template", () => {
    const packages = parseSigningPackagesConfig({
      [SIGNING_TEMPLATE_WORKFLOW_KEY]: {
        enabled: true,
        roles: [{ key: "issuer_director", label: "Director" }],
        documents: [
          {
            key: "facility",
            name: "Facility",
            source: "TEMPLATE",
            order: 0,
            signer_role_keys: ["issuer_director"],
          },
        ],
      },
    });
    const next = writeSigningPackagesConfig(
      {
        some_other: true,
        [SIGNING_TEMPLATE_WORKFLOW_KEY]: { enabled: true, roles: [], documents: [] },
      },
      packages
    );
    expect(next.some_other).toBe(true);
    expect(next[SIGNING_TEMPLATE_WORKFLOW_KEY]).toBeUndefined();
    expect(next[SIGNING_PACKAGES_WORKFLOW_KEY]).toEqual(packages);
  });
});

describe("workflowHasSigningPackage", () => {
  const signingWorkflow = [
    {
      id: "financing_type_1",
      config: {
        [SIGNING_PACKAGES_WORKFLOW_KEY]: {
          documents: [{ key: "facility", name: "Facility Agreement", source: "TEMPLATE", order: 0 }],
        },
      },
    },
  ];

  it("is false when signing_packages is missing or has no documents", () => {
    expect(workflowHasSigningPackage(undefined)).toBe(false);
    expect(workflowHasSigningPackage([])).toBe(false);
    expect(
      workflowHasSigningPackage([
        { id: "financing_type_1", config: { [SIGNING_PACKAGES_WORKFLOW_KEY]: { documents: [] } } },
      ])
    ).toBe(false);
  });

  it("is true when the workflow defines at least one signing document", () => {
    expect(workflowHasSigningPackage(signingWorkflow)).toBe(true);
  });
});

describe("resolveCompletedSigningEnvelopeWhere", () => {
  it("looks up the invoice envelope for invoice-only notes", () => {
    expect(
      resolveCompletedSigningEnvelopeWhere({
        sourceInvoiceId: "inv-1",
        sourceContractId: null,
        invoiceContractId: null,
      })
    ).toEqual({ invoice_id: "inv-1" });
  });

  it("looks up the contract envelope for contract-linked invoices", () => {
    expect(
      resolveCompletedSigningEnvelopeWhere({
        sourceInvoiceId: "inv-1",
        sourceContractId: "con-1",
        invoiceContractId: "con-1",
      })
    ).toEqual({ contract_id: "con-1" });
  });

  it("looks up the contract envelope when the note has no invoice", () => {
    expect(
      resolveCompletedSigningEnvelopeWhere({
        sourceInvoiceId: null,
        sourceContractId: "con-1",
        invoiceContractId: null,
      })
    ).toEqual({ contract_id: "con-1" });
  });
});

describe("signingTemplateDocumentCategoryKey", () => {
  it("returns the unified upload category key", () => {
    expect(signingTemplateDocumentCategoryKey()).toBe(SIGNING_TEMPLATE_DOCUMENT_CATEGORY_KEY);
    expect(SIGNING_TEMPLATE_DOCUMENT_CATEGORY_KEY).toBe("signing_template_document");
  });

  it("recognizes unified and legacy namespaced category keys", () => {
    expect(isSigningTemplateDocumentCategoryKey("signing_template_document")).toBe(true);
    expect(isSigningTemplateDocumentCategoryKey("signing_template_document_contract")).toBe(true);
    expect(isSigningTemplateDocumentCategoryKey("signing_template_document_invoice")).toBe(true);
    expect(isSigningTemplateDocumentCategoryKey("financial_docs")).toBe(false);
  });

  it("parses legacy namespaced category keys back to package kind", () => {
    expect(parseSigningTemplateDocumentCategoryKey("signing_template_document_contract")).toBe(
      "contract"
    );
    expect(parseSigningTemplateDocumentCategoryKey("signing_template_document_invoice")).toBe(
      "invoice"
    );
    expect(parseSigningTemplateDocumentCategoryKey("signing_template_document")).toBeNull();
    expect(parseSigningTemplateDocumentCategoryKey("financial_docs")).toBeNull();
  });
});

describe("validateSigningTemplateConfig", () => {
  it("passes for a well-formed template", () => {
    expect(validateSigningTemplateConfig(TEMPLATE)).toEqual([]);
  });

  it("validates even when legacy enabled is false", () => {
    const errors = validateSigningTemplateConfig({
      ...TEMPLATE,
      enabled: false,
      roles: [],
      documents: [],
    });
    expect(errors.some((e) => e.includes("signer role"))).toBe(true);
    expect(errors.some((e) => e.includes("document"))).toBe(true);
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

  it("sanitizes legacy issuer_director_1 document role keys", () => {
    const parsed = parseSigningTemplateConfig({
      enabled: true,
      roles: [
        { key: "issuer_director", label: "Director", min_count: 1, max_count: null },
        { key: "guarantor", label: "Guarantor", min_count: 1, max_count: null },
      ],
      documents: [
        {
          key: "offer_letter",
          name: "Offer letter",
          source: "GENERATED_OFFER_LETTER",
          required: true,
          order: 0,
          signer_role_keys: ["guarantor", "issuer_director_1"],
        },
      ],
    });
    expect(parsed.documents[0].signer_role_keys).toEqual(["guarantor", "issuer_director"]);
    expect(validateSigningTemplateConfig(parsed)).toEqual([]);
  });

  it("flags duplicate signer roles on the same document", () => {
    const bad: SigningTemplateConfig = {
      ...TEMPLATE,
      documents: [
        {
          key: "offer_letter",
          name: "Offer Letter",
          source: "GENERATED_OFFER_LETTER",
          required: true,
          order: 0,
          signer_role_keys: ["issuer_director", "issuer_director"],
        },
      ],
    };
    expect(
      validateSigningTemplateConfig(bad).some((e) => e.includes("assigns signer role"))
    ).toBe(true);
  });
});

describe("validateRecipientBindings", () => {
  it("passes when counts and contacts are satisfied", () => {
    const bindings: RecipientBinding[] = [
      { role_key: "issuer_director", name: "Ali", email: "ali@co.my", ic_number: SAMPLE_IC },
      { role_key: "guarantor", name: "Siti", email: "siti@ext.my" },
    ];
    expect(validateRecipientBindings(TEMPLATE, bindings)).toEqual([]);
  });

  it("requires IC for issuer directors but not guarantors", () => {
    const bindings: RecipientBinding[] = [
      { role_key: "issuer_director", name: "Ali", email: "ali@co.my" },
      { role_key: "guarantor", name: "Siti", email: "siti@ext.my" },
    ];
    const errors = validateRecipientBindings(TEMPLATE, bindings);
    expect(errors.some((e) => e.toLowerCase().includes("ic"))).toBe(true);
    expect(errors.filter((e) => e.toLowerCase().includes("guarantor")).length).toBe(0);
  });

  it("flags missing required role and bad email", () => {
    const bindings: RecipientBinding[] = [
      { role_key: "issuer_director", name: "Ali", email: "not-an-email", ic_number: SAMPLE_IC },
    ];
    const errors = validateRecipientBindings(TEMPLATE, bindings);
    expect(errors.some((e) => e.includes("invalid email"))).toBe(true);
    expect(errors.some((e) => e.includes("Guarantor"))).toBe(true);
  });

  it("allows multiple guarantors (max_count null) but caps single-signer roles", () => {
    const bindings: RecipientBinding[] = [
      { role_key: "issuer_director", name: "A", email: "a@co.my", ic_number: "820508105871" },
      { role_key: "issuer_director", name: "B", email: "b@co.my", ic_number: "820508105872" },
      { role_key: "guarantor", name: "G1", email: "g1@x.my", ic_number: "900101015432" },
      { role_key: "guarantor", name: "G2", email: "g2@x.my", ic_number: "900101015433" },
    ];
    const errors = validateRecipientBindings(TEMPLATE, bindings);
    expect(errors.some((e) => e.includes("Borrower Director") && e.includes("at most 1"))).toBe(true);
    expect(errors.some((e) => e.includes("Guarantor") && e.includes("at most"))).toBe(false);
  });
});

describe("buildEnvelopePlanFromTemplate", () => {
  it("wires the document x recipient matrix per signer_role_keys", () => {
    const bindings: RecipientBinding[] = [
      { role_key: "issuer_director", name: "Ali", email: "ali@co.my", ic_number: SAMPLE_IC },
      { role_key: "guarantor", name: "Siti", email: "SITI@ext.my", application_guarantor_id: "g_1", ic_number: "900101015432" },
    ];
    const plan = buildEnvelopePlanFromTemplate(TEMPLATE, bindings);

    expect(plan.recipients).toHaveLength(2);
    expect(plan.recipients.find((r) => r.role_key === "guarantor")?.email).toBe("siti@ext.my");
    expect(plan.documents.map((d) => d.key)).toEqual(["offer_letter", "guarantee"]);

    expect(plan.assignments).toHaveLength(3);
    const offerAssignees = plan.assignments.filter((a) => a.document_ref === "offer_letter");
    expect(offerAssignees).toHaveLength(1);
    const guaranteeAssignees = plan.assignments.filter((a) => a.document_ref === "guarantee");
    expect(guaranteeAssignees).toHaveLength(2);
  });

  it("creates one assignment per guarantor when several are bound", () => {
    const bindings: RecipientBinding[] = [
      { role_key: "issuer_director", name: "Ali", email: "ali@co.my", ic_number: SAMPLE_IC },
      { role_key: "guarantor", name: "G1", email: "g1@x.my", ic_number: "900101015432" },
      { role_key: "guarantor", name: "G2", email: "g2@x.my", ic_number: "900101015433" },
    ];
    const plan = buildEnvelopePlanFromTemplate(TEMPLATE, bindings);
    const guaranteeAssignees = plan.assignments.filter((a) => a.document_ref === "guarantee");
    expect(guaranteeAssignees).toHaveLength(3);
    expect(new Set(plan.recipients.map((r) => r.ref)).size).toBe(3);
  });

  it("keeps two corporate representatives as two recipients sharing an application_guarantor_id", () => {
    const bindings: RecipientBinding[] = [
      { role_key: "issuer_director", name: "Ali", email: "ali@co.my", ic_number: SAMPLE_IC },
      {
        role_key: "guarantor",
        name: "Nora",
        email: "nora@holdco.my",
        application_guarantor_id: "g_co",
        ic_number: "880101015555",
      },
      {
        role_key: "guarantor",
        name: "Farid",
        email: "farid@holdco.my",
        application_guarantor_id: "g_co",
        ic_number: "770202025555",
      },
    ];
    const plan = buildEnvelopePlanFromTemplate(TEMPLATE, bindings);
    const guarantors = plan.recipients.filter((recipient) => recipient.role_key === "guarantor");
    expect(guarantors.map((recipient) => recipient.name)).toEqual(["Nora", "Farid"]);
    expect(guarantors.every((recipient) => recipient.application_guarantor_id === "g_co")).toBe(true);
    expect(guarantors.some((recipient) => recipient.name.toLowerCase().includes("holdco"))).toBe(
      false
    );
  });
});

describe("computeSigningEnvelopeProgress", () => {
  const envelope: Pick<SigningEnvelopeDto, "documents" | "recipients" | "assignments"> = {
    documents: [
      { id: "d1", name: "Offer", description: null, source: "GENERATED_OFFER_LETTER", order: 0, required: true, status: "PENDING", has_signed_pdf: false },
      { id: "d2", name: "Guarantee", description: null, source: "TEMPLATE", order: 1, required: true, status: "PENDING", has_signed_pdf: false },
    ],
    recipients: [
      { id: "r1", role_key: "issuer_director", role_label: "Director", name: "Ali", email: "a@co.my", routing_order: 0, status: "SIGNED", kyc_status: "VERIFIED", completed_at: null },
      { id: "r2", role_key: "guarantor", role_label: "Guarantor", name: "Siti", email: "s@x.my", routing_order: 1, status: "PENDING", kyc_status: "PENDING", completed_at: null },
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

describe("findUnsignedSigningAssignmentForRecipient", () => {
  const envelope: Pick<SigningEnvelopeDto, "documents" | "recipients" | "assignments"> = {
    documents: [
      {
        id: "d1",
        name: "Offer",
        description: null,
        source: "GENERATED_OFFER_LETTER",
        order: 0,
        required: true,
        status: "PENDING",
        has_signed_pdf: false,
      },
    ],
    recipients: [
      {
        id: "r1",
        role_key: "issuer_director",
        role_label: "Issuer director",
        name: "Kau Khai Kit",
        email: "khai.kit@malcan.io",
        routing_order: 0,
        status: "PENDING",
        kyc_status: "VERIFIED",
        completed_at: null,
      },
      {
        id: "r2",
        role_key: "issuer_director",
        role_label: "Issuer director",
        name: "Kau Khai Kit",
        email: "khai.kit@truestack.my",
        routing_order: 1,
        status: "PENDING",
        kyc_status: "VERIFIED",
        completed_at: null,
      },
    ],
    assignments: [
      {
        id: "a1",
        document_id: "d1",
        recipient_id: "r1",
        required: true,
        action: "SIGN",
        status: "PENDING",
        signed_at: null,
      },
      {
        id: "a2",
        document_id: "d1",
        recipient_id: "r2",
        required: true,
        action: "SIGN",
        status: "PENDING",
        signed_at: null,
      },
    ],
  };

  it("returns the next unsigned assignment for the given recipient", () => {
    const assignment = findUnsignedSigningAssignmentForRecipient(envelope, "r2");
    expect(assignment?.recipient.id).toBe("r2");
    expect(normalizeSigningEmail(assignment?.recipient.email ?? "")).toBe("khai.kit@truestack.my");
  });

  it("returns null when the recipient has no pending assignments", () => {
    expect(findUnsignedSigningAssignmentForRecipient(envelope, "missing")).toBeNull();
  });
});
