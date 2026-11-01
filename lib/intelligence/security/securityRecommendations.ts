interface OfficialSecurityRegistryEntry {
  domainPatterns: RegExp[];
  serviceName: string;
  securityUrl: string;
}

const OFFICIAL_SECURITY_REGISTRY: OfficialSecurityRegistryEntry[] = [
  {
    domainPatterns: [/(?:^|\.)google\.com$/i, /(?:^|\.)gmail\.com$/i],
    serviceName: "Google",
    securityUrl: "https://myaccount.google.com/security",
  },
  {
    domainPatterns: [/(?:^|\.)github\.com$/i],
    serviceName: "GitHub",
    securityUrl: "https://github.com/settings/security",
  },
  {
    domainPatterns: [/(?:^|\.)microsoft\.com$/i, /(?:^|\.)live\.com$/i, /(?:^|\.)outlook\.com$/i],
    serviceName: "Microsoft",
    securityUrl: "https://account.microsoft.com/security",
  },
  {
    domainPatterns: [/(?:^|\.)apple\.com$/i, /(?:^|\.)icloud\.com$/i],
    serviceName: "Apple",
    securityUrl: "https://appleid.apple.com/account/manage",
  },
  {
    domainPatterns: [/(?:^|\.)aws\.amazon\.com$/i, /(?:^|\.)amazon\.com$/i],
    serviceName: "AWS / Amazon",
    securityUrl: "https://console.aws.amazon.com/iam/home#/security_credentials",
  },
  {
    domainPatterns: [/(?:^|\.)stripe\.com$/i],
    serviceName: "Stripe",
    securityUrl: "https://dashboard.stripe.com/settings/user",
  },
  {
    domainPatterns: [/(?:^|\.)openai\.com$/i],
    serviceName: "OpenAI",
    securityUrl: "https://platform.openai.com/api-keys",
  },
  {
    domainPatterns: [/(?:^|\.)netflix\.com$/i],
    serviceName: "Netflix",
    securityUrl: "https://www.netflix.com/youraccount",
  },
  {
    domainPatterns: [/(?:^|\.)spotify\.com$/i],
    serviceName: "Spotify",
    securityUrl: "https://www.spotify.com/account/overview/",
  },
  {
    domainPatterns: [/(?:^|\.)adobe\.com$/i],
    serviceName: "Adobe",
    securityUrl: "https://account.adobe.com/security",
  },
  {
    domainPatterns: [/(?:^|\.)twitter\.com$/i, /(?:^|\.)x\.com$/i],
    serviceName: "X (Twitter)",
    securityUrl: "https://twitter.com/settings/security",
  },
  {
    domainPatterns: [/(?:^|\.)facebook\.com$/i, /(?:^|\.)meta\.com$/i],
    serviceName: "Meta",
    securityUrl: "https://accountscenter.facebook.com/password_and_security",
  },
  {
    domainPatterns: [/(?:^|\.)dropbox\.com$/i],
    serviceName: "Dropbox",
    securityUrl: "https://www.dropbox.com/account/security",
  },
  {
    domainPatterns: [/(?:^|\.)slack\.com$/i],
    serviceName: "Slack",
    securityUrl: "https://my.slack.com/account/settings#password",
  },
  {
    domainPatterns: [/(?:^|\.)notion\.so$/i],
    serviceName: "Notion",
    securityUrl: "https://www.notion.so/settings",
  },
  {
    domainPatterns: [/(?:^|\.)vercel\.com$/i],
    serviceName: "Vercel",
    securityUrl: "https://vercel.com/account/tokens",
  },
  {
    domainPatterns: [/(?:^|\.)linear\.app$/i],
    serviceName: "Linear",
    securityUrl: "https://linear.app/settings/security",
  },
];

export class SecurityRecommendations {
  /**
   * Retrieves the official verified account security URL for a platform.
   */
  static getOfficialSecurityUrl(domain: string, serviceName = ""): string | undefined {
    const cleanDomain = domain.toLowerCase().trim();
    for (const entry of OFFICIAL_SECURITY_REGISTRY) {
      if (entry.domainPatterns.some((pattern) => pattern.test(cleanDomain))) {
        return entry.securityUrl;
      }
      if (serviceName && entry.serviceName.toLowerCase() === serviceName.toLowerCase()) {
        return entry.securityUrl;
      }
    }
    return undefined;
  }
}
