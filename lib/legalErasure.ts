export type LegalErasureRegulation = "DPDP_INDIA" | "GDPR_EU" | "COMBINED";

export interface LegalErasureInput {
  serviceName: string;
  senderDomain: string;
  userEmail: string;
  firstSeenDate?: string;
  lastSeenDate?: string;
  regulation: LegalErasureRegulation;
}

export interface LegalErasureNotice {
  recipientEmail: string;
  subject: string;
  body: string;
  mailtoUrl: string;
}

const MULTI_PART_SUFFIXES = new Set([
  "co.uk", "org.uk", "co.in", "org.in", "com.au", "co.nz", "co.za", "co.jp", "com.br",
]);

export function getPrivacyContactEmail(senderDomain: string): string {
  const cleanDomain = senderDomain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
  const parts = cleanDomain.split(".").filter(Boolean);
  if (parts.length < 2) return `privacy@${cleanDomain || "example.com"}`;

  const suffix = parts.slice(-2).join(".");
  const root = MULTI_PART_SUFFIXES.has(suffix) && parts.length >= 3
    ? parts.slice(-3).join(".")
    : parts.slice(-2).join(".");
  return `privacy@${root}`;
}

function regulationText(regulation: LegalErasureRegulation): string {
  if (regulation === "DPDP_INDIA") {
    return "I make this request under Section 12(1) and Section 12(3) of India's Digital Personal Data Protection Act, 2023 (DPDP Act), including withdrawal of consent, and Section 6(4), including my right to request erasure of personal data where applicable.";
  }
  if (regulation === "GDPR_EU") {
    return "I make this request under Article 17(1) of the EU General Data Protection Regulation (GDPR), requesting erasure of my personal data and exercising my right to be forgotten where applicable.";
  }
  return "I make this request under Section 12(1) and Section 12(3) of India's Digital Personal Data Protection Act, 2023 (DPDP Act), including withdrawal of consent, Section 6(4), and Article 17(1) of the EU General Data Protection Regulation (GDPR), including the right to erasure and to be forgotten where applicable.";
}

export function generateLegalErasureNotice(input: LegalErasureInput): LegalErasureNotice {
  const recipientEmail = getPrivacyContactEmail(input.senderDomain);
  const subject = `Formal request for erasure of personal data — ${input.serviceName}`;
  const proof = `Account relationship verified via mailbox header audit (First recorded communication: ${input.firstSeenDate || "N/A"}, Last recorded communication: ${input.lastSeenDate || "N/A"} from domain ${input.senderDomain}).`;
  const body = [
    `To: ${recipientEmail}`,
    "",
    `Dear ${input.serviceName} Privacy/Data Protection Team,`,
    "",
    `I am writing regarding the account associated with ${input.userEmail}.`,
    proof,
    "",
    regulationText(input.regulation),
    "",
    "Please erase all personal data associated with this account, including account profiles, identifiers, stored contact details, marketing records, and any other personal data retained beyond what is legally required. Please also stop direct marketing and revoke any active consent or optional processing associated with this account.",
    "",
    "If you must retain any information for a legal obligation, please identify the categories retained, the legal basis, and the retention period. Please confirm completion of this request within the applicable statutory period and provide a written response if further identity verification is required.",
    "",
    "Account email:",
    input.userEmail,
    "",
    "Regards,",
    input.userEmail,
  ].join("\n");

  const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return { recipientEmail, subject, body, mailtoUrl };
}
