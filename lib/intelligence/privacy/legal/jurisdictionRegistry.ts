import { type LegalRegulation } from "../privacyTypes";

export interface JurisdictionRule {
  regulation: LegalRegulation;
  name: string;
  territory: string;
  initialDeadlineDays: number;
  maxExtensionDays: number;
  isStatutoryCommenced: boolean;
  statutoryCommencementDate?: string;
  statutoryCitations: string[];
  legalNotes: string;
}

/**
 * Statutory jurisdiction parameters for privacy erasure requests.
 *
 * NOTE ON INDIA DPDP ACT 2023 STATUTORY ACCURACY:
 * Pursuant to the phased notification framework of Section 1(2) of the Digital Personal Data
 * Protection Act, 2023 (Act No. 22 of 2023) and Central Government Notification S.O. 4930(E)
 * dated November 13, 2025, Section 12 ("Right to Correction and Erasure of Personal Data")
 * has an appointed commencement date of May 13, 2027.
 *
 * Prior to May 13, 2027, notices citing the DPDP Act represent voluntary / informational
 * privacy requests, not immediately enforceable statutory mandates.
 */
export const JURISDICTION_RULES: Record<LegalRegulation, JurisdictionRule> = {
  GDPR_EU: {
    regulation: "GDPR_EU",
    name: "General Data Protection Regulation (EU GDPR)",
    territory: "European Economic Area (EEA)",
    initialDeadlineDays: 30, // 1 calendar month (Art. 12(3))
    maxExtensionDays: 60,    // +2 additional months for complex requests
    isStatutoryCommenced: true,
    statutoryCitations: [
      "GDPR Article 17(1) (Right to Erasure / Right to be Forgotten)",
      "GDPR Article 7(3) (Withdrawal of Consent)",
      "GDPR Article 12(3) (Statutory Response Deadline: 1 month)",
      "GDPR Article 12(3) (Permissible 2-month extension with notice)",
    ],
    legalNotes:
      "Statutory obligation in effect since May 25, 2018. Organizations must respond without undue delay and at the latest within one month. Can extend by two months for complexity if user is notified within the first month.",
  },

  UK_GDPR: {
    regulation: "UK_GDPR",
    name: "United Kingdom General Data Protection Regulation / DPA 2018",
    territory: "United Kingdom",
    initialDeadlineDays: 30,
    maxExtensionDays: 60,
    isStatutoryCommenced: true,
    statutoryCitations: [
      "UK GDPR Article 17(1) (Right to Erasure)",
      "Data Protection Act 2018 (DPA 2018)",
      "UK GDPR Article 12(3) (Statutory Response Deadline)",
    ],
    legalNotes:
      "Statutory obligation in effect under the Data Protection Act 2018 and UK GDPR following Brexit.",
  },

  CCPA_US: {
    regulation: "CCPA_US",
    name: "California Consumer Privacy Act / CPRA (Cal. Civ. Code § 1798.100+)",
    territory: "California, United States",
    initialDeadlineDays: 45, // 45 calendar days (Cal. Civ. Code § 1798.130(a)(2))
    maxExtensionDays: 45,    // +45 days when reasonably necessary
    isStatutoryCommenced: true,
    statutoryCitations: [
      "Cal. Civ. Code § 1798.105 (Right to Delete Personal Information)",
      "Cal. Civ. Code § 1798.120 (Right to Opt-Out of Sale or Sharing)",
      "Cal. Civ. Code § 1798.130(a)(2) (45-Day Response Timeline & 45-Day Extension)",
      "11 CCR § 7002 (Restrictions on Retention and Secondary Use)",
    ],
    legalNotes:
      "Enacted 2018; CPRA amendments fully operative since January 1, 2023. Businesses must verify and confirm deletion within 45 days, extendable by 45 days with written notice to consumer.",
  },

  DPDP_INDIA: {
    regulation: "DPDP_INDIA",
    name: "Digital Personal Data Protection Act, 2023 (Act No. 22 of 2023)",
    territory: "Republic of India",
    initialDeadlineDays: 30,
    maxExtensionDays: 30,
    isStatutoryCommenced: false, // Inactive until May 13, 2027
    statutoryCommencementDate: "2027-05-13",
    statutoryCitations: [
      "DPDP Act 2023 § 12(3) (Right to Erasure of Personal Data)",
      "DPDP Act 2023 § 6(4) (Right to Withdraw Consent)",
      "DPDP Act 2023 § 12(1) (Right to Summary of Personal Data)",
      "Notification S.O. 4930(E) dated Nov 13, 2025 (Section 12 commencement May 13, 2027)",
    ],
    legalNotes:
      "STATUTORY NOTICE: Under Ministry of Electronics and Information Technology (MeitY) Notification dated November 13, 2025, Section 12 commences on May 13, 2027. Deletion requests dispatched before May 13, 2027 operate as voluntary/informational privacy requests, not enforceable statutory orders under the DPDP Act.",
  },
};

/**
 * Checks whether the current date has reached or passed the commencement date.
 */
export function isRegulationCurrentlyEnforceable(
  regulation: LegalRegulation,
  asOfDate: Date = new Date()
): boolean {
  const rule = JURISDICTION_RULES[regulation];
  if (rule.isStatutoryCommenced) return true;
  if (!rule.statutoryCommencementDate) return false;

  const commencement = new Date(rule.statutoryCommencementDate);
  return asOfDate.getTime() >= commencement.getTime();
}
