import { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getDeleteHelpUrl, isDomainInDeleteLinks } from "@/lib/deleteLinks";
import { getBrandName } from "@/lib/brandNames";
import { isSendingDomain } from "@/lib/sendingDomains";
import { assessPlatformRisk } from "@/lib/riskScore";
import { getBreachCorrelation, type BreachCorrelationItem } from "@/lib/sources/breach";

// Node.js is the default runtime in Next.js 16

// Generic webmail / relay providers to exclude from platform accounts
const GENERIC_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "google.com",
  "yahoo.com",
  "ymail.com",
  "rocketmail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "zoho.com",
  "aol.com",
  "mail.com",
  "gmx.com",
  "gmx.net",
  "fastmail.com",
  "yandex.com",
  "tutanota.com",
  "tutamail.com",
]);

// Known multi-part second-level public suffixes
const MULTI_PART_SLDS = new Set([
  "co.uk", "org.uk", "me.uk", "ac.uk", "gov.uk",
  "co.in", "org.in", "net.in", "gen.in", "firm.in", "gov.in", "ac.in",
  "com.au", "net.au", "org.au", "edu.au", "gov.au",
  "co.nz", "net.nz", "org.nz",
  "co.za", "org.za",
  "com.br", "org.br",
  "co.jp", "ne.jp", "ac.jp", "go.jp",
  "com.sg", "edu.sg", "gov.sg",
  "com.mx", "org.mx",
  "com.tr", "org.tr",
]);

function getRegistrableDomain(domain: string): string {
  const clean = domain.toLowerCase().trim();
  const parts = clean.split(".");
  if (parts.length <= 2) return clean;

  const lastTwo = parts.slice(-2).join(".");
  if (MULTI_PART_SLDS.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

function parseFromHeader(from: string): { displayName: string | null; email: string | null } {
  const match = from.match(/^(?:["']?([^"'<]+)["']?\s*)?<?([^>@\s]+@[^>@\s]+)>?$/);
  if (match) {
    const name = match[1]?.trim() || null;
    const email = match[2]?.trim().toLowerCase() || null;
    return { displayName: name, email };
  }
  const emailMatch = from.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    const email = emailMatch[1].toLowerCase();
    const namePart = from.replace(emailMatch[0], "").replace(/[<>"']/g, "").trim();
    return { displayName: namePart || null, email };
  }
  return { displayName: null, email: null };
}

// Subject categorization regexes
const PASSWORD_RESET_RE =
  /(password[ -]?reset|reset your password|change your password|temporary password)/i;
const VERIFY_CONFIRM_RE =
  /(verify your email|verification code|confirm your account|confirmation code|activate your account|security code|one-time passcode|\botp\b|\bpin\b)/i;
const RECEIPT_ORDER_RE =
  /(receipt|order confirmation|invoice|payment received|subscription renewed|order #|order number)/i;
const GENERAL_SIGNUP_RE =
  /(welcome|get started|joined|registration|sign[ -]?up)/i;
const SECURITY_EMAIL_RE =
  /password|reset|security alert|changed your password|two-factor|2fa|verification|login alert/i;

export type MessageSubjectType = "activity" | "digest" | "other";

const ACTIVITY_SUBJECT_RE =
  /\b(receipt|order|invoice|payment|security alert|new sign[ -]?in|new login|verify|confirm|password[ -]?reset)\b/i;

const DIGEST_SUBJECT_RE =
  /\b(digest|weekly|newsletter|recommendations?|we miss you|you have \d+ notifications?|notifications?)\b/i;

function classifySubject(subject: string): MessageSubjectType {
  if (ACTIVITY_SUBJECT_RE.test(subject)) {
    return "activity";
  }
  if (DIGEST_SUBJECT_RE.test(subject)) {
    return "digest";
  }
  return "other";
}

interface PlatformAccumulator {
  id: string;
  isSendingDomain: boolean;
  domain: string;
  displayName: string;
  senderDisplayNames: Set<string>;
  firstSeen: Date;
  lastAnyEmail: Date;
  lastActivityEmail: Date | null;
  emailCount: number;
  listUnsubCount: number;
  bulkOrUnsubCount: number;
  signupLike: boolean;
  strongAccountReason: string | null;
  lastSecurityEmailDate: Date | null;
}

function normalizeMatchValue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findMatchingBreach(
  displayName: string,
  domain: string,
  breaches: BreachCorrelationItem[]
): BreachCorrelationItem | undefined {
  const candidates = [displayName, domain]
    .map(normalizeMatchValue)
    .filter((value) => value.length >= 4);
  return breaches.find((breach) => {
    const values = [breach.breachName, breach.domain]
      .filter(Boolean)
      .map(normalizeMatchValue)
      .filter((value) => value.length >= 4);
    return candidates.some((candidate) =>
      values.some((value) => value === candidate || value.includes(candidate) || candidate.includes(value))
    );
  });
}

export async function POST(request: NextRequest) {
  // Read JWT session token server-side only
  const cookieHeader = request.headers.get("cookie") ?? "";
  const isSecure = cookieHeader.includes("__Secure-authjs.session-token");
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET || "smart-digital-declutter-development-secret-key-32chars",
    secureCookie: isSecure,
  });

  if (!token || !token.accessToken) {
    return new Response(
      JSON.stringify({
        error: "Authentication required. Please sign in with your Google account to scan your mailbox.",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const accessToken = token.accessToken as string;
  const userEmail = (token.email as string | undefined)?.toLowerCase();
  const breachCorrelationPromise = userEmail
    ? getBreachCorrelation(userEmail)
    : Promise.resolve([] as BreachCorrelationItem[]);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      };

      try {
        send({
          type: "progress",
          scanned: 0,
          total: 0,
          message: "Searching mailbox for account emails…",
        });

        // Search query matching account-style emails
        const baseQuery =
          'welcome OR "verify your email" OR "confirm your account" OR receipt OR order OR "password reset" OR "your account" OR subscription';

        const messageMap = new Map<string, { id: string }>();

        // 1. Primary search: page up to 1,500 messages using nextPageToken
        let pageToken: string | undefined = undefined;
        while (messageMap.size < 1500) {
          const maxResults = Math.min(500, 1500 - messageMap.size);
          let listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent(
            baseQuery
          )}`;
          if (pageToken) {
            listUrl += `&pageToken=${encodeURIComponent(pageToken)}`;
          }

          const listRes = await fetch(listUrl, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/json",
            },
          });

          if (!listRes.ok) {
            if (listRes.status === 401) {
              throw new Error("Google session expired. Please sign out and sign in again.");
            }
            if (listRes.status === 403) {
              throw new Error(
                "Access denied by Google. Please ensure you approved mailbox header permissions during sign-in. Check myaccount.google.com/permissions."
              );
            }
            if (listRes.status === 429) {
              throw new Error("Gmail API rate limit reached. Please wait a moment and try again.");
            }
            throw new Error(`Gmail API returned status ${listRes.status}`);
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const listData: any = await listRes.json();
          if (listData.messages && Array.isArray(listData.messages)) {
            for (const m of listData.messages) {
              if (m.id) messageMap.set(m.id, m);
            }
          }
          if (!listData.nextPageToken || messageMap.size >= 1500) {
            break;
          }
          pageToken = listData.nextPageToken;
        }

        // 2. Second search for older mail (>365d) up to 300 messages to catch dormant accounts
        const olderQuery = `older_than:365d (${baseQuery})`;
        let olderToken: string | undefined = undefined;
        let olderFetched = 0;
        while (olderFetched < 300) {
          const maxResults = Math.min(300 - olderFetched, 300);
          let olderUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent(
            olderQuery
          )}`;
          if (olderToken) {
            olderUrl += `&pageToken=${encodeURIComponent(olderToken)}`;
          }

          const olderRes = await fetch(olderUrl, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/json",
            },
          });

          if (olderRes.ok) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const olderData: any = await olderRes.json();
            if (olderData.messages && Array.isArray(olderData.messages)) {
              for (const m of olderData.messages) {
                if (m.id) messageMap.set(m.id, m);
              }
              olderFetched += olderData.messages.length;
            }
            if (!olderData.nextPageToken) break;
            olderToken = olderData.nextPageToken;
          } else {
            // Non-fatal if older query fails or hits limit
            break;
          }
        }

        const messageList = Array.from(messageMap.values());
        const totalMessages = messageList.length;
        const breachItems = await breachCorrelationPromise;

        if (totalMessages === 0) {
          send({
            type: "progress",
            scanned: 0,
            total: 0,
            message: "No matching account emails found in your mailbox.",
          });
          send({
            type: "done",
            platforms: [],
            summary: {
              totalAccounts: 0,
              inactiveAccounts: 0,
              totalPlatforms: 0,
              scannedEmails: 0,
            },
          });
          controller.close();
          return;
        }

        send({
          type: "progress",
          scanned: 0,
          total: totalMessages,
          message: `Found ${totalMessages} emails. Scanning headers…`,
        });

        const platformMap = new Map<string, PlatformAccumulator>();
        const BATCH_SIZE = 25;
        let scanned = 0;

        for (let i = 0; i < messageList.length; i += BATCH_SIZE) {
          const batch = messageList.slice(i, i + BATCH_SIZE);

          const batchPromises = batch.map(async (msg) => {
            try {
              // Fetch metadata headers only: From, Subject, Date, List-Unsubscribe, Precedence
              const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=List-Unsubscribe&metadataHeaders=Precedence`;
              const msgRes = await fetch(msgUrl, {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  Accept: "application/json",
                },
              });

              if (!msgRes.ok) return null;

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const msgData: any = await msgRes.json();
              const headers: Array<{ name: string; value: string }> =
                msgData.payload?.headers ?? [];

              const fromVal =
                headers.find((h) => h.name.toLowerCase() === "from")?.value ?? "";
              const subjectVal =
                headers.find((h) => h.name.toLowerCase() === "subject")?.value ?? "";
              const dateVal =
                headers.find((h) => h.name.toLowerCase() === "date")?.value ?? "";
              const unsubVal =
                headers.find((h) => h.name.toLowerCase() === "list-unsubscribe")?.value ?? "";
              const precedenceVal =
                headers.find((h) => h.name.toLowerCase() === "precedence")?.value ?? "";

              let msgDate: Date | null = null;
              if (dateVal) {
                const parsed = new Date(dateVal);
                if (!isNaN(parsed.getTime())) msgDate = parsed;
              }
              if (!msgDate && msgData.internalDate) {
                const ts = parseInt(msgData.internalDate, 10);
                if (!isNaN(ts)) msgDate = new Date(ts);
              }

              const hasUnsub = Boolean(unsubVal && unsubVal.trim().length > 0);
              const isBulk = Boolean(precedenceVal && /bulk/i.test(precedenceVal));
              const isBulkOrUnsub = hasUnsub || isBulk;

              return {
                from: fromVal,
                subject: subjectVal,
                date: msgDate ?? new Date(),
                hasUnsub,
                isBulkOrUnsub,
                isSecurityEmail: SECURITY_EMAIL_RE.test(subjectVal),
              };
            } catch {
              return null;
            }
          });

          const results = await Promise.all(batchPromises);

          for (const item of results) {
            if (!item || !item.from) continue;

            const parsedFrom = parseFromHeader(item.from);
            if (!parsedFrom.email) continue;

            // Ignore the user's own email address
            if (userEmail && parsedFrom.email === userEmail) continue;

            const domainPart = parsedFrom.email.split("@")[1];
            if (!domainPart) continue;

            const registrableDomain = getRegistrableDomain(domainPart);

            // Ignore generic webmail providers
            if (GENERIC_MAIL_DOMAINS.has(registrableDomain)) continue;

            const isSending = isSendingDomain(registrableDomain);

            // Grouping:
            // For sending domains (e.g. substack.com, kajabimail.com), group by sender's display name
            // because many unrelated senders share one sending domain.
            let groupKey: string;
            let groupDisplayName: string;

            if (isSending) {
              const cleanName = parsedFrom.displayName?.trim() || "";
              if (cleanName.length > 0) {
                groupKey = `esp:${cleanName.toLowerCase()}`;
                groupDisplayName = cleanName;
              } else {
                groupKey = `esp:${domainPart.toLowerCase()}`;
                groupDisplayName = domainPart;
              }
            } else {
              groupKey = `domain:${registrableDomain}`;
              groupDisplayName = getBrandName(registrableDomain);
            }

            // Categorize subject
            const subjectType = classifySubject(item.subject);
            let messageStrongReason: string | null = null;
            if (PASSWORD_RESET_RE.test(item.subject)) {
              messageStrongReason = "Has password reset email";
            } else if (VERIFY_CONFIRM_RE.test(item.subject)) {
              messageStrongReason = "Has account verification email";
            } else if (RECEIPT_ORDER_RE.test(item.subject)) {
              messageStrongReason = "Has purchase receipt or order email";
            }

            const isGeneralSignup =
              Boolean(messageStrongReason) || GENERAL_SIGNUP_RE.test(item.subject);

            const existing = platformMap.get(groupKey);
            if (existing) {
              existing.emailCount += 1;
              if (item.hasUnsub) existing.listUnsubCount += 1;
              if (item.isBulkOrUnsub) existing.bulkOrUnsubCount += 1;
              if (isGeneralSignup) existing.signupLike = true;
              if (
                item.isSecurityEmail &&
                (!existing.lastSecurityEmailDate || item.date > existing.lastSecurityEmailDate)
              ) {
                existing.lastSecurityEmailDate = item.date;
              }
              if (messageStrongReason && !existing.strongAccountReason) {
                existing.strongAccountReason = messageStrongReason;
              }
              if (item.date < existing.firstSeen) existing.firstSeen = item.date;
              if (item.date > existing.lastAnyEmail) existing.lastAnyEmail = item.date;
              if (subjectType === "activity") {
                if (!existing.lastActivityEmail || item.date > existing.lastActivityEmail) {
                  existing.lastActivityEmail = item.date;
                }
              }
              if (parsedFrom.displayName) {
                existing.senderDisplayNames.add(parsedFrom.displayName);
              }
            } else {
              const nameSet = new Set<string>();
              if (parsedFrom.displayName) {
                nameSet.add(parsedFrom.displayName);
              }
              platformMap.set(groupKey, {
                id: groupKey,
                isSendingDomain: isSending,
                domain: registrableDomain,
                displayName: groupDisplayName,
                senderDisplayNames: nameSet,
                firstSeen: item.date,
                lastAnyEmail: item.date,
                lastActivityEmail: subjectType === "activity" ? item.date : null,
                emailCount: 1,
                listUnsubCount: item.hasUnsub ? 1 : 0,
                bulkOrUnsubCount: item.isBulkOrUnsub ? 1 : 0,
                signupLike: isGeneralSignup,
                strongAccountReason: messageStrongReason,
                lastSecurityEmailDate: item.isSecurityEmail ? item.date : null,
              });
            }
          }

          scanned += batch.length;
          send({
            type: "progress",
            scanned,
            total: totalMessages,
            message: `Scanned ${scanned} / ${totalMessages}…`,
          });

          // Small pause to be polite to Gmail API quotas
          await new Promise((r) => setTimeout(r, 25));
        }

        const now = Date.now();
        const MS_PER_DAY = 1000 * 60 * 60 * 24;

        const platforms = Array.from(platformMap.values()).map((p) => {
          const statusDate = p.lastActivityEmail ?? p.lastAnyEmail;
          const statusBasis: "activity" | "any" = p.lastActivityEmail ? "activity" : "any";
          const daysAgo = Math.max(
            0,
            Math.floor((now - statusDate.getTime()) / MS_PER_DAY)
          );
          const lastAnyDaysAgo = Math.max(
            0,
            Math.floor((now - p.lastAnyEmail.getTime()) / MS_PER_DAY)
          );
          const lastActivityDaysAgo = p.lastActivityEmail
            ? Math.max(0, Math.floor((now - p.lastActivityEmail.getTime()) / MS_PER_DAY))
            : null;

          let status: "Recent email" | "No email 90+ days" | "No email 1+ year";
          if (daysAgo < 90) {
            status = "Recent email";
          } else if (daysAgo <= 365) {
            status = "No email 90+ days";
          } else {
            status = "No email 1+ year";
          }

          // Classification applied in exact order (first match wins):
          // a. Sending domain → "newsletter" (reason: "Sent through an email marketing service")
          // b. Domain is in lib/deleteLinks.ts → "account" (reason: "Known platform")
          // c. Has at least one verify, confirm, password-reset, or receipt subject (not just "welcome"),
          //    and fewer than half of its messages carry List-Unsubscribe → "account" (reason: e.g. "Has password reset email")
          // d. Most messages carry List-Unsubscribe or Precedence: bulk and no strong account subject → "newsletter" (reason: "Bulk mail with unsubscribe header")
          // e. Everything else, including welcome-only senders → "unknown" (reason: "Not enough evidence")
          let type: "account" | "newsletter" | "unknown";
          let reason: string;

          if (p.isSendingDomain) {
            type = "newsletter";
            reason = "Sent through an email marketing service";
          } else if (isDomainInDeleteLinks(p.domain)) {
            type = "account";
            reason = "Known platform";
          } else if (p.strongAccountReason && p.listUnsubCount < p.emailCount / 2) {
            type = "account";
            reason = p.strongAccountReason;
          } else if (p.bulkOrUnsubCount > p.emailCount / 2 && !p.strongAccountReason) {
            type = "newsletter";
            reason = "Bulk mail with unsubscribe header";
          } else {
            type = "unknown";
            reason = "Not enough evidence";
          }

          // Row title and secondary sender text
          let rowTitle: string;
          let secondarySender: string | null = null;

          if (p.isSendingDomain) {
            rowTitle = p.displayName;
            secondarySender = `via ${p.domain}`;
          } else {
            rowTitle = p.displayName; // Derived brand name
            const alternate = Array.from(p.senderDisplayNames).find(
              (name) =>
                name.trim().toLowerCase() !== rowTitle.toLowerCase() &&
                name.trim().toLowerCase() !== p.domain.toLowerCase()
            );
            secondarySender = alternate ?? null;
          }

          const matchedBreach = findMatchingBreach(rowTitle, p.domain, breachItems);
          const risk = assessPlatformRisk({
            displayName: rowTitle,
            domain: p.domain,
            type,
            daysAgo,
            statusBasis,
            emailCount: p.emailCount,
            signupLike: p.signupLike,
            breachInfo: matchedBreach
              ? {
                  breached: true,
                  breachName: matchedBreach.breachName,
                  breachDate: matchedBreach.breachDate,
                }
              : { breached: false },
            lastSecurityEmailDate: p.lastSecurityEmailDate?.toISOString() ?? null,
          });

          return {
            id: p.id,
            displayName: rowTitle,
            senderDisplayName: secondarySender,
            domain: p.domain,
            type,
            reason,
            firstSeen: p.firstSeen.toISOString(),
            lastSeen: statusDate.toISOString(),
            lastSeenFormatted: statusDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
            lastAnyEmail: p.lastAnyEmail.toISOString(),
            lastAnyEmailFormatted: p.lastAnyEmail.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
            lastAnyDaysAgo,
            lastActivityEmail: p.lastActivityEmail ? p.lastActivityEmail.toISOString() : null,
            lastActivityEmailFormatted: p.lastActivityEmail
              ? p.lastActivityEmail.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : null,
            lastActivityDaysAgo,
            statusBasis,
            daysAgo,
            emailCount: p.emailCount,
            signupLike: p.signupLike,
            status,
            deleteUrl: getDeleteHelpUrl(p.domain, rowTitle),
            riskScore: risk.score,
            riskLevel: risk.level,
            riskReasons: risk.reasons,
            recommendedAction: risk.recommendedAction,
            breachStatus: risk.breachStatus,
            breachDate: matchedBreach?.breachDate ?? null,
            lastSecurityEmailDate: p.lastSecurityEmailDate?.toISOString() ?? null,
          };
        });

        // Sorted by lastSeen oldest first
        platforms.sort(
          (a, b) => new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime()
        );

        const accounts = platforms.filter((p) => p.type === "account");
        const totalAccounts = accounts.length;
        const over90Accounts = accounts.filter(
          (p) => p.status === "No email 90+ days" || p.status === "No email 1+ year"
        ).length;
        const highRiskAccounts = accounts.filter((p) => p.riskLevel === "high").length;
        const overallRiskScore = accounts.length
          ? Math.round(accounts.reduce((sum, p) => sum + p.riskScore, 0) / accounts.length)
          : 0;

        send({
          type: "done",
          platforms,
          summary: {
            totalAccounts,
            over90Accounts,
            inactiveAccounts: over90Accounts,
            totalPlatforms: platforms.length,
            scannedEmails: scanned,
            overallRiskScore,
            highRiskAccounts,
          },
        });

        controller.close();
      } catch (err) {
        send({
          type: "error",
          error: (err as Error).message ?? "An error occurred while scanning your mailbox.",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
