/**
 * @jest-environment node
 */
import { renderToStaticMarkup } from "react-dom/server";
import {
  UNRESOLVED_IDENTITY_ADMIN_COPY,
  UNRESOLVED_IDENTITY_ADMIN_TITLE,
  UNRESOLVED_IDENTITY_RECOVERY_COPY,
  UNRESOLVED_IDENTITY_RECOVERY_TITLE,
} from "@cashsouk/types";
import {
  DirectorShareholderUnresolvedIdentitySection,
  DirectorShareholderUnresolvedIdentityCard,
} from "./director-shareholder-unresolved-identity-card";

const lucasDirector = {
  name: "Lucas Yi Jin",
  role: "Director",
  sharePercentage: null as number | null,
  eodRequestId: "EOD04651",
  onboardingStatus: "APPROVED",
  kycId: "KYC00073",
  amlStatus: "Unresolved",
};

const lucasShareholder = {
  name: "Lucas Yi Jin",
  role: "Shareholder (60%)",
  sharePercentage: 60,
  eodRequestId: "EOD04650",
  onboardingStatus: "APPROVED",
  kycId: null as string | null,
  amlStatus: "Unresolved",
};

function summaryBeforeDetails(html: string): string {
  const idx = html.indexOf("<details");
  return idx === -1 ? html : html.slice(0, idx);
}

describe("DirectorShareholderUnresolvedIdentitySection", () => {
  it("shows one section-level warning", () => {
    const html = renderToStaticMarkup(
      <DirectorShareholderUnresolvedIdentitySection people={[lucasDirector, lucasShareholder]} />
    );
    expect(html.match(new RegExp(UNRESOLVED_IDENTITY_ADMIN_TITLE, "g"))).toHaveLength(1);
    expect(html).toContain(UNRESOLVED_IDENTITY_ADMIN_COPY);
    expect(html).not.toContain("Save ID");
    expect(html).not.toContain("Identity could not be matched");
    expect(html).not.toContain("RegTank did not provide a government ID");
  });

  it("keeps two same-name unresolved records as two separate cards", () => {
    const html = renderToStaticMarkup(
      <DirectorShareholderUnresolvedIdentitySection people={[lucasDirector, lucasShareholder]} />
    );
    expect(html.match(/data-testid="unresolved-identity-card"/g)).toHaveLength(2);
    expect(html.match(/Lucas Yi Jin/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("Director");
    expect(html).toContain("Shareholder (60%)");
  });

  it("does not show EOD IDs in the default card summary", () => {
    const html = renderToStaticMarkup(
      <DirectorShareholderUnresolvedIdentityCard {...lucasDirector} />
    );
    const summary = summaryBeforeDetails(html);
    expect(summary).not.toContain("EOD04651");
    expect(summary).toContain("Lucas Yi Jin");
    expect(summary).toContain("Director");
    expect(summary).toContain("Identity details incomplete");
    expect(summary).toContain("Approved");
  });

  it("puts EOD ID and missing government ID under View details", () => {
    const html = renderToStaticMarkup(
      <DirectorShareholderUnresolvedIdentityCard {...lucasDirector} />
    );
    expect(html).toContain("View details");
    expect(html).toContain('data-testid="unresolved-identity-details"');
    expect(html).toContain("EOD04651");
    expect(html).toContain("Missing information");
    expect(html).toContain("Government ID");
    expect(html).toContain("KYC00073");
    expect(html).toContain("AML status");
  });

  it("shows a government ID recovery form when recover is enabled", () => {
    const html = renderToStaticMarkup(
      <DirectorShareholderUnresolvedIdentitySection
        noticeTitle={UNRESOLVED_IDENTITY_RECOVERY_TITLE}
        noticeDescription={UNRESOLVED_IDENTITY_RECOVERY_COPY}
        canRecover
        onRecoverGovernmentId={() => undefined}
        people={[{ ...lucasShareholder, email: "lucas.deng@malcan.io", recoverRole: "SHAREHOLDER" }]}
      />
    );
    expect(html).toContain("Save ID");
    expect(html).toContain(UNRESOLVED_IDENTITY_RECOVERY_TITLE);
    expect(html).toContain("Enter each person");
    expect(html).toContain("so we can match their record.");
    expect(html).not.toContain(UNRESOLVED_IDENTITY_ADMIN_TITLE);
    expect(html).not.toContain("before approving the application");
    expect(html).toContain('placeholder="MyKad / government ID"');
  });

  it("hides vendor record ids when technical details are off", () => {
    const html = renderToStaticMarkup(
      <DirectorShareholderUnresolvedIdentitySection
        noticeTitle={UNRESOLVED_IDENTITY_RECOVERY_TITLE}
        noticeDescription={UNRESOLVED_IDENTITY_RECOVERY_COPY}
        showTechnicalIds={false}
        people={[lucasDirector]}
      />
    );
    expect(html).not.toContain("RegTank");
    expect(html).not.toContain("EOD04651");
    expect(html).not.toContain("KYC00073");
    expect(html).toContain("Missing information");
    expect(html).toContain("Government ID");
  });

  it("renders an optional notice action for issuer navigation", () => {
    const html = renderToStaticMarkup(
      <DirectorShareholderUnresolvedIdentitySection
        noticeTitle={UNRESOLVED_IDENTITY_RECOVERY_TITLE}
        noticeDescription={UNRESOLVED_IDENTITY_RECOVERY_COPY}
        noticeAction={<a href="/profile?focus=directors">Open Organisation</a>}
        people={[lucasDirector]}
      />
    );
    expect(html).toContain("Open Organisation");
    expect(html).toContain("/profile?focus=directors");
  });

  it("returns null when there are no unresolved people (empty state left to parent)", () => {
    const html = renderToStaticMarkup(<DirectorShareholderUnresolvedIdentitySection people={[]} />);
    expect(html).toBe("");
  });

  it("renders verified-then-unresolved layout inputs without grouping by name", () => {
    const verifiedBlock = '<div data-testid="verified-people">Verified Person</div>';
    const unresolved = renderToStaticMarkup(
      <DirectorShareholderUnresolvedIdentitySection people={[lucasDirector, lucasShareholder]} />
    );
    const combined = `${verifiedBlock}${unresolved}`;
    expect(combined.indexOf("verified-people")).toBeLessThan(
      combined.indexOf("unresolved-identity-section")
    );
    expect(combined.match(/data-testid="unresolved-identity-card"/g)).toHaveLength(2);
  });
});
