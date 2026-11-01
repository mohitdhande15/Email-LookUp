import { type SourceResult } from "../../sources/types";
import { type BreachEntry } from "../../sources/breach";
import {
  type UnifiedFinding,
  createUnifiedFinding,
} from "../core/finding";
import {
  type IntelligenceEntity,
  createIntelligenceEntity,
} from "../core/entity";
import {
  type IntelligenceRelationship,
  createIntelligenceRelationship,
} from "../core/relationship";
import {
  type EvidenceItem,
  createEvidenceItem,
} from "../core/evidence";
import { evaluateConfidence } from "../core/confidence";

export interface IntelligenceProcessingResult {
  rootIdentity: IntelligenceEntity;
  entities: IntelligenceEntity[];
  relationships: IntelligenceRelationship[];
  findings: UnifiedFinding[];
  evidence: EvidenceItem[];
}

export class IdentityEngine {
  /**
   * Adapts real OSINT source results into the unified intelligence model.
   */
  processPublicSources(
    userId: string,
    email: string,
    sourceResults: SourceResult[]
  ): IntelligenceProcessingResult {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Root Email Identity Entity
    const rootConfidence = evaluateConfidence({
      reliability: "AUTHORITATIVE",
      evidenceCount: 1,
      isCryptographicOrDirect: true,
    });

    const rootIdentity = createIntelligenceEntity({
      userId,
      type: "EMAIL_IDENTITY",
      primaryValue: cleanEmail,
      displayName: cleanEmail,
      confidence: rootConfidence,
    });

    const entities: IntelligenceEntity[] = [rootIdentity];
    const relationships: IntelligenceRelationship[] = [];
    const findings: UnifiedFinding[] = [];
    const evidenceList: EvidenceItem[] = [];

    for (const res of sourceResults) {
      if (res.status !== "found" || !res.data) continue;

      // ── Process Gravatar ──────────────────────────────────────────
      if (res.source === "gravatar") {
        const d = res.data;
        const confidence = evaluateConfidence({
          reliability: "RELIABLE",
          evidenceCount: 1,
          isCryptographicOrDirect: true,
        });

        const ev = createEvidenceItem({
          userId,
          source: "gravatar_api",
          type: "PUBLIC_PROFILE",
          reliability: "RELIABLE",
          summary: `Public Gravatar avatar and profile metadata detected for hash.`,
          rawPayloadToFingerprint: JSON.stringify(d),
          sourceUrl: typeof d.profileUrl === "string" ? d.profileUrl : undefined,
          sanitizedSnippet: `Name: ${d.name ?? "None"}, Accounts: ${Array.isArray(d.verifiedAccounts) ? d.verifiedAccounts.length : 0}`,
        });
        evidenceList.push(ev);

        const profileEntity = createIntelligenceEntity({
          userId,
          type: "PERSON_PROFILE",
          primaryValue: typeof d.profileUrl === "string" ? d.profileUrl : `gravatar:${cleanEmail}`,
          displayName: typeof d.name === "string" && d.name ? d.name : "Gravatar Profile",
          attributes: {
            avatarUrl: d.avatarUrl,
            jobTitle: d.jobTitle,
            location: d.location,
          },
          confidence,
        });
        entities.push(profileEntity);

        const rel = createIntelligenceRelationship({
          userId,
          sourceEntityId: rootIdentity.id,
          targetEntityId: profileEntity.id,
          type: "ASSOCIATED_WITH",
          source: "gravatar",
          evidenceIds: [ev.id],
          confidence,
        });
        relationships.push(rel);

        const finding = createUnifiedFinding({
          userId,
          category: "IDENTITY",
          subcategory: "PUBLIC_GRAVATAR_PROFILE",
          title: `Public Gravatar Profile: ${profileEntity.displayName}`,
          description: `Public avatar and profile data associated with ${cleanEmail} was discovered on Gravatar.`,
          source: "gravatar",
          sourceReference: typeof d.profileUrl === "string" ? d.profileUrl : undefined,
          confidence,
          severity: "INFO",
          evidence: [ev],
          relatedEntityIds: [rootIdentity.id, profileEntity.id],
          payload: {
            category: "IDENTITY",
            email: cleanEmail,
            platformName: "Gravatar",
            associatedProfileUrl: typeof d.profileUrl === "string" ? d.profileUrl : undefined,
            avatarUrl: typeof d.avatarUrl === "string" ? d.avatarUrl : undefined,
          },
          recommendedActions: [
            {
              id: "act_gravatar_review",
              type: "INFORMATIONAL",
              label: "Review Public Gravatar Profile",
              description: "Ensure your public profile photo and job details are intended for public view.",
              actionUrl: typeof d.profileUrl === "string" ? d.profileUrl : "https://gravatar.com",
              priority: "OPTIONAL",
            },
          ],
        });
        findings.push(finding);
      }

      // ── Process GitHub ────────────────────────────────────────────
      if (res.source === "github") {
        const d = res.data;
        const confidence = evaluateConfidence({
          reliability: "AUTHORITATIVE",
          evidenceCount: 1,
          isCryptographicOrDirect: true,
        });

        const ev = createEvidenceItem({
          userId,
          source: "github_api",
          type: "PUBLIC_PROFILE",
          reliability: "AUTHORITATIVE",
          summary: `Public GitHub developer profile discovered matching email address.`,
          rawPayloadToFingerprint: JSON.stringify(d),
          sourceUrl: typeof d.profileUrl === "string" ? d.profileUrl : undefined,
          sanitizedSnippet: `Login: ${d.login ?? "Unknown"}, Repos: ${d.publicRepos ?? 0}, Followers: ${d.followers ?? 0}`,
        });
        evidenceList.push(ev);

        const ghEntity = createIntelligenceEntity({
          userId,
          type: "PERSON_PROFILE",
          primaryValue: typeof d.profileUrl === "string" ? d.profileUrl : `github:${d.login}`,
          displayName: typeof d.name === "string" && d.name ? d.name : String(d.login ?? "GitHub User"),
          attributes: {
            login: d.login,
            publicRepos: d.publicRepos,
            bio: d.bio,
            company: d.company,
            avatarUrl: d.avatarUrl,
          },
          confidence,
        });
        entities.push(ghEntity);

        const rel = createIntelligenceRelationship({
          userId,
          sourceEntityId: rootIdentity.id,
          targetEntityId: ghEntity.id,
          type: "ASSOCIATED_WITH",
          source: "github",
          evidenceIds: [ev.id],
          confidence,
        });
        relationships.push(rel);

        const finding = createUnifiedFinding({
          userId,
          category: "IDENTITY",
          subcategory: "PUBLIC_GITHUB_PROFILE",
          title: `Public Developer Profile: GitHub (${d.login})`,
          description: `Email address is publicly indexed on GitHub under account @${d.login}.`,
          source: "github",
          sourceReference: typeof d.profileUrl === "string" ? d.profileUrl : undefined,
          confidence,
          severity: "LOW",
          evidence: [ev],
          relatedEntityIds: [rootIdentity.id, ghEntity.id],
          payload: {
            category: "IDENTITY",
            email: cleanEmail,
            platformName: "GitHub",
            username: typeof d.login === "string" ? d.login : undefined,
            associatedProfileUrl: typeof d.profileUrl === "string" ? d.profileUrl : undefined,
            publicRepoCount: typeof d.publicRepos === "number" ? d.publicRepos : undefined,
          },
          recommendedActions: [
            {
              id: "act_github_email_privacy",
              type: "REVIEW_PERMISSIONS",
              label: "Configure GitHub Email Privacy",
              description: "Consider keeping your primary email private in GitHub settings to prevent scraping.",
              actionUrl: "https://github.com/settings/emails",
              priority: "RECOMMENDED",
            },
          ],
        });
        findings.push(finding);
      }

      // ── Process XposedOrNot Breaches ──────────────────────────────
      if (res.source === "breach") {
        const d = res.data;
        const breachEntries: BreachEntry[] = Array.isArray(d.breaches) ? d.breaches : [];

        for (const b of breachEntries) {
          const confidence = evaluateConfidence({
            reliability: "RELIABLE",
            evidenceCount: 1,
            isCryptographicOrDirect: false,
          });

          const ev = createEvidenceItem({
            userId,
            source: "xposedornot_api",
            type: "OSINT_RECORD",
            reliability: "RELIABLE",
            summary: `Record in verified data breach: ${b.name} (${b.date ?? "Date unrecorded"}).`,
            rawPayloadToFingerprint: JSON.stringify(b),
            sanitizedSnippet: `Breach: ${b.name}, Data classes: ${(b.xposedData ?? []).join(", ") || "Unspecified"}`,
          });
          evidenceList.push(ev);

          const breachEntity = createIntelligenceEntity({
            userId,
            type: "DATA_BREACH",
            primaryValue: `breach:${b.name.toLowerCase()}`,
            displayName: b.name,
            attributes: {
              breachDate: b.date,
              industry: b.industry,
              exposedData: b.xposedData,
            },
            confidence,
          });
          entities.push(breachEntity);

          const rel = createIntelligenceRelationship({
            userId,
            sourceEntityId: rootIdentity.id,
            targetEntityId: breachEntity.id,
            type: "EXPOSED_IN",
            source: "xposedornot",
            evidenceIds: [ev.id],
            confidence,
          });
          relationships.push(rel);

          const finding = createUnifiedFinding({
            userId,
            category: "SECURITY",
            subcategory: "DATA_BREACH_EXPOSURE",
            title: `Exposed in Data Breach: ${b.name}`,
            description: `Email address was exposed in the historical ${b.name} breach (${b.date ?? "Historical"}). Exposed data classes: ${(b.xposedData ?? []).join(", ") || "Account credentials"}.`,
            source: "xposedornot",
            eventAt: b.date,
            confidence,
            severity: "HIGH",
            evidence: [ev],
            relatedEntityIds: [rootIdentity.id, breachEntity.id],
            payload: {
              category: "SECURITY",
              serviceName: b.name,
              eventType: "BREACH_EXPOSURE",
              eventDate: b.date,
              compromisedDataClasses: b.xposedData,
              breachName: b.name,
              isRemediationConfirmedByUser: false,
            },
            recommendedActions: [
              {
                id: `act_rotate_${b.name}`,
                type: "ROTATE_CREDENTIALS",
                label: `Rotate password on ${b.name}`,
                description: "Immediately rotate credentials and enable MFA if you had an account on this service.",
                priority: "IMMEDIATE",
              },
            ],
          });
          findings.push(finding);
        }
      }
    }

    return {
      rootIdentity,
      entities,
      relationships,
      findings,
      evidence: evidenceList,
    };
  }
}

export const defaultIdentityEngine = new IdentityEngine();
