import {
  createEvidenceItem,
  type EvidenceItem,
} from "../core/evidence";
import { type ExtractedTransaction } from "./financialTypes";

export class FinancialEvidenceBuilder {
  /**
   * Constructs an authenticated, deduplicated EvidenceItem from an extracted transaction.
   * Enforces zero-raw-message-body storage: only stores sanitized metadata and headers.
   */
  static buildTransactionEvidence(
    userId: string,
    tx: ExtractedTransaction
  ): EvidenceItem {
    const summary = `${tx.documentType} from ${tx.merchantName}: ${
      tx.amount && tx.currency ? `${tx.currency} ${tx.amount}` : "Transaction event"
    } on ${tx.transactionDate.slice(0, 10)}`;

    const canonicalPayload = `${tx.merchantName}:${tx.senderDomain}:${tx.amount || 0}:${
      tx.currency || "NONE"
    }:${tx.transactionDate.slice(0, 10)}:${tx.invoiceNumber || ""}`;

    return createEvidenceItem({
      userId,
      source: "gmail_mailbox_metadata",
      type: "MAILBOX_HEADER",
      reliability: "AUTHORITATIVE",
      summary,
      rawPayloadToFingerprint: canonicalPayload,
      sanitizedSnippet: tx.evidenceSnippet || tx.emailSubject,
      metadata: {
        merchantName: tx.merchantName,
        senderDomain: tx.senderDomain,
        amount: tx.amount,
        currency: tx.currency,
        documentType: tx.documentType,
        paymentStatus: tx.paymentStatus,
        transactionDate: tx.transactionDate,
        invoiceNumber: tx.invoiceNumber,
        billingFrequency: tx.billingFrequency,
      },
    });
  }
}
