import { type SubscriptionCategory } from "./financialTypes";

interface KnownMerchantRule {
  domainPatterns: RegExp[];
  displayNamePatterns?: RegExp[];
  canonicalName: string;
  canonicalDomain: string;
  category: SubscriptionCategory;
  defaultCancellationUrl?: string;
}

const KNOWN_MERCHANT_REGISTRY: KnownMerchantRule[] = [
  // ── AWS vs Amazon Separation (Check specific AWS / Prime rules first) ──
  {
    domainPatterns: [/(?:^|\.)aws\.amazon\.com$/i, /(?:^|\.)amazonaws\.com$/i],
    canonicalName: "Amazon Web Services",
    canonicalDomain: "aws.amazon.com",
    category: "SAAS",
    defaultCancellationUrl: "https://console.aws.amazon.com/billing",
  },
  {
    domainPatterns: [/(?:^|\.)amazon\.(?:com|in|co\.uk|de|ca)$/i],
    displayNamePatterns: [/aws/i, /amazon web services/i],
    canonicalName: "Amazon Web Services",
    canonicalDomain: "aws.amazon.com",
    category: "SAAS",
    defaultCancellationUrl: "https://console.aws.amazon.com/billing",
  },
  {
    domainPatterns: [/(?:^|\.)primevideo\.com$/i],
    canonicalName: "Amazon Prime Video",
    canonicalDomain: "primevideo.com",
    category: "STREAMING",
    defaultCancellationUrl: "https://www.primevideo.com/settings",
  },
  {
    domainPatterns: [/(?:^|\.)amazon\.(?:com|in|co\.uk|de|ca)$/i],
    displayNamePatterns: [/prime/i, /amazon prime/i],
    canonicalName: "Amazon Prime",
    canonicalDomain: "amazon.com",
    category: "MEMBERSHIP",
    defaultCancellationUrl: "https://www.amazon.com/mc/manage",
  },

  // ── SaaS & Developer Platforms ────────────────────────────────────
  {
    domainPatterns: [/(?:^|\.)openai\.com$/i],
    canonicalName: "OpenAI",
    canonicalDomain: "openai.com",
    category: "SAAS",
    defaultCancellationUrl: "https://chat.openai.com/#settings",
  },
  {
    domainPatterns: [/(?:^|\.)github\.com$/i],
    canonicalName: "GitHub",
    canonicalDomain: "github.com",
    category: "SAAS",
    defaultCancellationUrl: "https://github.com/settings/billing",
  },
  {
    domainPatterns: [/(?:^|\.)vercel\.com$/i],
    canonicalName: "Vercel",
    canonicalDomain: "vercel.com",
    category: "SAAS",
    defaultCancellationUrl: "https://vercel.com/dashboard/billing",
  },
  {
    domainPatterns: [/(?:^|\.)notion\.so$/i],
    canonicalName: "Notion",
    canonicalDomain: "notion.so",
    category: "SAAS",
    defaultCancellationUrl: "https://www.notion.so/settings/billing",
  },
  {
    domainPatterns: [/(?:^|\.)figma\.com$/i],
    canonicalName: "Figma",
    canonicalDomain: "figma.com",
    category: "SAAS",
    defaultCancellationUrl: "https://www.figma.com/settings",
  },
  {
    domainPatterns: [/(?:^|\.)slack\.com$/i],
    canonicalName: "Slack",
    canonicalDomain: "slack.com",
    category: "SAAS",
    defaultCancellationUrl: "https://my.slack.com/admin/billing",
  },
  {
    domainPatterns: [/(?:^|\.)digitalocean\.com$/i],
    canonicalName: "DigitalOcean",
    canonicalDomain: "digitalocean.com",
    category: "SAAS",
    defaultCancellationUrl: "https://cloud.digitalocean.com/billing",
  },
  {
    domainPatterns: [/(?:^|\.)linear\.app$/i],
    canonicalName: "Linear",
    canonicalDomain: "linear.app",
    category: "SAAS",
    defaultCancellationUrl: "https://linear.app/settings/billing",
  },
  {
    domainPatterns: [/(?:^|\.)atlassian\.com$/i, /(?:^|\.)jira\.com$/i],
    canonicalName: "Atlassian",
    canonicalDomain: "atlassian.com",
    category: "SAAS",
    defaultCancellationUrl: "https://admin.atlassian.com/billing",
  },
  {
    domainPatterns: [/(?:^|\.)adobe\.com$/i],
    canonicalName: "Adobe Creative Cloud",
    canonicalDomain: "adobe.com",
    category: "SAAS",
    defaultCancellationUrl: "https://account.adobe.com/plans",
  },
  {
    domainPatterns: [/(?:^|\.)zoom\.us$/i],
    canonicalName: "Zoom",
    canonicalDomain: "zoom.us",
    category: "SAAS",
    defaultCancellationUrl: "https://zoom.us/billing",
  },

  // ── Streaming Services ────────────────────────────────────────────
  {
    domainPatterns: [/(?:^|\.)netflix\.com$/i],
    canonicalName: "Netflix",
    canonicalDomain: "netflix.com",
    category: "STREAMING",
    defaultCancellationUrl: "https://www.netflix.com/youraccount",
  },
  {
    domainPatterns: [/(?:^|\.)spotify\.com$/i],
    canonicalName: "Spotify",
    canonicalDomain: "spotify.com",
    category: "STREAMING",
    defaultCancellationUrl: "https://www.spotify.com/account/subscription/",
  },
  {
    domainPatterns: [/(?:^|\.)hotstar\.com$/i],
    canonicalName: "Disney+ Hotstar",
    canonicalDomain: "hotstar.com",
    category: "STREAMING",
    defaultCancellationUrl: "https://www.hotstar.com/my-account",
  },
  {
    domainPatterns: [/(?:^|\.)disneyplus\.com$/i],
    canonicalName: "Disney+",
    canonicalDomain: "disneyplus.com",
    category: "STREAMING",
    defaultCancellationUrl: "https://www.disneyplus.com/account",
  },
  {
    domainPatterns: [/(?:^|\.)youtube\.com$/i],
    canonicalName: "YouTube Premium",
    canonicalDomain: "youtube.com",
    category: "STREAMING",
    defaultCancellationUrl: "https://www.youtube.com/paid_memberships",
  },

  // ── Cloud Storage & OS Services ───────────────────────────────────
  {
    domainPatterns: [/(?:^|\.)dropbox\.com$/i],
    canonicalName: "Dropbox",
    canonicalDomain: "dropbox.com",
    category: "CLOUD_STORAGE",
    defaultCancellationUrl: "https://www.dropbox.com/account/plan",
  },
  {
    domainPatterns: [/(?:^|\.)google\.com$/i],
    displayNamePatterns: [/google one/i],
    canonicalName: "Google One",
    canonicalDomain: "one.google.com",
    category: "CLOUD_STORAGE",
    defaultCancellationUrl: "https://one.google.com/settings",
  },
  {
    domainPatterns: [/(?:^|\.)google\.com$/i],
    displayNamePatterns: [/google workspace/i],
    canonicalName: "Google Workspace",
    canonicalDomain: "workspace.google.com",
    category: "SAAS",
    defaultCancellationUrl: "https://admin.google.com/Billing",
  },
  {
    domainPatterns: [/(?:^|\.)google\.com$/i],
    displayNamePatterns: [/google play/i],
    canonicalName: "Google Play",
    canonicalDomain: "play.google.com",
    category: "SERVICES",
    defaultCancellationUrl: "https://play.google.com/store/account/subscriptions",
  },
  {
    domainPatterns: [/(?:^|\.)apple\.com$/i],
    canonicalName: "Apple Services",
    canonicalDomain: "apple.com",
    category: "SERVICES",
    defaultCancellationUrl: "https://support.apple.com/HT202039",
  },

  // ── Software Licenses ─────────────────────────────────────────────
  {
    domainPatterns: [/(?:^|\.)jetbrains\.com$/i],
    canonicalName: "JetBrains",
    canonicalDomain: "jetbrains.com",
    category: "SOFTWARE_LICENSE",
    defaultCancellationUrl: "https://account.jetbrains.com/licenses",
  },
  {
    domainPatterns: [/(?:^|\.)1password\.com$/i],
    canonicalName: "1Password",
    canonicalDomain: "1password.com",
    category: "SOFTWARE_LICENSE",
    defaultCancellationUrl: "https://my.1password.com/billing",
  },
  {
    domainPatterns: [/(?:^|\.)microsoft\.com$/i],
    canonicalName: "Microsoft 365",
    canonicalDomain: "microsoft.com",
    category: "SOFTWARE_LICENSE",
    defaultCancellationUrl: "https://account.microsoft.com/services",
  },

  // ── Memberships & Learning ────────────────────────────────────────
  {
    domainPatterns: [/(?:^|\.)linkedin\.com$/i],
    canonicalName: "LinkedIn Premium",
    canonicalDomain: "linkedin.com",
    category: "MEMBERSHIP",
    defaultCancellationUrl: "https://www.linkedin.com/premium/cancel",
  },
  {
    domainPatterns: [/(?:^|\.)medium\.com$/i],
    canonicalName: "Medium",
    canonicalDomain: "medium.com",
    category: "MEMBERSHIP",
    defaultCancellationUrl: "https://medium.com/me/settings/membership",
  },
  {
    domainPatterns: [/(?:^|\.)coursera\.org$/i],
    canonicalName: "Coursera",
    canonicalDomain: "coursera.org",
    category: "MEMBERSHIP",
    defaultCancellationUrl: "https://www.coursera.org/my-purchases",
  },
];

// Domains that are generic notification relays and should NOT be used as the merchant name
const GENERIC_RELAY_DOMAINS = new Set([
  "mailchimp.com",
  "sendgrid.net",
  "shopify.com",
  "substack.com",
  "mandrillapp.com",
  "postmarkapp.com",
  "constantcontact.com",
  "hubspot.com",
]);

export interface NormalizedMerchantResult {
  canonicalName: string;
  canonicalDomain: string;
  category: SubscriptionCategory;
  isKnownSubscriptionMerchant: boolean;
  defaultCancellationUrl?: string;
}

export class MerchantNormalizer {
  /**
   * Normalizes sender domain and display name to a clean, canonical merchant identity.
   */
  static normalize(
    senderDomain: string,
    displayName?: string
  ): NormalizedMerchantResult {
    let cleanDomain = (senderDomain || "").toLowerCase().trim();
    if (cleanDomain.includes("@")) {
      cleanDomain = cleanDomain.split("@")[1].trim();
    }
    cleanDomain = cleanDomain.replace(/[<>]/g, "").trim();

    const cleanDisplay = (displayName || "").trim();

    // 1. Check known registry
    for (const rule of KNOWN_MERCHANT_REGISTRY) {
      const domainMatches = rule.domainPatterns.some((pattern) =>
        pattern.test(cleanDomain)
      );

      if (domainMatches) {
        if (rule.displayNamePatterns && rule.displayNamePatterns.length > 0) {
          const displayMatches = rule.displayNamePatterns.some((pattern) =>
            pattern.test(cleanDisplay)
          );
          if (displayMatches) {
            return {
              canonicalName: rule.canonicalName,
              canonicalDomain: rule.canonicalDomain,
              category: rule.category,
              isKnownSubscriptionMerchant: true,
              defaultCancellationUrl: rule.defaultCancellationUrl,
            };
          }
        } else {
          return {
            canonicalName: rule.canonicalName,
            canonicalDomain: rule.canonicalDomain,
            category: rule.category,
            isKnownSubscriptionMerchant: true,
            defaultCancellationUrl: rule.defaultCancellationUrl,
          };
        }
      }
    }

    // 2. Disambiguate generic relays (e.g. mailer@shopify.com)
    if (GENERIC_RELAY_DOMAINS.has(cleanDomain)) {
      if (cleanDisplay && cleanDisplay.length > 1) {
        return {
          canonicalName: cleanDisplay,
          canonicalDomain: cleanDomain,
          category: "UNKNOWN",
          isKnownSubscriptionMerchant: false,
        };
      }
    }

    // 3. Fallback: If cleanDisplay is informative, use it
    if (
      cleanDisplay &&
      cleanDisplay.length > 1 &&
      !/^(?:no-?reply|support|billing|info|mailer|notifications?)$/i.test(cleanDisplay)
    ) {
      return {
        canonicalName: cleanDisplay,
        canonicalDomain: cleanDomain,
        category: "UNKNOWN",
        isKnownSubscriptionMerchant: false,
      };
    }

    // Fallback to capitalizing first segment of clean domain (e.g. "customtool.io" -> "Customtool")
    const domainPrefix = cleanDomain.split(".")[0];
    const capitalized = domainPrefix.charAt(0).toUpperCase() + domainPrefix.slice(1);

    return {
      canonicalName: capitalized,
      canonicalDomain: cleanDomain,
      category: "UNKNOWN",
      isKnownSubscriptionMerchant: false,
    };
  }
}
