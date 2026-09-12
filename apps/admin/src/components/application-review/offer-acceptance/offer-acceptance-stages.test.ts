import {
  advanceOpenOfferAcceptanceStages,
  buildOfferAcceptanceStageModel,
  isReferenceOfferAcceptanceStage,
  resolveOfferAcceptanceFocusStageId,
  type OfferAcceptanceStageId,
  type OfferAcceptanceStageInput,
} from "./offer-acceptance-stages";

function ids(input: OfferAcceptanceStageInput): OfferAcceptanceStageId[] {
  return buildOfferAcceptanceStageModel(input).stages.map((stage) => stage.id);
}

function stage(
  input: OfferAcceptanceStageInput,
  id: OfferAcceptanceStageId
) {
  return buildOfferAcceptanceStageModel(input).stages.find((item) => item.id === id);
}

const facilityPending: OfferAcceptanceStageInput = {
  structureType: "new_contract",
  contractStatus: "SUBMITTED",
  sectionStatuses: {
    contract_details: "PENDING",
    acceptance_documents: "PENDING",
  },
  hasAcceptanceDocumentsSection: true,
};

const issuerAuthorizedParties = {
  submitted_by_user_id: "user_1",
  submitted_at: "2026-09-12T00:00:00.000Z",
  parties: [
    {
      key: "issuer",
      entity_kind: "ISSUER",
      representatives: [
        {
          name: "Ali Bin Abu",
          email: "ali@co.my",
          ic_number: "820508105871",
          capacity: "director",
        },
      ],
    },
  ],
};

const invoiceUnderFacilityBase: OfferAcceptanceStageInput = {
  structureType: "existing_contract",
  contractStatus: "APPROVED",
  invoices: [{ id: "inv-1", status: "SUBMITTED" }],
  sectionStatuses: {
    contract_details: "APPROVED",
    invoice_details: "PENDING",
    acceptance_documents: "APPROVED",
  },
  sourceApplicationDisplayReference: "APP-100",
  hasAcceptanceDocumentsSection: true,
};

const invoiceOnlyBase: OfferAcceptanceStageInput = {
  structureType: "invoice_only",
  invoices: [{ id: "inv-1", status: "SUBMITTED" }],
  sectionStatuses: {
    contract_details: "PENDING",
    invoice_details: "PENDING",
    acceptance_documents: "PENDING",
  },
  hasAcceptanceDocumentsSection: true,
};

describe("buildOfferAcceptanceStageModel — new_contract facility", () => {
  it("lists facility review through signing, not invoice review", () => {
    expect(ids(facilityPending)).toEqual([
      "facility_review",
      "send_offer",
      "issuer_response",
      "acceptance_documents",
      "signing_package",
    ]);
    const model = buildOfferAcceptanceStageModel(facilityPending);
    expect(model.offerType).toBe("facility");
    expect(stage(facilityPending, "facility_review")?.tone).toBe("action");
    expect(stage(facilityPending, "send_offer")?.tone).toBe("locked");
    expect(stage(facilityPending, "send_offer")?.summary).toMatch(/approve facility details/i);
    expect(stage(facilityPending, "issuer_response")?.tone).toBe("locked");
    expect(stage(facilityPending, "acceptance_documents")?.tone).toBe("locked");
    expect(stage(facilityPending, "signing_package")?.tone).toBe("locked");
    expect(model.currentStageId).toBe("facility_review");
    expect(model.nextAction?.targetStageId).toBe("facility_review");
  });

  it("unlocks send offer only after facility details are approved", () => {
    const approved: OfferAcceptanceStageInput = {
      ...facilityPending,
      sectionStatuses: {
        contract_details: "APPROVED",
        acceptance_documents: "PENDING",
      },
    };
    expect(stage(approved, "facility_review")?.tone).toBe("done");
    expect(stage(approved, "send_offer")?.tone).toBe("action");
    expect(buildOfferAcceptanceStageModel(approved).currentStageId).toBe("send_offer");
  });

  it("locks facility review when underwriting prerequisites are unmet", () => {
    const input: OfferAcceptanceStageInput = {
      ...facilityPending,
      sectionLocks: {
        contract_details: {
          locked: true,
          tooltip: "Approve Financial section first",
          canManage: true,
        },
      },
    };
    expect(stage(input, "facility_review")?.tone).toBe("locked");
    expect(stage(input, "facility_review")?.lockTooltip).toBe("Approve Financial section first");
    expect(stage(input, "send_offer")?.tone).toBe("locked");
  });

  it("presents facility review as done after send/accept even when paymaster freeze locks contract actions", () => {
    const paymasterLock = {
      locked: true,
      tooltip: "Paymaster cannot be changed after a commercial offer or signed facility",
      canManage: true,
    } as const;
    const sent: OfferAcceptanceStageInput = {
      ...facilityPending,
      contractStatus: "OFFER_SENT",
      contractOfferDetails: { offer_acceptance: { status: "PENDING_ISSUER" } },
      sectionStatuses: { contract_details: "OFFER_SENT", acceptance_documents: "PENDING" },
      sectionLocks: { contract_details: paymasterLock },
    };
    expect(stage(sent, "facility_review")?.tone).toBe("done");
    expect(stage(sent, "facility_review")?.tag).toBe("Reviewed");
    expect(stage(sent, "facility_review")?.summary).toBe("Facility details reviewed.");
    expect(stage(sent, "send_offer")?.tone).toBe("done");

    const accepted: OfferAcceptanceStageInput = {
      ...facilityPending,
      contractStatus: "APPROVED",
      contractOfferDetails: { offer_acceptance: { status: "COMPLETED" } },
      sectionStatuses: { contract_details: "APPROVED", acceptance_documents: "APPROVED" },
      sectionLocks: { contract_details: paymasterLock },
    };
    expect(stage(accepted, "facility_review")?.tone).toBe("done");
    expect(stage(accepted, "facility_review")?.tag).toBe("Reviewed");
  });

  it("keeps facility review reviewed after send when the application is withdrawn", () => {
    const input: OfferAcceptanceStageInput = {
      ...facilityPending,
      contractStatus: "APPROVED",
      applicationWithdrawn: true,
      sectionLocks: {
        contract_details: {
          locked: true,
          tooltip: "Application withdrawn",
          canManage: true,
        },
      },
    };
    expect(stage(input, "facility_review")?.tone).toBe("done");
    expect(stage(input, "facility_review")?.tag).toBe("Reviewed");
  });

  it("still locks facility review when the application is withdrawn before an offer is sent", () => {
    const input: OfferAcceptanceStageInput = {
      ...facilityPending,
      applicationWithdrawn: true,
      sectionLocks: {
        contract_details: {
          locked: true,
          tooltip: "Application withdrawn",
          canManage: true,
        },
      },
    };
    expect(stage(input, "facility_review")?.tone).toBe("locked");
    expect(stage(input, "facility_review")?.tag).toBe("Locked");
  });

  it("marks send offer and issuer response after OFFER_SENT / PENDING_ISSUER", () => {
    const input: OfferAcceptanceStageInput = {
      ...facilityPending,
      contractStatus: "OFFER_SENT",
      contractOfferDetails: { offer_acceptance: { status: "PENDING_ISSUER" } },
      sectionStatuses: { contract_details: "OFFER_SENT", acceptance_documents: "PENDING" },
    };
    expect(stage(input, "facility_review")?.tone).toBe("done");
    expect(stage(input, "send_offer")?.tone).toBe("done");
    expect(stage(input, "send_offer")?.tag).toBe("Sent");
    expect(stage(input, "issuer_response")?.tone).toBe("wait");
    expect(stage(input, "issuer_response")?.summary).toMatch(/facility offer/i);
    expect(stage(input, "acceptance_documents")?.tone).toBe("wait");
    expect(buildOfferAcceptanceStageModel(input).currentStageId).toBe("issuer_response");
  });

  it("keeps issuer response as the admin action while authorised parties still need approval", () => {
    const input: OfferAcceptanceStageInput = {
      ...facilityPending,
      contractStatus: "OFFER_SENT",
      contractOfferDetails: {
        offer_acceptance: {
          status: "PENDING_ADMIN_REVIEW",
          authorized_parties: issuerAuthorizedParties,
        },
      },
      reviewItems: [
        {
          item_type: "authorized_representatives",
          item_id: "authorized_representatives:issuer",
          status: "PENDING",
        },
      ],
      sectionStatuses: { contract_details: "OFFER_SENT", acceptance_documents: "PENDING" },
    };
    expect(stage(input, "issuer_response")?.tone).toBe("action");
    expect(stage(input, "issuer_response")?.tag).toBe("Review");
    expect(stage(input, "acceptance_documents")?.tone).toBe("action");
    expect(stage(input, "signing_package")?.tone).toBe("locked");
    expect(buildOfferAcceptanceStageModel(input).currentStageId).toBe("issuer_response");
    expect(buildOfferAcceptanceStageModel(input).nextAction?.headline).toBe(
      "Review authorised parties"
    );
  });

  it("treats pending authorised-party review items as an issuer-response action even without a snapshot", () => {
    const input: OfferAcceptanceStageInput = {
      ...facilityPending,
      contractStatus: "OFFER_SENT",
      contractOfferDetails: { offer_acceptance: { status: "PENDING_ADMIN_REVIEW" } },
      reviewItems: [
        {
          item_type: "authorized_representatives",
          item_id: "authorized_representatives:issuer",
          status: "PENDING",
        },
      ],
    };
    expect(stage(input, "issuer_response")?.tone).toBe("action");
    expect(buildOfferAcceptanceStageModel(input).currentStageId).toBe("issuer_response");
  });

  it("opens acceptance documents after authorised parties are approved", () => {
    const input: OfferAcceptanceStageInput = {
      ...facilityPending,
      contractStatus: "OFFER_SENT",
      contractOfferDetails: {
        offer_acceptance: {
          status: "PENDING_ADMIN_REVIEW",
          authorized_parties: issuerAuthorizedParties,
        },
      },
      reviewItems: [
        {
          item_type: "authorized_representatives",
          item_id: "authorized_representatives:issuer",
          status: "APPROVED",
        },
      ],
      sectionStatuses: { contract_details: "OFFER_SENT", acceptance_documents: "PENDING" },
    };
    expect(stage(input, "issuer_response")?.tone).toBe("done");
    expect(stage(input, "acceptance_documents")?.tone).toBe("action");
    expect(stage(input, "signing_package")?.tone).toBe("locked");
    expect(buildOfferAcceptanceStageModel(input).currentStageId).toBe("acceptance_documents");
    expect(buildOfferAcceptanceStageModel(input).nextAction?.headline).toBe(
      "Review acceptance documents"
    );
  });

  it("opens acceptance documents when the issuer has submitted and there are no authorised parties", () => {
    const input: OfferAcceptanceStageInput = {
      ...facilityPending,
      contractStatus: "OFFER_SENT",
      contractOfferDetails: { offer_acceptance: { status: "PENDING_ADMIN_REVIEW" } },
      sectionStatuses: { contract_details: "OFFER_SENT", acceptance_documents: "PENDING" },
    };
    expect(stage(input, "issuer_response")?.tone).toBe("done");
    expect(stage(input, "acceptance_documents")?.tone).toBe("action");
    expect(stage(input, "signing_package")?.tone).toBe("locked");
    expect(buildOfferAcceptanceStageModel(input).nextAction?.headline).toBe(
      "Review acceptance documents"
    );
  });

  it("treats CHANGES_REQUESTED as waiting on the issuer, not an admin review action", () => {
    const input: OfferAcceptanceStageInput = {
      ...facilityPending,
      contractStatus: "OFFER_SENT",
      contractOfferDetails: { offer_acceptance: { status: "CHANGES_REQUESTED" } },
    };
    expect(stage(input, "issuer_response")?.tone).toBe("wait");
    expect(stage(input, "acceptance_documents")?.tone).toBe("wait");
    expect(stage(input, "acceptance_documents")?.tag).toBe("Changes requested");
    expect(stage(input, "acceptance_documents")?.summary).toMatch(/resubmit/i);
    expect(buildOfferAcceptanceStageModel(input).currentStageId).toBe("issuer_response");
    expect(buildOfferAcceptanceStageModel(input).nextAction?.headline).toBe(
      "Waiting on the issuer"
    );
  });

  it("unlocks signing at APPROVED_FOR_SIGNING", () => {
    const input: OfferAcceptanceStageInput = {
      ...facilityPending,
      contractStatus: "OFFER_SENT",
      contractOfferDetails: { offer_acceptance: { status: "APPROVED_FOR_SIGNING" } },
    };
    expect(stage(input, "acceptance_documents")?.tone).toBe("done");
    expect(stage(input, "signing_package")?.tone).toBe("action");
    expect(buildOfferAcceptanceStageModel(input).nextAction?.headline).toBe("Send signing links");
  });

  it("does not treat documents.manage as signing permission at APPROVED_FOR_SIGNING", () => {
    const documentsManageLock = {
      locked: false,
      tooltip: undefined,
      canManage: true,
    } as const;
    const readyForSigning: OfferAcceptanceStageInput = {
      ...facilityPending,
      contractStatus: "OFFER_SENT",
      contractOfferDetails: { offer_acceptance: { status: "APPROVED_FOR_SIGNING" } },
      sectionLocks: { acceptance_documents: documentsManageLock },
    };

    const withoutSigningPermission = {
      ...readyForSigning,
      canManageSigning: false,
    };
    expect(stage(withoutSigningPermission, "signing_package")?.tone).toBe("locked");
    expect(stage(withoutSigningPermission, "signing_package")?.tag).toBe("Locked");
    expect(stage(withoutSigningPermission, "signing_package")?.summary).toMatch(/permission/i);
    expect(buildOfferAcceptanceStageModel(withoutSigningPermission).nextAction?.headline).not.toBe(
      "Send signing links"
    );

    const withSigningPermission = {
      ...readyForSigning,
      canManageSigning: true,
    };
    expect(stage(withSigningPermission, "signing_package")?.tone).toBe("action");
    expect(stage(withSigningPermission, "signing_package")?.tag).toBe("Ready");
    expect(buildOfferAcceptanceStageModel(withSigningPermission).nextAction?.headline).toBe(
      "Send signing links"
    );
  });

  it("waits during SIGNING_IN_PROGRESS and completes when the envelope is done", () => {
    const inProgress: OfferAcceptanceStageInput = {
      ...facilityPending,
      contractStatus: "OFFER_SENT",
      contractOfferDetails: { offer_acceptance: { status: "SIGNING_IN_PROGRESS" } },
      signingEnvelopes: [{ status: "IN_PROGRESS", contract_id: "c1" }],
    };
    expect(stage(inProgress, "signing_package")?.tone).toBe("wait");

    const completed: OfferAcceptanceStageInput = {
      ...facilityPending,
      contractStatus: "APPROVED",
      contractOfferDetails: { offer_acceptance: { status: "COMPLETED" } },
      signingEnvelopes: [{ status: "COMPLETED", contract_id: "c1" }],
    };
    expect(stage(completed, "signing_package")?.tone).toBe("done");
    expect(buildOfferAcceptanceStageModel(completed).currentStageId).toBe("signing_package");
    expect(buildOfferAcceptanceStageModel(completed).nextAction?.headline).toBe(
      "Offer & acceptance complete"
    );
  });

  it("surfaces declined and expired commercial states", () => {
    const declined: OfferAcceptanceStageInput = {
      ...facilityPending,
      contractStatus: "WITHDRAWN",
      contractOfferDetails: { offer_acceptance: { status: "DECLINED" } },
      applicationWithdrawn: true,
      sectionLocks: {
        contract_details: {
          locked: true,
          tooltip: "Application withdrawn",
          canManage: true,
        },
      },
    };
    expect(stage(declined, "facility_review")?.tag).toBe("Reviewed");
    expect(stage(declined, "facility_review")?.tone).toBe("done");
    expect(stage(declined, "send_offer")?.tag).toBe("Declined");
    expect(stage(declined, "issuer_response")?.tag).toBe("Declined");
    expect(stage(declined, "acceptance_documents")?.tag).toBe("Skipped");
    expect(stage(declined, "acceptance_documents")?.tone).toBe("done");
    expect(stage(declined, "signing_package")?.tag).toBe("Skipped");
    expect(stage(declined, "signing_package")?.tone).toBe("done");
    expect(buildOfferAcceptanceStageModel(declined).currentStageId).toBe("issuer_response");
    expect(buildOfferAcceptanceStageModel(declined).nextAction?.headline).toBe(
      "Issuer declined the offer"
    );

    const expired: OfferAcceptanceStageInput = {
      ...facilityPending,
      contractStatus: "OFFER_EXPIRED",
      contractOfferDetails: { offer_acceptance: { status: "PENDING_ISSUER" } },
    };
    expect(stage(expired, "send_offer")?.tone).toBe("action");
    expect(stage(expired, "send_offer")?.tag).toBe("Expired");
    expect(stage(expired, "issuer_response")?.tag).toBe("Expired");
    expect(buildOfferAcceptanceStageModel(expired).nextAction?.headline).toBe("Send a new offer");
  });

  it("treats facility entity REJECTED as issuer decline and keeps send offer locked", () => {
    const input: OfferAcceptanceStageInput = {
      ...facilityPending,
      contractStatus: "REJECTED",
      contractOfferDetails: { offer_acceptance: { status: "DECLINED" } },
    };
    expect(stage(input, "send_offer")?.tone).toBe("locked");
    expect(stage(input, "send_offer")?.tag).toBe("Rejected");
    expect(stage(input, "issuer_response")?.tag).toBe("Declined");
    expect(stage(input, "issuer_response")?.summary).toMatch(/declined the facility offer/i);
    expect(stage(input, "acceptance_documents")?.tag).toBe("Skipped");
    expect(stage(input, "signing_package")?.tag).toBe("Skipped");
  });

  it("keeps amendment and rejected review states on facility review", () => {
    expect(
      stage(
        { ...facilityPending, sectionStatuses: { contract_details: "AMENDMENT_REQUESTED" } },
        "facility_review"
      )?.tag
    ).toBe("Changes requested");
    expect(
      stage(
        { ...facilityPending, sectionStatuses: { contract_details: "REJECTED" } },
        "facility_review"
      )?.tag
    ).toBe("Rejected");
  });

  it("omits live acceptance stages when the product has no acceptance section", () => {
    expect(
      ids({ ...facilityPending, hasAcceptanceDocumentsSection: false })
    ).toEqual(["facility_review", "send_offer", "issuer_response"]);
  });

  it("skips the documents stage on signing-only products and unlocks signing after issuer accept", () => {
    const sent: OfferAcceptanceStageInput = {
      ...facilityPending,
      hasAcceptanceDocumentsSection: false,
      hasSigningPackage: true,
      contractStatus: "OFFER_SENT",
      sectionStatuses: { contract_details: "APPROVED" },
    };
    expect(ids(sent)).toEqual([
      "facility_review",
      "send_offer",
      "issuer_response",
      "signing_package",
    ]);
    expect(stage(sent, "acceptance_documents")).toBeUndefined();
    expect(stage(sent, "signing_package")?.tone).toBe("locked");
    expect(stage(sent, "signing_package")?.summary).toMatch(/issuer accepts/i);

    const accepted: OfferAcceptanceStageInput = {
      ...sent,
      contractStatus: "APPROVED",
    };
    expect(stage(accepted, "signing_package")?.tone).toBe("action");
    expect(buildOfferAcceptanceStageModel(accepted).currentStageId).toBe("signing_package");

    const declined: OfferAcceptanceStageInput = {
      ...sent,
      contractStatus: "WITHDRAWN",
      contractOfferDetails: { offer_acceptance: { status: "DECLINED" } },
    };
    expect(stage(declined, "signing_package")?.tag).toBe("Skipped");
    expect(stage(declined, "signing_package")?.tone).toBe("done");
    expect(buildOfferAcceptanceStageModel(declined).currentStageId).toBe("issuer_response");
  });

  it("omits the signing stage when the product has acceptance documents but no signing package", () => {
    expect(
      ids({
        ...facilityPending,
        hasAcceptanceDocumentsSection: true,
        hasSigningPackage: false,
      })
    ).toEqual(["facility_review", "send_offer", "issuer_response", "acceptance_documents"]);

    const declinedDocsOnly: OfferAcceptanceStageInput = {
      ...facilityPending,
      hasAcceptanceDocumentsSection: true,
      hasSigningPackage: false,
      contractStatus: "WITHDRAWN",
      contractOfferDetails: { offer_acceptance: { status: "DECLINED" } },
      sectionStatuses: { contract_details: "APPROVED" },
    };
    expect(stage(declinedDocsOnly, "acceptance_documents")?.tag).toBe("Skipped");
    expect(stage(declinedDocsOnly, "signing_package")).toBeUndefined();
    expect(buildOfferAcceptanceStageModel(declinedDocsOnly).currentStageId).toBe(
      "issuer_response"
    );
  });
});

describe("buildOfferAcceptanceStageModel — existing_contract invoice under facility", () => {
  it("uses collapsed facility + inherited acceptance around invoice stages", () => {
    expect(ids(invoiceUnderFacilityBase)).toEqual([
      "facility_reference",
      "invoice_review",
      "send_offer",
      "issuer_response",
      "inherited_acceptance",
    ]);
    const model = buildOfferAcceptanceStageModel(invoiceUnderFacilityBase);
    expect(model.offerType).toBe("invoice");
    expect(stage(invoiceUnderFacilityBase, "facility_reference")?.title).toContain("APP-100");
    expect(stage(invoiceUnderFacilityBase, "facility_reference")?.tone).toBe("done");
    expect(stage(invoiceUnderFacilityBase, "inherited_acceptance")?.tone).toBe("done");
    expect(stage(invoiceUnderFacilityBase, "invoice_review")?.tone).toBe("action");
    expect(stage(invoiceUnderFacilityBase, "send_offer")?.tone).toBe("locked");
    expect(buildOfferAcceptanceStageModel(invoiceUnderFacilityBase).currentStageId).toBe(
      "invoice_review"
    );
    expect(resolveOfferAcceptanceFocusStageId(model)).toBe("issuer_response");
    const workflow = model.stages.filter((item) => !isReferenceOfferAcceptanceStage(item));
    expect(workflow.map((item) => item.id)).toEqual([
      "invoice_review",
      "send_offer",
      "issuer_response",
    ]);
    expect(model.stages.filter(isReferenceOfferAcceptanceStage).map((item) => item.id)).toEqual([
      "facility_reference",
      "inherited_acceptance",
    ]);
    expect(model.stages.find((item) => item.id === "facility_reference")?.kind).toBe("reference");
    expect(model.stages.find((item) => item.id === "inherited_acceptance")?.kind).toBe("reference");
  });

  it("unlocks send offer after the invoice item is approved", () => {
    const input: OfferAcceptanceStageInput = {
      ...invoiceUnderFacilityBase,
      invoices: [{ id: "inv-1", status: "SUBMITTED", details: { number: "INV-1" } }],
      reviewItems: [
        { item_type: "invoice", item_id: "invoice_details:0:INV-1", status: "APPROVED" },
      ],
    };
    expect(stage(input, "invoice_review")?.tone).toBe("done");
    expect(stage(input, "send_offer")?.tone).toBe("action");
    expect(buildOfferAcceptanceStageModel(input).currentStageId).toBe("send_offer");
  });

  it("numbers workflow from invoice review and ignores reference cards for current stage", () => {
    const approved: OfferAcceptanceStageInput = {
      ...invoiceUnderFacilityBase,
      invoices: [{ id: "inv-1", status: "APPROVED", details: { number: "INV-1" } }],
      sectionStatuses: {
        contract_details: "APPROVED",
        invoice_details: "APPROVED",
        acceptance_documents: "APPROVED",
      },
    };
    const model = buildOfferAcceptanceStageModel(approved);
    expect(model.currentStageId).toBe("issuer_response");
    expect(isReferenceOfferAcceptanceStage(stage(approved, "inherited_acceptance")!)).toBe(true);
  });

  it("waits on OTP-style issuer response after invoice offer send", () => {
    const input: OfferAcceptanceStageInput = {
      ...invoiceUnderFacilityBase,
      invoices: [{ id: "inv-1", status: "OFFER_SENT", offer_details: { offer_acceptance: { status: "PENDING_ISSUER" } } }],
      sectionStatuses: {
        contract_details: "APPROVED",
        invoice_details: "OFFER_SENT",
        acceptance_documents: "APPROVED",
      },
    };
    expect(stage(input, "invoice_review")?.tone).toBe("done");
    expect(stage(input, "send_offer")?.tone).toBe("done");
    expect(stage(input, "issuer_response")?.tone).toBe("wait");
    expect(stage(input, "issuer_response")?.summary).toMatch(/invoice offer/i);
  });

  it("completes issuer response when the invoice is approved", () => {
    const input: OfferAcceptanceStageInput = {
      ...invoiceUnderFacilityBase,
      invoices: [{ id: "inv-1", status: "APPROVED" }],
      sectionStatuses: {
        contract_details: "APPROVED",
        invoice_details: "APPROVED",
        acceptance_documents: "APPROVED",
      },
    };
    expect(stage(input, "issuer_response")?.tone).toBe("done");
    expect(stage(input, "issuer_response")?.tag).toBe("Accepted");
  });

  it("uses the selected invoice when several exist", () => {
    const input: OfferAcceptanceStageInput = {
      ...invoiceUnderFacilityBase,
      invoices: [
        { id: "inv-1", status: "APPROVED" },
        { id: "inv-2", status: "OFFER_SENT", offer_details: { offer_acceptance: { status: "PENDING_ISSUER" } } },
      ],
      selectedInvoiceId: "inv-2",
    };
    expect(stage(input, "send_offer")?.tag).toBe("Sent");
    expect(stage(input, "issuer_response")?.tone).toBe("wait");
  });

  it("keeps invoice send offer locked when the invoice tab is locked", () => {
    const input: OfferAcceptanceStageInput = {
      ...invoiceUnderFacilityBase,
      sectionLocks: {
        invoice_details: {
          locked: true,
          tooltip: "Approve Customer section first",
          canManage: true,
        },
      },
    };
    expect(stage(input, "invoice_review")?.tone).toBe("locked");
    expect(stage(input, "send_offer")?.tone).toBe("locked");
  });

  it("uses the selected invoice review-item status, not the section status", () => {
    const input: OfferAcceptanceStageInput = {
      ...invoiceUnderFacilityBase,
      invoices: [
        { id: "inv-1", status: "SUBMITTED", details: { number: "INV-1" } },
        { id: "inv-2", status: "SUBMITTED", details: { number: "INV-2" } },
      ],
      selectedInvoiceId: "inv-2",
      sectionStatuses: {
        contract_details: "APPROVED",
        invoice_details: "PENDING",
        acceptance_documents: "APPROVED",
      },
      reviewItems: [
        { item_type: "invoice", item_id: "invoice_details:0:INV-1", status: "APPROVED" },
        { item_type: "invoice", item_id: "invoice_details:1:INV-2", status: "AMENDMENT_REQUESTED" },
      ],
    };
    expect(stage(input, "invoice_review")?.tag).toBe("Changes requested");
    expect(stage({ ...input, selectedInvoiceId: "inv-1" }, "invoice_review")?.tag).toBe("Approved");
  });

  it("keeps admin-rejected invoices on the rejected review stage instead of treating them as sent", () => {
    const declinedWithoutOffer: OfferAcceptanceStageInput = {
      ...invoiceUnderFacilityBase,
      invoices: [{ id: "inv-1", status: "REJECTED", details: { number: "INV-1" } }],
      reviewItems: [
        { item_type: "invoice", item_id: "invoice_details:0:INV-1", status: "PENDING" },
      ],
    };
    expect(stage(declinedWithoutOffer, "issuer_response")?.tag).toBe("Locked");
    expect(stage(declinedWithoutOffer, "invoice_review")?.tag).toBe("Review");
    expect(stage(declinedWithoutOffer, "send_offer")?.tone).toBe("locked");

    const adminRejected: OfferAcceptanceStageInput = {
      ...invoiceUnderFacilityBase,
      invoices: [{ id: "inv-1", status: "REJECTED", details: { number: "INV-1" } }],
      reviewItems: [
        { item_type: "invoice", item_id: "invoice_details:0:INV-1", status: "REJECTED" },
      ],
    };
    expect(stage(adminRejected, "invoice_review")?.tag).toBe("Rejected");
    expect(stage(adminRejected, "send_offer")?.tone).toBe("locked");
    expect(stage(adminRejected, "send_offer")?.tag).toBe("Rejected");
    expect(stage(adminRejected, "issuer_response")?.tag).toBe("Locked");
  });

  it("still treats issuer WITHDRAWN as a declined offer response", () => {
    const withdrawn: OfferAcceptanceStageInput = {
      ...invoiceUnderFacilityBase,
      invoices: [{ id: "inv-1", status: "WITHDRAWN", details: { number: "INV-1" } }],
      reviewItems: [
        { item_type: "invoice", item_id: "invoice_details:0:INV-1", status: "APPROVED" },
      ],
      applicationWithdrawn: true,
      sectionLocks: {
        invoice_details: {
          locked: true,
          tooltip: "Application withdrawn",
          canManage: true,
        },
      },
    };
    expect(stage(withdrawn, "invoice_review")?.tag).toBe("Reviewed");
    expect(stage(withdrawn, "invoice_review")?.tone).toBe("done");
    expect(stage(withdrawn, "send_offer")?.tag).toBe("Declined");
    expect(stage(withdrawn, "issuer_response")?.tag).toBe("Declined");
    expect(stage(withdrawn, "inherited_acceptance")?.tone).toBe("done");
    expect(buildOfferAcceptanceStageModel(withdrawn).currentStageId).toBe("issuer_response");
  });
});

describe("buildOfferAcceptanceStageModel — invoice_only", () => {
  it("starts with customer review then invoice, offer, acceptance, signing", () => {
    expect(ids(invoiceOnlyBase)).toEqual([
      "customer_review",
      "invoice_review",
      "send_offer",
      "issuer_response",
      "acceptance_documents",
      "signing_package",
    ]);
    const model = buildOfferAcceptanceStageModel(invoiceOnlyBase);
    expect(model.offerType).toBe("invoice");
    expect(stage(invoiceOnlyBase, "customer_review")?.tone).toBe("action");
    expect(stage(invoiceOnlyBase, "invoice_review")?.tone).toBe("locked");
    expect(stage(invoiceOnlyBase, "invoice_review")?.summary).toMatch(/customer details first/i);
    expect(stage(invoiceOnlyBase, "send_offer")?.tone).toBe("locked");
    expect(stage(invoiceOnlyBase, "issuer_response")?.tone).toBe("locked");
    expect(stage(invoiceOnlyBase, "acceptance_documents")?.tone).toBe("locked");
    expect(stage(invoiceOnlyBase, "signing_package")?.tone).toBe("locked");
    expect(model.currentStageId).toBe("customer_review");
    expect(resolveOfferAcceptanceFocusStageId(model)).toBe("acceptance_documents");
  });

  it("keeps invoice review and send offer locked until customer details are approved", () => {
    const invoiceApprovedEarly: OfferAcceptanceStageInput = {
      ...invoiceOnlyBase,
      invoices: [{ id: "inv-1", status: "SUBMITTED", details: { number: "INV-1" } }],
      reviewItems: [
        { item_type: "invoice", item_id: "invoice_details:0:INV-1", status: "APPROVED" },
      ],
    };
    expect(stage(invoiceApprovedEarly, "invoice_review")?.tone).toBe("locked");
    expect(stage(invoiceApprovedEarly, "send_offer")?.tone).toBe("locked");
    expect(stage(invoiceApprovedEarly, "send_offer")?.lockTooltip).toMatch(/customer details first/i);
    expect(buildOfferAcceptanceStageModel(invoiceApprovedEarly).currentStageId).toBe(
      "customer_review"
    );
  });

  it("treats approved customer as done and moves to invoice review", () => {
    const input: OfferAcceptanceStageInput = {
      ...invoiceOnlyBase,
      sectionStatuses: {
        contract_details: "APPROVED",
        invoice_details: "PENDING",
        acceptance_documents: "PENDING",
      },
    };
    expect(stage(input, "customer_review")?.tone).toBe("done");
    expect(stage(input, "invoice_review")?.tone).toBe("action");
    expect(stage(input, "send_offer")?.tone).toBe("locked");
    expect(buildOfferAcceptanceStageModel(input).currentStageId).toBe("invoice_review");
  });

  it("unlocks invoice send offer after the invoice item is approved", () => {
    const input: OfferAcceptanceStageInput = {
      ...invoiceOnlyBase,
      invoices: [{ id: "inv-1", status: "SUBMITTED", details: { number: "INV-1" } }],
      sectionStatuses: {
        contract_details: "APPROVED",
        invoice_details: "PENDING",
        acceptance_documents: "PENDING",
      },
      reviewItems: [
        { item_type: "invoice", item_id: "invoice_details:0:INV-1", status: "APPROVED" },
      ],
    };
    expect(stage(input, "invoice_review")?.tone).toBe("done");
    expect(stage(input, "send_offer")?.tone).toBe("action");
    expect(buildOfferAcceptanceStageModel(input).currentStageId).toBe("send_offer");
  });

  it("follows invoice send → issuer wait → acceptance action → signing", () => {
    const sent: OfferAcceptanceStageInput = {
      ...invoiceOnlyBase,
      invoices: [
        {
          id: "inv-1",
          status: "OFFER_SENT",
          offer_details: { offer_acceptance: { status: "PENDING_ISSUER" } },
        },
      ],
      sectionStatuses: {
        contract_details: "APPROVED",
        invoice_details: "OFFER_SENT",
        acceptance_documents: "PENDING",
      },
    };
    expect(stage(sent, "send_offer")?.tone).toBe("done");
    expect(stage(sent, "issuer_response")?.tone).toBe("wait");

    const review: OfferAcceptanceStageInput = {
      ...sent,
      invoices: [
        {
          id: "inv-1",
          status: "OFFER_SENT",
          offer_details: { offer_acceptance: { status: "PENDING_ADMIN_REVIEW" } },
        },
      ],
    };
    expect(stage(review, "acceptance_documents")?.tone).toBe("action");

    const signing: OfferAcceptanceStageInput = {
      ...sent,
      invoices: [
        {
          id: "inv-1",
          status: "OFFER_SENT",
          offer_details: { offer_acceptance: { status: "APPROVED_FOR_SIGNING" } },
        },
      ],
    };
    expect(stage(signing, "signing_package")?.tone).toBe("action");
  });

  it("skips acceptance documents and signing after the issuer declines", () => {
    const declined: OfferAcceptanceStageInput = {
      ...invoiceOnlyBase,
      invoices: [
        {
          id: "inv-1",
          status: "WITHDRAWN",
          offer_details: { offer_acceptance: { status: "DECLINED" } },
        },
      ],
      sectionStatuses: {
        contract_details: "APPROVED",
        invoice_details: "APPROVED",
        acceptance_documents: "PENDING",
      },
      reviewItems: [
        { item_type: "invoice", item_id: "invoice_details:0:INV-1", status: "APPROVED" },
      ],
      applicationWithdrawn: true,
      sectionLocks: {
        contract_details: {
          locked: true,
          tooltip: "Application withdrawn",
          canManage: true,
        },
        invoice_details: {
          locked: true,
          tooltip: "Application withdrawn",
          canManage: true,
        },
      },
    };
    expect(stage(declined, "customer_review")?.tag).toBe("Reviewed");
    expect(stage(declined, "invoice_review")?.tag).toBe("Reviewed");
    expect(stage(declined, "invoice_review")?.tone).toBe("done");
    expect(stage(declined, "issuer_response")?.tag).toBe("Declined");
    expect(stage(declined, "acceptance_documents")?.tag).toBe("Skipped");
    expect(stage(declined, "signing_package")?.tag).toBe("Skipped");
    expect(buildOfferAcceptanceStageModel(declined).currentStageId).toBe("issuer_response");
    expect(buildOfferAcceptanceStageModel(declined).nextAction?.headline).toBe(
      "Issuer declined the offer"
    );
  });

  it("keeps invoice review reviewed after send when the application is withdrawn", () => {
    const input: OfferAcceptanceStageInput = {
      ...invoiceOnlyBase,
      invoices: [
        {
          id: "inv-1",
          status: "OFFER_SENT",
          offer_details: { offer_acceptance: { status: "PENDING_ISSUER" } },
        },
      ],
      sectionStatuses: {
        contract_details: "APPROVED",
        invoice_details: "APPROVED",
        acceptance_documents: "PENDING",
      },
      reviewItems: [
        { item_type: "invoice", item_id: "invoice_details:0:INV-1", status: "APPROVED" },
      ],
      applicationWithdrawn: true,
      sectionLocks: {
        invoice_details: {
          locked: true,
          tooltip: "Application withdrawn",
          canManage: true,
        },
      },
    };
    expect(stage(input, "invoice_review")?.tag).toBe("Reviewed");
    expect(stage(input, "invoice_review")?.tone).toBe("done");
  });

  it("treats invoice CHANGES_REQUESTED as waiting on the issuer", () => {
    const input: OfferAcceptanceStageInput = {
      ...invoiceOnlyBase,
      invoices: [
        {
          id: "inv-1",
          status: "OFFER_SENT",
          offer_details: { offer_acceptance: { status: "CHANGES_REQUESTED" } },
        },
      ],
      sectionStatuses: {
        contract_details: "APPROVED",
        invoice_details: "OFFER_SENT",
        acceptance_documents: "PENDING",
      },
    };
    expect(stage(input, "issuer_response")?.tone).toBe("wait");
    expect(stage(input, "acceptance_documents")?.tone).toBe("wait");
    expect(buildOfferAcceptanceStageModel(input).currentStageId).toBe("issuer_response");
  });

  it("locks customer review when the section cannot be managed", () => {
    const input: OfferAcceptanceStageInput = {
      ...invoiceOnlyBase,
      sectionLocks: {
        contract_details: {
          locked: true,
          tooltip: "You do not have permission to perform this action.",
          canManage: false,
        },
      },
    };
    expect(stage(input, "customer_review")?.tone).toBe("locked");
    expect(stage(input, "customer_review")?.lockTooltip).toMatch(/permission/i);
  });

  it("presents approved customer review as done after invoice offer sent even when paymaster freeze locks contract actions", () => {
    const paymasterLock = {
      locked: true,
      tooltip: "Paymaster cannot be changed after a commercial offer or signed facility",
      canManage: true,
    } as const;
    const sent: OfferAcceptanceStageInput = {
      ...invoiceOnlyBase,
      invoices: [
        {
          id: "inv-1",
          status: "OFFER_SENT",
          offer_details: { offer_acceptance: { status: "PENDING_ISSUER" } },
        },
      ],
      sectionStatuses: {
        contract_details: "APPROVED",
        invoice_details: "OFFER_SENT",
        acceptance_documents: "PENDING",
      },
      sectionLocks: { contract_details: paymasterLock },
    };
    expect(stage(sent, "customer_review")?.tone).toBe("done");
    expect(stage(sent, "customer_review")?.tag).toBe("Reviewed");
    expect(stage(sent, "customer_review")?.summary).toBe("Customer details reviewed.");
    expect(stage(sent, "customer_review")?.lockTooltip).toBeUndefined();
  });

  it("does not mark pending or rejected customer review done solely because an invoice offer exists", () => {
    const paymasterLock = {
      locked: true,
      tooltip: "Paymaster cannot be changed after a commercial offer or signed facility",
      canManage: true,
    } as const;
    const withSentOffer = (
      customerStatus: string
    ): OfferAcceptanceStageInput => ({
      ...invoiceOnlyBase,
      invoices: [
        {
          id: "inv-1",
          status: "OFFER_SENT",
          offer_details: { offer_acceptance: { status: "PENDING_ISSUER" } },
        },
      ],
      sectionStatuses: {
        contract_details: customerStatus,
        invoice_details: "OFFER_SENT",
        acceptance_documents: "PENDING",
      },
      sectionLocks: { contract_details: paymasterLock },
    });

    expect(stage(withSentOffer("PENDING"), "customer_review")?.tone).toBe("action");
    expect(stage(withSentOffer("PENDING"), "customer_review")?.tag).toBe("Review");
    expect(stage(withSentOffer("REJECTED"), "customer_review")?.tone).toBe("action");
    expect(stage(withSentOffer("REJECTED"), "customer_review")?.tag).toBe("Rejected");
    expect(stage(withSentOffer("AMENDMENT_REQUESTED"), "customer_review")?.tone).toBe("action");
    expect(stage(withSentOffer("AMENDMENT_REQUESTED"), "customer_review")?.tag).toBe(
      "Changes requested"
    );
  });

  it("keeps customer review locked by paymaster freeze before an invoice offer is sent", () => {
    const input: OfferAcceptanceStageInput = {
      ...invoiceOnlyBase,
      sectionStatuses: {
        contract_details: "APPROVED",
        invoice_details: "PENDING",
        acceptance_documents: "PENDING",
      },
      sectionLocks: {
        contract_details: {
          locked: true,
          tooltip: "Paymaster cannot be changed after a commercial offer or signed facility",
          canManage: true,
        },
      },
    };
    expect(stage(input, "customer_review")?.tone).toBe("locked");
    expect(stage(input, "customer_review")?.tag).toBe("Locked");
    expect(stage(input, "customer_review")?.lockTooltip).toMatch(/Paymaster cannot be changed/);
  });
});

describe("advanceOpenOfferAcceptanceStages", () => {
  it("collapses the completed current card and opens the next current card", () => {
    const open = advanceOpenOfferAcceptanceStages(
      new Set(["invoice_review", "facility_reference"]),
      "invoice_review",
      "send_offer"
    );
    expect([...open].sort()).toEqual(["facility_reference", "send_offer"]);
  });

  it("keeps the current card open when the current stage does not change", () => {
    const open = advanceOpenOfferAcceptanceStages(
      new Set(["customer_review"]),
      "customer_review",
      "customer_review"
    );
    expect([...open]).toEqual(["customer_review"]);
  });

  it("opens the next current card even if it was not already expanded", () => {
    const open = advanceOpenOfferAcceptanceStages(new Set(["facility_review"]), "facility_review", "send_offer");
    expect([...open]).toEqual(["send_offer"]);
  });
});
