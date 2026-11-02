import { type LegalRegulation } from "../privacyTypes";
import { JURISDICTION_RULES } from "./jurisdictionRegistry";
import { getPrivacyContactEmail } from "../../../legalErasure";

export interface GeneratedLegalNotice {
  recipientEmail: string;
  subject: string;
  body: string;
  mailtoUrl: string;
  regulation: LegalRegulation;
  deadlineDays: number;
  statutoryCitations: string[];
  jurisdictionNotes: string;
  isStatutoryEnforceable: boolean;
  statutoryCommencementDate?: string;
  disclaimer: string;
}

export class LegalTemplateGenerator {
  /**
   * Generates a legally accurate, editable erasure and deletion demand.
   */
  static generateNotice(params: {
    serviceName: string;
    senderDomain: string;
    userEmail: string;
    regulation: LegalRegulation;
    firstSeenDate?: string;
    lastSeenDate?: string;
  }): GeneratedLegalNotice {
    const rule = JURISDICTION_RULES[params.regulation];
    const recipientEmail = getPrivacyContactEmail(params.senderDomain);
    const dateFormatted = new Date().toISOString().split("T")[0];

    let regulationStatement = "";
    if (params.regulation === "GDPR_EU" || params.regulation === "UK_GDPR") {
      regulationStatement = `I make this formal request pursuant to Article 17(1) of the General Data Protection Regulation (GDPR / UK Data Protection Act 2018) ('Right to Erasure' / 'Right to be Forgotten'). Furthermore, pursuant to Article 7(3), I hereby withdraw any and all consents previously granted to your organization.`;
    } else if (params.regulation === "CCPA_US") {
      regulationStatement = `I make this formal verified consumer request pursuant to the California Consumer Privacy Act of 2018 as amended by the California Privacy Rights Act (Cal. Civ. Code § 1798.105). I demand that you permanently delete all personal information collected or maintained about me, and opt me out of any sale or sharing under Cal. Civ. Code § 1798.120.`;
    } else if (params.regulation === "DPDP_INDIA") {
      regulationStatement = `I submit this request under the Digital Personal Data Protection Act, 2023 (DPDP Act, Act No. 22 of 2023). Specifically, I exercise my Right to Correction and Erasure of Personal Data under Section 12(3) and withdraw all consents granted under Section 6(4). [Note: Enforcement of Section 12 is scheduled for May 13, 2027 under MeitY Gazette Notification S.O. 4930(E); this request constitutes a formal privacy assertion and voluntary deletion demand].`;
    }

    const activityContext =
      params.firstSeenDate || params.lastSeenDate
        ? `\nAccount Activity Context:\n- First Observed Communication: ${params.firstSeenDate ?? "Unspecified"}\n- Last Observed Communication: ${params.lastSeenDate ?? "Recent"}`
        : "";

    const subject = `Data Deletion and Erasure Request - ${params.serviceName} - [${params.userEmail}]`;

    const body = `To the Data Protection Officer / Privacy Compliance Team at ${params.serviceName}:

Date: ${dateFormatted}
Registered Email Address: ${params.userEmail}
Domain: ${params.senderDomain}${activityContext}

${regulationStatement}

Please proceed with the following actions without undue delay:
1. Permanently delete all personal data, behavioral profiles, account records, and associated telemetry relating to my email address (${params.userEmail}).
2. Instruct all third-party service providers, sub-processors, and affiliated advertising partners to likewise erase my personal data.
3. Confirm in writing to this email address when erasure has been completed, citing any statutory retention exemptions if applicable.

Under applicable statutory frameworks (${rule.name}), the mandated response timeline is ${rule.initialDeadlineDays} days from receipt.

Sincerely,
${params.userEmail}
(Authorized Account Holder)

--------------------------------------------------------------------------------
Statutory Authority & Legal Citations:
${rule.statutoryCitations.map((c) => `- ${c}`).join("\n")}
--------------------------------------------------------------------------------`;

    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);
    const mailtoUrl = `mailto:${recipientEmail}?subject=${encodedSubject}&body=${encodedBody}`;

    const disclaimer =
      "DISCLAIMER: This generated document is a standardized informational template and does not constitute formal legal counsel. You should review statutory exceptions (e.g., tax, anti-fraud, or legal hold obligations) before dispatch.";

    return {
      recipientEmail,
      subject,
      body,
      mailtoUrl,
      regulation: params.regulation,
      deadlineDays: rule.initialDeadlineDays,
      statutoryCitations: rule.statutoryCitations,
      jurisdictionNotes: rule.legalNotes,
      isStatutoryEnforceable: rule.isStatutoryCommenced,
      statutoryCommencementDate: rule.statutoryCommencementDate,
      disclaimer,
    };
  }
}
