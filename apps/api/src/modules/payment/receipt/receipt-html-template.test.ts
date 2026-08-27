import { buildPaymentReceiptHtml } from "./receipt-html-template";

describe("receipt-html-template", () => {
  const html = buildPaymentReceiptHtml({
    receiptNumber: "RCP-20260803-001",
    receiptDateLabel: "03 Aug 2026, 10:00:00 AM",
    merchant: {
      legalName: "CashSouk Sdn Bhd",
      registrationNumber: "123456-A",
      licenceNumber: "LIC-1",
      address: "Kuala Lumpur",
      telephone: "+60 3 0000 0000",
      email: "finance@cashsouk.test",
    },
    payerName: "Ali",
    payerCompanyName: "Ali Sdn Bhd",
    payerUniqueId: null,
    payerRegistrationNumber: "123456-A",
    payerEmail: "ali@example.com",
    payerPhone: "+60123456789",
    purposeLabel: "Investor Deposit",
    amountLabel: "RM 1,000.00",
    currency: "MYR",
    paymentMethod: "fpx",
    paymentStatus: "Paid",
    paymentDateLabel: "03 Aug 2026, 09:55:00 AM",
    curlecPaymentId: "pay_123",
    curlecOrderId: "order_123",
    relatedReferenceLabel: null,
    relatedReference: null,
    walletCreditStatus: "Credited",
  });

  it("includes core receipt fields", () => {
    expect(html).toContain("PAYMENT RECEIPT");
    expect(html).toContain("RCP-20260803-001");
    expect(html).toContain("Investor Deposit");
    expect(html).toContain("RM 1,000.00");
    expect(html).toContain("TOTAL PAID");
    expect(html).toContain("Curlec Payment ID");
    expect(html).toContain("Curlec Order ID");
    expect(html).not.toContain("Deposit Reference");
    expect(html).not.toContain("dep_");
    expect(html).toContain("Wallet Credit Status");
    expect(html).toContain("Credited");
    expect(html).toContain("Ali Sdn Bhd (123456-A)");
    expect(html).not.toContain("Registration No.");
    expect(html).not.toContain("Unique ID");
    expect(html).toContain("This is a computer-generated receipt");
  });

  it("embeds CashSouk branding in the header", () => {
    expect(html).toContain("brand-logo");
    expect(html).toContain("data:image/svg+xml;base64,");
    expect(html).toContain("#8A0304");
    expect(html).toContain("Invest in Growth. Earn with Purpose.");
    expect(html).not.toContain('class="merchant-legal"');
  });

  it("does not include repayment-only fields", () => {
    expect(html).not.toContain("instalment");
    expect(html).not.toContain("late fee");
    expect(html).not.toContain("outstanding financing");
    expect(html).not.toContain("Loan ID");
    expect(html).not.toContain("repayment schedule");
  });

  it("escapes dynamic HTML values", () => {
    const escaped = buildPaymentReceiptHtml({
      receiptNumber: "RCP-20260803-002",
      receiptDateLabel: "date",
      merchant: {
        legalName: "CashSouk <script>",
        registrationNumber: "REG<script>",
        licenceNumber: null,
        address: null,
        telephone: null,
        email: null,
      },
      payerName: "<b>Ali</b>",
      payerCompanyName: null,
      payerUniqueId: "IVT-<script>",
      payerRegistrationNumber: null,
      payerEmail: null,
      payerPhone: null,
      purposeLabel: "Issuer Registration Fee",
      amountLabel: "RM 150.00",
      currency: "MYR",
      paymentMethod: null,
      paymentStatus: "Paid",
      paymentDateLabel: "date",
      curlecPaymentId: null,
      curlecOrderId: "order_1",
      relatedReferenceLabel: "Issuer Reference",
      relatedReference: "org_1",
      walletCreditStatus: null,
    });

    expect(escaped).toContain("REG&lt;script&gt;");
    expect(escaped).toContain("&lt;b&gt;Ali&lt;/b&gt; (IVT-&lt;script&gt;)");
    expect(escaped).not.toContain("Unique ID");
    expect(escaped).not.toContain("<script>");
  });

  it("prints unique ID for individuals and omits empty registration", () => {
    const individual = buildPaymentReceiptHtml({
      receiptNumber: "RCP-20260803-003",
      receiptDateLabel: "date",
      merchant: {
        legalName: "CashSouk Sdn Bhd",
        registrationNumber: null,
        licenceNumber: null,
        address: null,
        telephone: null,
        email: null,
      },
      payerName: "Ali Bin Abu",
      payerCompanyName: null,
      payerUniqueId: "IVT-202608-A12",
      payerRegistrationNumber: null,
      payerEmail: null,
      payerPhone: null,
      purposeLabel: "Investor Deposit",
      amountLabel: "RM 100.00",
      currency: "MYR",
      paymentMethod: "fpx",
      paymentStatus: "Paid",
      paymentDateLabel: "date",
      curlecPaymentId: null,
      curlecOrderId: "order_1",
      relatedReferenceLabel: null,
      relatedReference: null,
      walletCreditStatus: "Credited",
    });

    expect(individual).toContain("Ali Bin Abu (IVT-202608-A12)");
    expect(individual).not.toContain("Unique ID");
    expect(individual).not.toContain("Registration No.");
    expect(individual).not.toContain(">Company<");
  });
});
