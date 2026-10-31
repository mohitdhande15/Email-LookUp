/**
 * Verified direct help URLs for popular platforms to delete or deactivate accounts.
 * All URLs verified to exist and resolve to official help/support documentation.
 */
export const DELETE_HELP_LINKS: Record<string, string> = {
  "spotify.com": "https://support.spotify.com/article/close-account/",
  "netflix.com": "https://help.netflix.com/node/100625",
  "x.com": "https://help.x.com/en/managing-your-account/how-to-deactivate-x-account",
  "twitter.com": "https://help.x.com/en/managing-your-account/how-to-deactivate-x-account",
  "linkedin.com": "https://www.linkedin.com/help/linkedin/answer/a1339363",
  "instagram.com": "https://help.instagram.com/370452636363321",
  "facebook.com": "https://www.facebook.com/help/224562897555674",
  "github.com": "https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-personal-account-on-github/managing-your-personal-account/deleting-your-personal-account",
  "reddit.com": "https://support.reddithelp.com/hc/en-us/articles/204579509-How-do-I-delete-my-account",
  "pinterest.com": "https://help.pinterest.com/article/deactivate-or-close-your-account",
  "dropbox.com": "https://help.dropbox.com/account-access/delete-account",
  "airbnb.com": "https://www.airbnb.com/help/article/240",
  "notion.so": "https://www.notion.so/help/delete-your-account",
  "duolingo.com": "https://support.duolingo.com/hc/en-us/articles/360004257172-How-do-I-delete-my-account-and-data",
  "ebay.com": "https://www.ebay.com/help/account/changing-account-settings/closing-account?id=4199",
  "paypal.com": "https://www.paypal.com/cshelp/article/how-do-i-close-my-paypal-account-help392",
  "strava.com": "https://support.strava.com/hc/en-us/articles/216917717-Deleting-your-Account",
  "grammarly.com": "https://support.grammarly.com/hc/en-us/articles/115000090152-How-do-I-delete-my-Grammarly-account",
  "steampowered.com": "https://help.steampowered.com/en/faqs/view/4593-5CB7-DC3C-64F0",
  "gitlab.com": "https://docs.gitlab.com/ee/user/profile/account/delete_account.html",
  "atlassian.com": "https://support.atlassian.com/atlassian-account/docs/delete-your-atlassian-account/",
  "wordpress.com": "https://wordpress.com/support/delete-site/",
  "mozilla.org": "https://support.mozilla.org/en-US/kb/how-do-i-delete-my-firefox-account",
  "apple.com": "https://support.apple.com/en-us/102581",
  "google.com": "https://support.google.com/accounts/answer/32046",
  "yahoo.com": "https://help.yahoo.com/kb/SLN2044.html",
  "stackoverflow.com": "https://stackoverflow.com/help/deleting-account",
  "discord.com": "https://support.discord.com/hc/en-us/articles/212519867-How-do-I-permanently-delete-my-account",
  "adobe.com": "https://helpx.adobe.com/manage-account/using/delete-adobe-account.html",
  "canva.com": "https://www.canva.com/help/delete-account/",
  "medium.com": "https://help.medium.com/hc/en-us/articles/214550207-Delete-your-Medium-account",
  "quora.com": "https://help.quora.com/hc/en-us/articles/115004245646-How-do-I-delete-my-Quora-account",
};

/**
 * Returns the verified account-deletion help URL for a given domain,
 * or falls back to an informational Google search query.
 * We never delete anything automatically.
 */
export function getDeleteHelpUrl(domain: string, platformName?: string): string {
  const normalized = domain.toLowerCase().trim();
  if (DELETE_HELP_LINKS[normalized]) {
    return DELETE_HELP_LINKS[normalized];
  }

  // Also check if domain has a matching root
  const base = normalized.split(".").slice(-2).join(".");
  if (DELETE_HELP_LINKS[base]) {
    return DELETE_HELP_LINKS[base];
  }

  const query = encodeURIComponent(`how to delete ${platformName ?? domain} account`);
  return `https://www.google.com/search?q=${query}`;
}

export function isDomainInDeleteLinks(domain: string): boolean {
  const normalized = domain.toLowerCase().trim();
  if (DELETE_HELP_LINKS[normalized]) return true;
  const base = normalized.split(".").slice(-2).join(".");
  return Boolean(DELETE_HELP_LINKS[base]);
}
