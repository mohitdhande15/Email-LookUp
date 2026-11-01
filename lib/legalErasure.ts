export type LegalErasureRegulation =
  | "DPDP_INDIA"
  | "GDPR_EU"
  | "CCPA_US"
  | "COMBINED";

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
  statutoryDeadlineDays: number;
  legalCitations: string[];
  jurisdictionNotes: string;
  disclaimer: string;
}

const MULTI_PART_SUFFIXES = new Set([
  "co.uk", "org.uk", "me.uk", "ac.uk", "gov.uk",
  "co.in", "org.in", "net.in", "gov.in",
  "com.au", "net.au", "org.au",
  "co.nz", "net.nz",
  "co.za", "co.jp", "com.br", "com.sg", "com.mx",
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
  const root =
    MULTI_PART_SUFFIXES.has(suffix) && parts.length >= 3
      ? parts.slice(-3).join(".")
      : parts.slice(-2).join(".");
  return `privacy@${root}`;
}

interface RegulationDetails {
  text: string;
  citations: string[];
  deadlineDays: number;
  jurisdictionNotes: string;
}

function getRegulationDetails(regulation: LegalErasureRegulation): RegulationDetails {
  switch (regulation) {
    case "DPDP_INDIA":
      return {
        text: "I make this formal request under India's Digital Personal Data Protection Act, 2023 (DPDP Act, Act No. 22 of 2023). Specifically, I exercise my Right to Erasure of Personal Data under Section 12(3) and withdraw any and all consents previously granted under Section 6(4). Note: Provisions of the DPDP Act take effect subject to phased notifications and appointed dates by the Central Government under Section 1(2).",
        citations: [
          "DPDP Act 2023 § 12(3) (Right to Erasure)",
          "DPDP Act 2023 § 6(4) (Withdrawal of Consent)",
          "DPDP Act 2023 § 12(1) (Right to Summary of Processing)",
        ],
        deadlineDays: 30,
        jurisdictionNotes:
          "Enacted August 11, 2023. Substantive enforcement subject to central government gazette notification of appointed dates and rules under Section 1(2).",
      };

    case "GDPR_EU":
      return {
        text: "I make this formal request pursuant to Article 17(1) of the General Data Protection Regulation (Regulation (EU) 2016/679 - GDPR) / UK GDPR ('Right to Erasure' / 'Right to be Forgotten'), and withdraw any processing consent pursuant to Article 7(3).",
        citations: [
          "GDPR Article 17(1) (Right to Erasure)",
          "GDPR Article 7(3) (Withdrawal of Consent)",
          "GDPR Article 12(3) (Statutory Response Deadline)",
        ],
        deadlineDays: 30,
        jurisdictionNotes:
          "In full effect since May 25, 2018 across EEA and United Kingdom under UK Data Protection Act 2018.",
      };

    case "CCPA_US":
      return {
        text: "I make this formal request pursuant to the California Consumer Privacy Act of 2018 as amended by the California Privacy Rights Act (CCPA/CPRA, Cal. Civ. Code § 1798.105), requesting that you delete all personal information collected about me, and opt me out of any sale or sharing under § 1798.120.",
        citations: [
          "Cal. Civ. Code § 1798.105 (Right to Delete)",
          "Cal. Civ. Code § 1798.120 (Right to Opt-Out)",
          "Cal. Civ. Code § 1798.130 (Response Timeline)",
        ],
        deadlineDays: 45,
        jurisdictionNotes:
          "Enacted 2018; CPRA amendments fully operative January 1, 2023.",
      };

    case "COMBINED":
    default:
      return {
        text: "I make this formal request exercising my statutory rights under applicable privacy legislation, including: (1) Article 17(1) of the General Data Protection Regulation (GDPR / UK GDPR); (2) Section 12(3) and Section 6(4) of India's Digital Personal Data Protection Act, 2023 (DPDP Act, subject to appointed commencement dates under § 1(2)); and (3) California Civil Code § 1798.105 (CCPA/CPRA).",
        citations: [
          "GDPR Art. 17 (Right to Erasure)",
          "India DPDP Act 2023 § 12(3) & § 6(4)",
          "Cal. Civ. Code § 1798.105 (CCPA/CPRA)",
        ],
        deadlineDays: 30,
        jurisdictionNotes:
          "Harmonized multi-jurisdiction draft invoking applicable international privacy rights.",
      };
  }
}

export function generateLegalErasureNotice(input: LegalErasureInput): LegalErasureNotice {
  const recipientEmail = getPrivacyContactEmail(input.senderDomain);
  const details = getRegulationDetails(input.regulation);
  const subject = `Formal Data Subject Erasure Request — ${input.serviceName}`;
  const disclaimer =
    "This communication is a draft prepared by Email-LookUp based on mailbox headers. It is not formal legal counsel. Users should verify details before sending.";

  const proof = `Audited communication: First recorded message: ${input.firstSeenDate || "Unknown"}, Last recorded message: ${input.lastSeenDate || "Unknown"} from sender domain ${input.senderDomain}.`;

  const body = [
    `To: Data Protection Officer / Privacy Team <${recipientEmail}>`,
    "",
    `RE: Formal Request for Erasure of Personal Data — Account: ${input.userEmail}`,
    "",
    `Dear ${input.serviceName} Privacy / Compliance Team,`,
    "",
    `I am the owner of the account registered with the email address ${input.userEmail}.`,
    proof,
    "",
    details.text,
    "",
    "INSTRUCTIONS:",
    "1. Erase all personal data associated with my account, profile, identifiers, contact information, browsing/usage telemetry, and transactional metadata, except where specific legal retention mandates apply.",
    "2. Cease all marketing, promotional communications, and data sharing or processing immediately.",
    "3. Notify any third-party processors, sub-processors, or affiliates to whom you have disclosed my personal data to erase the same.",
    `4. If you must retain any personal data under a statutory duty, please specify the exact legal basis, the specific categories of data retained, and the designated retention period.`,
    `5. Confirm completion of this request within the statutory deadline (${details.deadlineDays} calendar days) to ${input.userEmail}.`,
    "",
    "If additional verification of identity is required, please provide your standard verification procedure promptly in writing.",
    "",
    "Sincerely,",
    input.userEmail,
  ].join("\n");

  const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;

  return {
    recipientEmail,
    subject,
    body,
    mailtoUrl,
    statutoryDeadlineDays: details.deadlineDays,
    legalCitations: details.citations,
    jurisdictionNotes: details.jurisdictionNotes,
    disclaimer,
  };
}
