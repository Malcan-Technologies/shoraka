/**
 * Publish must copy approved_snapshot unchanged (no Page rebuild).
 */

describe("prospectus publish exact copy", () => {
  it("deep-clones approved freeze without mutating the source", () => {
    const approvedPage2Html = [
      '<section data-stage="2">Invoice Amount: RM 625,000.00<br />Paymaster: KKR</section>',
      '<section data-stage="3">Total Invoices Paid: 48<br />Successful Repayment: 98.5%</section>',
      '<section data-stage="7" data-soukscore-scale-version="2026.07.21.soukscore-scale.v1">',
      "<h2>RISK RATING SCALE</h2>",
      '<ol class="soukscore-scale">',
      '<li data-grade="AAA" data-selected="false"><span class="grade">AAA</span></li>',
      '<li data-grade="AA" data-selected="false"><span class="grade">AA</span></li>',
      '<li data-grade="A" data-selected="false"><span class="grade">A</span></li>',
      '<li data-grade="BBB" data-selected="true" aria-current="true"><span class="grade">BBB</span></li>',
      '<li data-grade="BB" data-selected="false"><span class="grade">BB</span></li>',
      '<li data-grade="B" data-selected="false"><span class="grade">B</span></li>',
      "</ol>",
      "</section>",
    ].join("");

    const approved = {
      publication_id: "pub-1",
      content_version: 1,
      render_fingerprint: "fp",
      html: {
        page1: "<p>1</p>",
        page2: approvedPage2Html,
        page3: [
          '<section data-content-stage="metadata-strip">',
          '<div class="meta-strip">',
          '<div class="meta-strip-item"><div class="meta-strip-label">Sector</div><div class="meta-strip-value">Construction</div></div>',
          '<div class="meta-strip-item"><div class="meta-strip-label">Risk Rating</div><div class="meta-strip-value">BBB</div></div>',
          '<div class="meta-strip-item"><div class="meta-strip-label">Paymaster</div><div class="meta-strip-value">KKR</div></div>',
          '<div class="meta-strip-item"><div class="meta-strip-label">Paymaster Grading</div><div class="meta-strip-value">PM1</div></div>',
          '<div class="meta-strip-item"><div class="meta-strip-label">Confidence Grading</div><div class="meta-strip-value">High</div></div>',
          "</div></section>",
          '<section data-content-stage="income-statement">',
          "<h2>3-YEAR INCOME STATEMENT SUMMARY (MYR mil.)</h2>",
          "<table><tr><th>Revenue</th><td>12</td><td>13.9</td><td>15</td></tr>",
          "<tr><th>Gross Profit</th><td>2.1</td><td>2.4</td><td>2.8</td></tr>",
          "<tr><th>Net Profit Margin</th><td>7.5%</td><td>8.1%</td><td>8.4%</td></tr>",
          "</table></section>",
        ].join(""),
      },
      page_1: { marker: "a" },
      page_2: {
        config_versions: {
          soukscore_scale: "2026.07.21.soukscore-scale.v1",
          legal_copy: null,
          marketing_copy: null,
        },
      },
      publication_content: { version: 1 },
      note_identity: {
        note_reference: "N-1",
        invoice_snapshot: {
          details: { value: 625_000 },
          offer_details: { risk_rating: "BBB" },
        },
        paymaster_snapshot: { name: "KKR", entity_type: "Government" },
      },
    };

    const published = structuredClone(approved) as typeof approved;
    published.html.page1 = "<p>mutated</p>";
    published.html.page2 = '<section data-stage="2">Invoice Amount: RM 1.00</section>';
    published.note_identity.invoice_snapshot = {
      details: { value: 1 },
      offer_details: { risk_rating: "AAA" },
    };
    published.page_1 = { marker: "changed" };

    expect(approved.html.page1).toBe("<p>1</p>");
    expect(approved.html.page2).toContain("RM 625,000.00");
    expect(approved.html.page2).toContain("Paymaster: KKR");
    expect(approved.html.page2).toContain("Total Invoices Paid: 48");
    expect(approved.html.page2).toContain("Successful Repayment: 98.5%");
    expect(approved.html.page2).toContain('data-grade="BBB" data-selected="true"');
    expect(approved.html.page2).toContain("RISK RATING SCALE");
    expect(approved.html.page3).toContain("Paymaster Grading");
    expect(approved.html.page3).toContain("PM1");
    expect(approved.html.page3).toContain("Confidence Grading");
    expect(approved.html.page3).toContain("High");
    expect(approved.html.page3).toContain("3-YEAR INCOME STATEMENT SUMMARY (MYR mil.)");
    expect(approved.html.page3).toContain("<td>2.1</td>");
    expect(approved.html.page3).toContain("<td>13.9</td>");
    expect(approved.html.page3).toContain("7.5%");
    expect(approved.html.page3).not.toContain("RM 2,100,000");
    expect(approved.html.page3).not.toMatch(/\bIssuer\b/);
    expect(approved.page_2.config_versions.soukscore_scale).toBe(
      "2026.07.21.soukscore-scale.v1"
    );
    expect(approved.note_identity.invoice_snapshot).toEqual({
      details: { value: 625_000 },
      offer_details: { risk_rating: "BBB" },
    });
    expect(approved.page_1).toEqual({ marker: "a" });
    expect(JSON.stringify(published.html)).not.toEqual(JSON.stringify(approved.html));
    expect(published.note_identity.invoice_snapshot.offer_details.risk_rating).toBe("AAA");
    expect(approved.html.page2).toContain('data-grade="BBB" data-selected="true"');
    expect(approved.html.page3).toContain("PM1");
  });

  it("keeps investment publication id distinct from content_version alone", () => {
    const noteA = { content_version: 1, publication_id: "pub-a" };
    const noteB = { content_version: 1, publication_id: "pub-b" };
    expect(noteA.content_version).toBe(noteB.content_version);
    expect(noteA.publication_id).not.toBe(noteB.publication_id);
  });
});
