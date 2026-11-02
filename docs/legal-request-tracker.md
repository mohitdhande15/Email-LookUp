# Statutory Legal Erasure Request Tracker

## Purpose

When digital services do not offer direct self-service account deletion, consumers must rely on statutory data protection rights to compel organizations to purge their personal data.

Email-LookUp provides a statutory tracking engine (`lib/intelligence/privacy/legal/`) that manages deadlines, extension notices, statutory citations, and legal notice generation.

---

## Supported Statutory Frameworks

### 1. General Data Protection Regulation (EU GDPR / UK GDPR)
- **Primary Statutory Basis**: Article 17(1) ("Right to Erasure" / "Right to be Forgotten") & Article 7(3) ("Withdrawal of Consent").
- **Statutory Response Window**: Article 12(3) mandates response "without undue delay and at the latest within one month" (standardized to **30 calendar days**).
- **Extension Allowance**: Article 12(3) permits an extension of up to **2 additional months** (60 days) where necessary, taking into account complexity and number of requests. The controller must notify the data subject of the extension within the initial month, stating reasons for delay.
- **Enforceability**: Fully active across EEA and United Kingdom.

### 2. California Consumer Privacy Act / CPRA (Cal. Civ. Code § 1798.100 et seq.)
- **Primary Statutory Basis**: Cal. Civ. Code § 1798.105 ("Consumer Right to Delete") & § 1798.120 ("Opt-Out of Sale / Sharing").
- **Statutory Response Window**: Cal. Civ. Code § 1798.130(a)(2) mandates response within **45 calendar days**.
- **Extension Allowance**: Extendable by an additional **45 calendar days** when reasonably necessary, provided written notice of the extension is delivered to the consumer within the initial 45-day period explaining why an extension is required.
- **Enforceability**: Fully active across California.

### 3. India Digital Personal Data Protection Act, 2023 (Act No. 22 of 2023)
- **Statutory Authority**: Section 12(3) ("Right to Correction and Erasure of Personal Data") & Section 6(4) ("Withdrawal of Consent").
- **STATUTORY ACCURACY ADVISORY**:
  - Under Section 1(2) of the DPDP Act 2023 and Ministry of Electronics and Information Technology (MeitY) Notification S.O. 4930(E) dated November 13, 2025, Section 12 has an appointed commencement date of **May 13, 2027**.
  - Requests generated and dispatched prior to May 13, 2027 operate as **voluntary / informational privacy demands**, not enforceable statutory mandates.
  - The tracker accurately sets `isStatutoryCommenced: false` for all requests originating prior to May 13, 2027, preventing misleading legal assertions.

---

## Urgency Tiers & Deadline Calculation

The engine continuously calculates statutory status:

```typescript
const diffMs = effectiveDeadline.getTime() - asOfDate.getTime();
const daysRemaining = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
```

Urgency classification:
- `COMPLETED`: User confirmed successful deletion or response.
- `CRITICAL`: Days remaining ≤ 3 days.
- `HIGH`: Days remaining ≤ 7 days.
- `NORMAL`: Days remaining > 7 days.
- `EXPIRED` / `OVERDUE`: Days remaining < 0 and status is not `COMPLETED`.

---

## Disclaimers & Regulatory Notices

All generated notices include a clear disclaimer stating that generated materials constitute standardized informational correspondence and do not substitute for licensed legal representation. Users are advised to review mandatory record-retention exceptions (tax, accounting, fraud prevention, legal hold) prior to delivery.
