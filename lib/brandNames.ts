/**
 * Map of popular domain names to their canonical brand display names.
 */
export const BRAND_NAMES: Record<string, string> = {
  "patreon.com": "Patreon",
  "spotify.com": "Spotify",
  "netflix.com": "Netflix",
  "x.com": "X",
  "twitter.com": "Twitter / X",
  "linkedin.com": "LinkedIn",
  "instagram.com": "Instagram",
  "facebook.com": "Facebook",
  "github.com": "GitHub",
  "gitlab.com": "GitLab",
  "reddit.com": "Reddit",
  "pinterest.com": "Pinterest",
  "dropbox.com": "Dropbox",
  "airbnb.com": "Airbnb",
  "notion.so": "Notion",
  "figma.com": "Figma",
  "slack.com": "Slack",
  "discord.com": "Discord",
  "zoom.us": "Zoom",
  "stripe.com": "Stripe",
  "paypal.com": "PayPal",
  "ebay.com": "eBay",
  "amazon.com": "Amazon",
  "apple.com": "Apple",
  "google.com": "Google",
  "youtube.com": "YouTube",
  "microsoft.com": "Microsoft",
  "duolingo.com": "Duolingo",
  "coursera.org": "Coursera",
  "udemy.com": "Udemy",
  "grammarly.com": "Grammarly",
  "canva.com": "Canva",
  "adobe.com": "Adobe",
  "medium.com": "Medium",
  "substack.com": "Substack",
  "steampowered.com": "Steam",
  "steamcommunity.com": "Steam",
  "twitch.tv": "Twitch",
  "atlassian.com": "Atlassian",
  "trello.com": "Trello",
  "jira.com": "Jira",
  "bitbucket.org": "Bitbucket",
  "digitalocean.com": "DigitalOcean",
  "cloudflare.com": "Cloudflare",
  "vercel.com": "Vercel",
  "heroku.com": "Heroku",
  "supabase.com": "Supabase",
  "openai.com": "OpenAI",
  "anthropic.com": "Anthropic",
  "quora.com": "Quora",
  "stackoverflow.com": "Stack Overflow",
  "stackexchange.com": "Stack Exchange",
  "producthunt.com": "Product Hunt",
  "strava.com": "Strava",
  "myfitnesspal.com": "MyFitnessPal",
  "fitbit.com": "Fitbit",
  "wordpress.com": "WordPress",
  "mozilla.org": "Mozilla",
  "uber.com": "Uber",
  "lyft.com": "Lyft",
  "doordash.com": "DoorDash",
  "deliveroo.co.uk": "Deliveroo",
  "swiggy.in": "Swiggy",
  "zomato.com": "Zomato",
  "nytimes.com": "The New York Times",
  "wsj.com": "The Wall Street Journal",
  "theverge.com": "The Verge",
  "techcrunch.com": "TechCrunch",
};

/**
 * Derives a clean platform brand name from a domain name,
 * falling back to the capitalized registrable name.
 */
export function getBrandName(domain: string): string {
  const clean = domain.toLowerCase().trim();
  if (BRAND_NAMES[clean]) {
    return BRAND_NAMES[clean];
  }

  // Also check base root
  const base = clean.split(".").slice(-2).join(".");
  if (BRAND_NAMES[base]) {
    return BRAND_NAMES[base];
  }

  // Fallback: capitalize the first label of the domain
  const brandPart = clean.split(".")[0];
  if (!brandPart) return clean;

  return brandPart
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
