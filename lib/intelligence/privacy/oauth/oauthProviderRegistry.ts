import {
  type OAuthProviderType,
  type OAuthPermission,
} from "../privacyTypes";

export interface ProviderMetadata {
  type: OAuthProviderType;
  displayName: string;
  managementUrl: string;
  documentationUrl: string;
  securityNotice: string;
}

export const OAUTH_PROVIDERS: Record<OAuthProviderType, ProviderMetadata> = {
  GOOGLE: {
    type: "GOOGLE",
    displayName: "Google Account",
    managementUrl: "https://myaccount.google.com/connections",
    documentationUrl: "https://support.google.com/accounts/answer/3466521",
    securityNotice: "Review third-party apps and services with access to your Google Account.",
  },
  GITHUB: {
    type: "GITHUB",
    displayName: "GitHub",
    managementUrl: "https://github.com/settings/applications",
    documentationUrl: "https://docs.github.com/en/apps/oauth-apps/maintaining-oauth-apps/authorizing-oauth-apps",
    securityNotice: "Inspect authorized OAuth apps, GitHub Apps, and personal access tokens with repository access.",
  },
  DISCORD: {
    type: "DISCORD",
    displayName: "Discord",
    managementUrl: "https://discord.com/settings/authorized-apps",
    documentationUrl: "https://support.discord.com/hc/en-us/articles/360046450472",
    securityNotice: "Audit external bots and applications authorized to access your Discord account or servers.",
  },
  MICROSOFT: {
    type: "MICROSOFT",
    displayName: "Microsoft Account / Entra ID",
    managementUrl: "https://account.live.com/consent/Manage",
    documentationUrl: "https://support.microsoft.com/en-us/account-billing/manage-apps-and-services-with-access-to-your-microsoft-account-3bf5b602-0e54-47a3-8cf0-aa9d97858c28",
    securityNotice: "Manage third-party applications with permissions to your Outlook, OneDrive, and Microsoft profile.",
  },
  APPLE: {
    type: "APPLE",
    displayName: "Sign in with Apple",
    managementUrl: "https://appleid.apple.com/account/manage",
    documentationUrl: "https://support.apple.com/en-us/102652",
    securityNotice: "Manage apps using Sign in with Apple, including hidden email forwarding addresses.",
  },
  GENERIC: {
    type: "GENERIC",
    displayName: "External OAuth Provider",
    managementUrl: "",
    documentationUrl: "",
    securityNotice: "Review permissions in the third-party provider's account security settings.",
  },
};

/**
 * Curated dictionary of OAuth scopes with risk classifications and human explanations.
 */
export const KNOWN_SCOPES: Record<string, OAuthPermission> = {
  // ── Google ──
  "https://www.googleapis.com/auth/gmail.readonly": {
    scope: "https://www.googleapis.com/auth/gmail.readonly",
    friendlyName: "Gmail: Read-Only",
    description: "Read email messages and metadata. Cannot send or delete emails.",
    riskLevel: "MEDIUM",
    isSensitive: true,
  },
  "https://www.googleapis.com/auth/gmail.modify": {
    scope: "https://www.googleapis.com/auth/gmail.modify",
    friendlyName: "Gmail: Read & Modify",
    description: "Read, compose, send, and permanently delete emails and labels.",
    riskLevel: "CRITICAL",
    isSensitive: true,
  },
  "https://www.googleapis.com/auth/drive": {
    scope: "https://www.googleapis.com/auth/drive",
    friendlyName: "Google Drive: Full Control",
    description: "Full access to create, edit, download, and delete all Google Drive documents.",
    riskLevel: "CRITICAL",
    isSensitive: true,
  },
  "https://www.googleapis.com/auth/drive.readonly": {
    scope: "https://www.googleapis.com/auth/drive.readonly",
    friendlyName: "Google Drive: Read-Only",
    description: "View and download files in Google Drive.",
    riskLevel: "MEDIUM",
    isSensitive: true,
  },
  "https://www.googleapis.com/auth/userinfo.email": {
    scope: "https://www.googleapis.com/auth/userinfo.email",
    friendlyName: "Profile: Email",
    description: "View your primary email address.",
    riskLevel: "LOW",
    isSensitive: false,
  },
  "https://www.googleapis.com/auth/userinfo.profile": {
    scope: "https://www.googleapis.com/auth/userinfo.profile",
    friendlyName: "Profile: Basic Info",
    description: "View your public personal profile information (name, avatar).",
    riskLevel: "LOW",
    isSensitive: false,
  },

  // ── GitHub ──
  repo: {
    scope: "repo",
    friendlyName: "GitHub: Full Repository Control",
    description: "Full read and write control of private and public repositories, code, and issues.",
    riskLevel: "CRITICAL",
    isSensitive: true,
  },
  "admin:org": {
    scope: "admin:org",
    friendlyName: "GitHub: Organization Admin",
    description: "Full administrative control of organizations and teams.",
    riskLevel: "CRITICAL",
    isSensitive: true,
  },
  workflow: {
    scope: "workflow",
    friendlyName: "GitHub: CI/CD Workflows",
    description: "Create and update GitHub Actions workflow files (potential code execution risk).",
    riskLevel: "HIGH",
    isSensitive: true,
  },
  "read:user": {
    scope: "read:user",
    friendlyName: "GitHub: Read User Profile",
    description: "Read profile data, email addresses, and followers.",
    riskLevel: "LOW",
    isSensitive: false,
  },
  "user:email": {
    scope: "user:email",
    friendlyName: "GitHub: Access Email",
    description: "Access verified private email addresses.",
    riskLevel: "LOW",
    isSensitive: false,
  },
  delete_repo: {
    scope: "delete_repo",
    friendlyName: "GitHub: Delete Repositories",
    description: "Grants permission to permanently delete repositories.",
    riskLevel: "CRITICAL",
    isSensitive: true,
  },

  // ── Discord ──
  identify: {
    scope: "identify",
    friendlyName: "Discord: Identity",
    description: "Access your username, avatar, and banner.",
    riskLevel: "LOW",
    isSensitive: false,
  },
  email: {
    scope: "email",
    friendlyName: "Discord: Email",
    description: "Access your Discord account email address.",
    riskLevel: "LOW",
    isSensitive: false,
  },
  guilds: {
    scope: "guilds",
    friendlyName: "Discord: Server Memberships",
    description: "Read the list of servers (guilds) you belong to.",
    riskLevel: "LOW",
    isSensitive: false,
  },
  "guilds.join": {
    scope: "guilds.join",
    friendlyName: "Discord: Join Servers",
    description: "Add your account to servers without explicit per-server approval.",
    riskLevel: "HIGH",
    isSensitive: true,
  },
  bot: {
    scope: "bot",
    friendlyName: "Discord: Bot Authorization",
    description: "Install bot into servers with defined administrative permissions.",
    riskLevel: "CRITICAL",
    isSensitive: true,
  },
  "messages.read": {
    scope: "messages.read",
    friendlyName: "Discord: Read Messages",
    description: "Read message history in channels.",
    riskLevel: "HIGH",
    isSensitive: true,
  },

  // ── Microsoft ──
  "Mail.Read": {
    scope: "Mail.Read",
    friendlyName: "Microsoft: Read Mail",
    description: "Read email in user mailboxes.",
    riskLevel: "HIGH",
    isSensitive: true,
  },
  "Mail.ReadWrite": {
    scope: "Mail.ReadWrite",
    friendlyName: "Microsoft: Read & Write Mail",
    description: "Read, create, update, and delete email messages in user mailboxes.",
    riskLevel: "CRITICAL",
    isSensitive: true,
  },
  "Files.ReadWrite.All": {
    scope: "Files.ReadWrite.All",
    friendlyName: "Microsoft: Full Files Access",
    description: "Full read and write access to all files in OneDrive and SharePoint.",
    riskLevel: "CRITICAL",
    isSensitive: true,
  },
  "User.Read": {
    scope: "User.Read",
    friendlyName: "Microsoft: Read Profile",
    description: "Sign in and read user profile data.",
    riskLevel: "LOW",
    isSensitive: false,
  },
};
