import { isDomainInDeleteLinks, getDeleteHelpUrl } from "../../../deleteLinks";
import { type DeletionDifficultyRating } from "../privacyTypes";

/**
 * Known platforms and their verified deletion difficulties.
 */
const KNOWN_DIFFICULTIES: Record<string, DeletionDifficultyRating> = {
  // Easy: Direct in-app button with immediate or simple confirmation
  "github.com": "EASY",
  "reddit.com": "EASY",
  "dropbox.com": "EASY",
  "gitlab.com": "EASY",
  "spokeo.com": "EASY",
  "fastpeoplesearch.com": "EASY",
  "medium.com": "EASY",
  "quora.com": "EASY",
  "canva.com": "EASY",

  // Moderate: Multi-step process, email confirmation, or 14-30 day deactivation waiting period
  "spotify.com": "MODERATE",
  "netflix.com": "MODERATE",
  "x.com": "MODERATE",
  "twitter.com": "MODERATE",
  "linkedin.com": "MODERATE",
  "instagram.com": "MODERATE",
  "facebook.com": "MODERATE",
  "airbnb.com": "MODERATE",
  "notion.so": "MODERATE",
  "duolingo.com": "MODERATE",
  "ebay.com": "MODERATE",
  "paypal.com": "MODERATE",
  "strava.com": "MODERATE",
  "grammarly.com": "MODERATE",
  "discord.com": "MODERATE",
  "whitepages.com": "MODERATE",
  "radaris.com": "MODERATE",
  "beenverified.com": "MODERATE",
  "acxiom.com": "MODERATE",

  // Difficult: Manual ticket, postal submission, identity verification friction, or retention holds
  "lexisnexis.com": "DIFFICULT",
  "experian.com": "DIFFICULT",
  "wsj.com": "DIFFICULT",
  "nytimes.com": "DIFFICULT",
  "steampowered.com": "DIFFICULT",
  "apple.com": "DIFFICULT",
  "adobe.com": "DIFFICULT",
};

export class DeletionDifficultyEvaluator {
  /**
   * Assesses the difficulty rating for deleting an account on a given domain.
   */
  static evaluateDifficulty(domain: string): {
    rating: DeletionDifficultyRating;
    deleteUrl?: string;
    hasDirectLink: boolean;
    explanation: string;
  } {
    const cleanDomain = domain.toLowerCase().trim().replace(/^www\./, "");
    const baseDomain = cleanDomain.split(".").slice(-2).join(".");

    const known = KNOWN_DIFFICULTIES[cleanDomain] || KNOWN_DIFFICULTIES[baseDomain];
    const hasDirectLink = isDomainInDeleteLinks(cleanDomain) || isDomainInDeleteLinks(baseDomain);
    const deleteUrl = getDeleteHelpUrl(cleanDomain);

    if (known) {
      let explanation = "";
      switch (known) {
        case "EASY":
          explanation = "Self-service online deletion with immediate or standard email verification.";
          break;
        case "MODERATE":
          explanation = "Multi-step settings workflow, 14-30 day retention period, or SMS verification required.";
          break;
        case "DIFFICULT":
          explanation = "Requires contacting support, submitting government ID, or navigating retention obstacles.";
          break;
        default:
          explanation = "Unspecified deletion difficulty.";
      }
      return { rating: known, deleteUrl, hasDirectLink, explanation };
    }

    if (hasDirectLink) {
      return {
        rating: "MODERATE",
        deleteUrl,
        hasDirectLink: true,
        explanation: "Verified direct deletion instructions available in knowledge base.",
      };
    }

    return {
      rating: "UNKNOWN",
      deleteUrl,
      hasDirectLink: false,
      explanation: "No verified deletion workflow in directory; manual inquiry or search required.",
    };
  }
}
