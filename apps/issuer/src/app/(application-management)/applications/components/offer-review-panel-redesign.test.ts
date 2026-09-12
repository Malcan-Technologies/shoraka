import * as fs from "fs";
import * as path from "path";

const panelSource = fs.readFileSync(
  path.join(__dirname, "OfferReviewPanel.tsx"),
  "utf8"
);
const pageSource = fs.readFileSync(
  path.join(
    __dirname,
    "../../../(application-flow)/applications/[id]/page.tsx"
  ),
  "utf8"
);

describe("issuer Offer tab redesign contracts", () => {
  it("keeps live offer actions and drops the unused modal shell", () => {
    expect(panelSource).toContain("Financing offer");
    expect(panelSource).toContain("HorizontalOfferStepper");
    expect(panelSource).toContain("buildHorizontalOfferSteps");
    expect(panelSource).toContain("OfferAcceptOtpDialog");
    expect(panelSource).toContain("consentsLocked={acceptOfferConfirmOpen}");
    expect(panelSource).toContain('toast.success("Offer accepted")');
    expect(panelSource).toContain("frozenUtilisationConsentsRef");
    expect(panelSource).toContain("ISSUER_OFFER_DECLINE_REASONS");
    expect(panelSource).toContain("Keep reviewing");
    expect(panelSource).toContain("SupportingDocumentsStep");
    expect(panelSource).toContain('documentStorage="acceptance_documents"');
    expect(panelSource).toContain("AcceptanceDocumentChangesRequestedBanner");
    expect(panelSource).toContain("IssuerAuthorizedRepresentativesCard");
    expect(panelSource).toContain("SigningProgressMatrix");
    expect(panelSource).toContain("handleRefreshSigning");
    expect(panelSource).toContain("remindIssuerSigningRecipient");
    expect(panelSource).toContain("Unsaved changes");
    expect(panelSource).toContain('href="/applications"');
    expect(panelSource).toContain("Back to applications");
    expect(panelSource).toContain("ApplicationSummaryDownloadButton");
    expect(panelSource).toContain('modalMode.ui === "accept_decline"');
    expect(panelSource).not.toContain("OfferAcceptanceSubmittedSuccessView");
    expect(panelSource).not.toContain("SigningProgressStepper");
    expect(panelSource).not.toContain('mode === "inline"');
    expect(panelSource).not.toContain("DialogTitle");
  });

  it("renders the decline form once while keeping hidden documents mounted", () => {
    expect(panelSource).toContain(
      'renderSigningStepContent("documents", { ignoreRejectMode: true })'
    );
    expect(panelSource).toContain("if (isRejectMode && !options?.ignoreRejectMode)");
    expect(panelSource).toMatch(
      /isRejectMode \|\|\s*displaySigningStepId !== "documents" \|\|\s*!keepAcceptanceDocsDraftMounted/
    );
    expect(panelSource.match(/id="decline-primary-reason"/g)).toHaveLength(1);
    expect(panelSource.match(/htmlFor="decline-primary-reason"/g)).toHaveLength(1);
    expect(panelSource.match(/id="rejection-reason"/g)).toHaveLength(1);
    expect(panelSource.match(/htmlFor="rejection-reason"/g)).toHaveLength(1);
    expect(panelSource).toContain("keepAcceptanceDocsDraftMounted");
    expect(panelSource).toContain("SupportingDocumentsStep");
  });

  it("moves the offer switcher to a chip row without changing selection inclusion", () => {
    expect(pageSource).toContain("Offers awaiting your response");
    expect(pageSource).toContain("pendingOfferCount > 1");
    expect(pageSource).toContain("i.canReviewOffer");
    expect(pageSource).toContain("selectOfferInvoice(null)");
    expect(pageSource).toContain("selectOfferInvoice(inv)");
    expect(pageSource).toContain("This offer is no longer available");
    expect(pageSource).toContain("There is no offer waiting for a response");
    expect(pageSource).toContain("When CashSouk sends an offer");
    expect(pageSource).not.toContain("Offers to review");
    expect(pageSource).not.toContain('mode="inline"');
  });
});
