import { CurrencyNormalizer } from "./currencyNormalizer";
import { MerchantNormalizer } from "./merchantNormalizer";
import {
  type ExtractedTransaction,
  type FinancialDocumentType,
  type PaymentStatus,
  type BillingFrequency,
} from "./financialTypes";

export interface RawEmailFinancialInput {
  messageId: string;
  senderDomain: string;
  senderDisplayName?: string;
  subject: string;
  dateStr: string;
  snippet?: string;
}

export class TransactionExtractor {
  /**
   * Classifies the financial document type from subject and snippet.
   */
  static classifyDocumentType(subject: string, snippet = ""): FinancialDocumentType {
    const text = `${subject} ${snippet}`.toLowerCase();

    if (/trial cancel(?:led|ed)|cancel(?:led|ed) your trial/i.test(text)) {
      return "TRIAL_CANCELLATION";
    }
    if (/free trial|trial started|welcome to your trial|trial confirm/i.test(text)) {
      return "TRIAL_CONFIRMATION";
    }
    if (/price update|price change|rate increase|upcoming price/i.test(text)) {
      return "PRICE_UPDATE_NOTICE";
    }
    if (/payment (?:received|successful|processed)|receipt for|charged your|auto-renew(?:al)? successful/i.test(text)) {
      return "PAYMENT_RECEIPT";
    }
    if (/invoice (?:#|due|ready|generated)|your bill is ready/i.test(text)) {
      return "INVOICE";
    }
    if (/renew(?:al)? notice|upcoming renewal|will renew on/i.test(text)) {
      return "RENEWAL_NOTICE";
    }
    if (/order confirm(?:ed|ation)|thank you for your order|order #/i.test(text)) {
      return "ORDER_CONFIRMATION";
    }

    return "UNKNOWN";
  }

  /**
   * Classifies payment status from financial document text.
   */
  static classifyPaymentStatus(docType: FinancialDocumentType, subject: string, snippet = ""): PaymentStatus {
    const text = `${subject} ${snippet}`.toLowerCase();

    if (/refund(?:ed| issued)|credit issued/i.test(text)) {
      return "REFUNDED";
    }
    if (/payment (?:failed|declined)|card declined|action required on payment/i.test(text)) {
      return "FAILED";
    }
    if (docType === "PAYMENT_RECEIPT" || /paid in full|payment received|charge completed/i.test(text)) {
      return "CONFIRMED_PAID";
    }
    if (docType === "INVOICE") {
      return "INVOICED_ONLY";
    }
    if (docType === "ORDER_CONFIRMATION" || docType === "RENEWAL_NOTICE") {
      return "PENDING";
    }

    return "INVOICED_ONLY";
  }

  /**
   * Detects billing frequency keywords from subject and snippet.
   */
  static detectBillingFrequency(text: string): BillingFrequency {
    if (/\b(?:annual(?:ly)?|yearly|per year|\/yr|\/year)\b/i.test(text)) {
      return "ANNUAL";
    }
    if (/\b(?:month(?:ly)?|per month|\/mo|\/month)\b/i.test(text)) {
      return "MONTHLY";
    }
    if (/\b(?:quarter(?:ly)?|every 3 months)\b/i.test(text)) {
      return "QUARTERLY";
    }
    if (/\b(?:week(?:ly)?|per week|\/wk)\b/i.test(text)) {
      return "WEEKLY";
    }
    return "UNKNOWN";
  }

  /**
   * Extracts invoice / transaction reference code.
   */
  static extractInvoiceNumber(text: string): string | undefined {
    const match = text.match(/\b(?:invoice|receipt|order)\s*(?:#|no\.?|num\.?)?\s*([A-Za-z0-9\-]{5,24})\b/i);
    return match ? match[1] : undefined;
  }

  /**
   * Sanitizes snippet and redacts credit card numbers or address tokens.
   */
  static sanitizeSnippet(raw: string): string {
    return raw
      // Redact 13-19 digit card numbers
      .replace(/\b(?:\d{4}[ -]?){3}\d{1,4}\b/g, "[CARD REDACTED]")
      // Redact CVV
      .replace(/\bcvv[:\s]*\d{3,4}\b/gi, "[CVV REDACTED]")
      // Strip script/style tags if present
      .replace(/<[^>]*>/g, " ")
      .trim();
  }

  /**
   * Extracts financial transaction from email metadata and snippet.
   */
  static extract(input: RawEmailFinancialInput): ExtractedTransaction {
    const normalizedMerchant = MerchantNormalizer.normalize(
      input.senderDomain,
      input.senderDisplayName
    );

    const docType = this.classifyDocumentType(input.subject, input.snippet);
    const paymentStatus = this.classifyPaymentStatus(docType, input.subject, input.snippet);
    const frequency = this.detectBillingFrequency(`${input.subject} ${input.snippet || ""}`);
    const invoiceNumber = this.extractInvoiceNumber(`${input.subject} ${input.snippet || ""}`);

    // Parse monetary amount from subject first, then snippet
    let parsedMonetary = CurrencyNormalizer.parseMonetaryAmount(input.subject);
    if (!parsedMonetary && input.snippet) {
      parsedMonetary = CurrencyNormalizer.parseMonetaryAmount(input.snippet);
    }

    // Isolate tax amount if present
    let taxAmount: number | undefined = undefined;
    if (input.snippet) {
      const taxMatch = input.snippet.match(/(?:tax|gst|vat)[:\s]*(₹|Rs\.?|\$|USD|€|EUR|£|GBP)\s*([0-9]+(?:\.[0-9]{2})?)/i);
      if (taxMatch && taxMatch[2]) {
        const parsedTax = parseFloat(taxMatch[2]);
        if (!isNaN(parsedTax)) taxAmount = parsedTax;
      }
    }

    // Detect trial flags
    const isTrial =
      docType === "TRIAL_CONFIRMATION" ||
      docType === "TRIAL_CANCELLATION" ||
      /free trial/i.test(`${input.subject} ${input.snippet || ""}`);

    let parsedDate = new Date().toISOString();
    try {
      const d = new Date(input.dateStr);
      if (!isNaN(d.getTime())) {
        parsedDate = d.toISOString();
      }
    } catch {
      // Use fallback
    }

    const cleanSnippet = input.snippet ? this.sanitizeSnippet(input.snippet) : undefined;

    return {
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      merchantName: normalizedMerchant.canonicalName,
      senderDomain: normalizedMerchant.canonicalDomain,
      emailSubject: input.subject,
      transactionDate: parsedDate,
      amount: parsedMonetary?.amount,
      currency: parsedMonetary?.currency,
      documentType: docType,
      paymentStatus,
      taxAmount,
      invoiceNumber,
      billingFrequency: frequency,
      isTrialEvent: isTrial,
      evidenceSnippet: cleanSnippet,
      rawMessageId: input.messageId,
    };
  }
}
