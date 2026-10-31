/**
 * Map of popular bulk email service providers (ESPs) and shared sending domains.
 * Unrelated senders often share these infrastructure domains, so emails from these
 * domains are grouped by sender display name rather than the infrastructure domain.
 */
export const SENDING_DOMAINS: Record<string, string> = {
  "kajabimail.com": "Kajabi Email Marketing",
  "academia-mail.com": "Academia Newsletter Mailer",
  "substack.com": "Substack Publication Service",
  "beehiiv.com": "Beehiiv Newsletter Platform",
  "convertkit.com": "ConvertKit / Kit Creator Marketing",
  "ck.page": "ConvertKit Landing Pages",
  "mailchimp.com": "Mailchimp Marketing Platform",
  "mailchimpapp.com": "Mailchimp Newsletter Engine",
  "sendgrid.net": "Twilio SendGrid Delivery",
  "sendgrid.com": "Twilio SendGrid Infrastructure",
  "getdreamemail.com": "DreamHost / Marketing Mailer",
  "mailgun.org": "Mailgun Email Delivery Service",
  "mailgun.net": "Mailgun Transactional & Bulk",
  "klaviyo.com": "Klaviyo E-commerce Marketing",
  "klaviyomail.com": "Klaviyo Sending Infrastructure",
  "constantcontact.com": "Constant Contact Mailer",
  "intercom-mail.com": "Intercom User Engagement",
  "mailerlite.com": "MailerLite Campaigns",
  "mailerlite.net": "MailerLite Sending Network",
  "activehosted.com": "ActiveCampaign Platform",
  "activecampaign.com": "ActiveCampaign Marketing",
  "sendinblue.com": "Brevo / Sendinblue Engine",
  "brevo.com": "Brevo Marketing & Newsletters",
  "aweber.com": "AWeber Email Marketing",
  "drip.com": "Drip E-commerce Marketing",
  "campaign-archive.com": "Mailchimp Campaign Archive",
  "mcsv.net": "Mailchimp Server Delivery",
  "hubspot.com": "HubSpot Marketing Mail",
  "hs-send.com": "HubSpot Sending Infrastructure",
  "ghost.io": "Ghost Newsletter Delivery",
  "getbuttondown.com": "Buttondown Newsletters",
  "buttondown.email": "Buttondown Newsletter Service",
};

/**
 * Checks if a given domain is a known email marketing / shared sending domain.
 */
export function isSendingDomain(domain: string): boolean {
  const clean = domain.toLowerCase().trim();
  if (SENDING_DOMAINS[clean]) return true;

  const base = clean.split(".").slice(-2).join(".");
  return Boolean(SENDING_DOMAINS[base]);
}

/**
 * Returns the description or note for a known sending domain.
 */
export function getSendingDomainNote(domain: string): string | null {
  const clean = domain.toLowerCase().trim();
  if (SENDING_DOMAINS[clean]) return SENDING_DOMAINS[clean];

  const base = clean.split(".").slice(-2).join(".");
  return SENDING_DOMAINS[base] ?? null;
}
