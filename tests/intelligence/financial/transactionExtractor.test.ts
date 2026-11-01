import { describe, it, expect } from "vitest";
import { TransactionExtractor } from "@/lib/intelligence/financial/transactionExtractor";

describe("TransactionExtractor", () => {
  it("classifies payment receipts versus invoices", () => {
    const receipt = TransactionExtractor.extract({
      messageId: "msg_001",
      senderDomain: "netflix.com",
      senderDisplayName: "Netflix",
      subject: "Your receipt for Netflix: $15.49",
      dateStr: "2026-10-15T12:00:00Z",
      snippet: "Thank you for streaming with us. Your monthly plan was renewed.",
    });

    expect(receipt.documentType).toBe("PAYMENT_RECEIPT");
    expect(receipt.paymentStatus).toBe("CONFIRMED_PAID");
    expect(receipt.amount).toBe(15.49);
    expect(receipt.currency).toBe("USD");
    expect(receipt.billingFrequency).toBe("MONTHLY");

    const invoice = TransactionExtractor.extract({
      messageId: "msg_002",
      senderDomain: "acmecorp.com",
      senderDisplayName: "Acme Corp",
      subject: "Invoice #INV-9823 is ready to view",
      dateStr: "2026-10-14T09:00:00Z",
      snippet: "Your bill of $120.00 is due on Nov 1st.",
    });

    expect(invoice.documentType).toBe("INVOICE");
    expect(invoice.paymentStatus).toBe("INVOICED_ONLY");
    expect(invoice.invoiceNumber).toBe("INV-9823");
  });

  it("extracts tax amounts without distorting the primary total", () => {
    const tx = TransactionExtractor.extract({
      messageId: "msg_003",
      senderDomain: "openai.com",
      senderDisplayName: "OpenAI",
      subject: "Payment received for ChatGPT Plus: $20.00",
      dateStr: "2026-10-10T15:30:00Z",
      snippet: "Subtotal: $20.00. Tax: $3.60. Total charged: $23.60 to Visa ending in 1234.",
    });

    expect(tx.merchantName).toBe("OpenAI");
    expect(tx.amount).toBe(20.00);
    expect(tx.taxAmount).toBe(3.60);
    expect(tx.paymentStatus).toBe("CONFIRMED_PAID");
  });

  it("sanitizes snippets and redacts credit card numbers", () => {
    const clean = TransactionExtractor.sanitizeSnippet(
      "Your order was paid with card 4111 2222 3333 4444 and CVV: 892. Billing address: 123 Main St."
    );
    expect(clean).toContain("[CARD REDACTED]");
    expect(clean).toContain("[CVV REDACTED]");
    expect(clean).not.toContain("4111 2222 3333 4444");
    expect(clean).not.toContain("892");
  });
});
