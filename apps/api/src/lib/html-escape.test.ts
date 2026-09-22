import { escapeHtml } from "./html-escape";

describe("escapeHtml", () => {
  it("encodes markup so injected tags render as text", () => {
    expect(escapeHtml(`Invoice <img src=x onerror=alert(1)> INV-001`)).toBe(
      "Invoice &lt;img src=x onerror=alert(1)&gt; INV-001"
    );
    expect(escapeHtml(`<script>alert("xss")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
    );
    expect(escapeHtml(`O'Brien & Co`)).toBe("O&#39;Brien &amp; Co");
  });
});
