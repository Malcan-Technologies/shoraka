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
    relatedReferenceLabel: "Deposit Reference",
    relatedReference: "dep_abc",
    walletCreditStatus: "Credited",
  });

  it("includes core receipt fields", () => {
    expect(html).toContain("PAYMENT RECEIPT");
    expect(html).toContain("RCP-20260803-001");
    expect(html).toContain("Investor Deposit");
    expect(html).toContain("RM 1,000.00");
    expect(html).toContain("TOTAL PAID");
    expect(html).toContain("Deposit Reference");
    expect(html).toContain("dep_abc");
    expect(html).toContain("Curlec Payment ID");
    expect(html).toContain("Curlec Order ID");
    expect(html).toContain("Wallet Credit Status");
    expect(html).toContain("Credited");
    expect(html).toContain("This is a computer-generated receipt");
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
        registrationNumber: null,
        licenceNumber: null,
        address: null,
        telephone: null,
        email: null,
      },
      payerName: "<b>Ali</b>",
      payerCompanyName: null,
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

    expect(escaped).toContain("CashSouk &lt;script&gt;");
    expect(escaped).toContain("&lt;b&gt;Ali&lt;/b&gt;");
    expect(escaped).not.toContain("<script>");
  });
});
