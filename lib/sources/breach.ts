import type { SourceResult } from "./types";

// Fields from breach analytics endpoint that are safe to show (never passwords/hashes)
const SAFE_CATEGORIES = [
  "Email addresses",
  "Names",
  "Usernames",
  "Phone numbers",
  "Physical addresses",
  "Geographic locations",
  "Dates of birth",
  "Genders",
  "Job titles",
  "IP addresses",
  "Social media profiles",
  "Device information",
  "Website Activity",
  "Browser user agent details",
  "Purchases",
  "Account balances",
  "Financial Transactions",
  "Social security numbers",
  "Government IDs",
  "Licence Plates",
  "Nationalities",
  "Auth Tokens",
  "Private Messages",
  "Profile Photos",
  "Partial Government Issued IDs",
  "Government issued IDs",
  "Partial credit card data",
  "Credit card details",
];

// Never show these
const BLOCKED_CATEGORIES = /password|hash|credential/i;

export interface BreachEntry {
  name: string;
  date?: string;
  industry?: string;
  xposedData?: string[];
  records?: number;
}

export interface BreachCorrelationItem {
  breachName: string;
  domain: string;
  breachDate?: string;
}

function normalizeBreachDomain(value: unknown): string {
  if (typeof value !== "string") return "";
  const clean = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");
  return clean.split("/")[0];
}

/** Best-effort correlation lookup; never makes the Gmail scan fail. */
export async function getBreachCorrelation(
  email: string,
  timeoutMs = 4000
): Promise<BreachCorrelationItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await checkBreach(email, controller.signal);
    if (result.status !== "found" || !Array.isArray(result.data?.breaches)) return [];

    return result.data.breaches.flatMap((entry: unknown) => {
      if (!entry || typeof entry !== "object") return [];
      const item = entry as BreachEntry & { domain?: string };
      if (!item.name) return [];
      return [{
        breachName: item.name,
        domain: normalizeBreachDomain(item.domain) || normalizeBreachDomain(item.name),
        breachDate: typeof item.date === "string" ? item.date : undefined,
      }];
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkBreach(
  email: string,
  signal: AbortSignal
): Promise<SourceResult> {
  try {
    const encoded = encodeURIComponent(email);

    // Primary check endpoint
    const checkRes = await fetch(
      `https://api.xposedornot.com/v1/check-email/${encoded}`,
      { signal }
    );

    if (checkRes.status === 404) {
      return { source: "breach", status: "not_found" };
    }

    if (checkRes.status === 429) {
      return {
        source: "breach",
        status: "error",
        message: "Rate limited, try again in a few seconds",
      };
    }

    if (!checkRes.ok) {
      return {
        source: "breach",
        status: "error",
        message: `Breach check returned ${checkRes.status}`,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const checkData: any = await checkRes.json();

    // XposedOrNot returns { breaches: [[...names]], status: "success" }
    // or { Error: "Not found" } for no breaches
    if (
      checkData?.Error === "Not found" ||
      !checkData?.breaches ||
      !Array.isArray(checkData.breaches) ||
      checkData.breaches.length === 0
    ) {
      return { source: "breach", status: "not_found" };
    }

    const breachNames: string[] = (checkData.breaches[0] ?? []).filter(
      (b: unknown) => typeof b === "string"
    );

    if (breachNames.length === 0) {
      return { source: "breach", status: "not_found" };
    }

    // Try to enrich with analytics (best-effort, single call, no retry)
    const enriched: BreachEntry[] = [];
    let analyticsOk = false;

    try {
      const analyticsRes = await fetch(
        `https://api.xposedornot.com/v1/breach-analytics?email=${encoded}`,
        { signal }
      );

      if (analyticsRes.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const analyticsData: any = await analyticsRes.json();
        const details: unknown[] =
          analyticsData?.ExposedBreaches?.breaches_details ?? [];

        if (Array.isArray(details) && details.length > 0) {
          analyticsOk = true;
          for (const d of details) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const item = d as any;
            const rawCategories: string[] = (item.xposed_data ?? "")
              .split(";")
              .map((s: string) => s.trim())
              .filter((s: string) => s && !BLOCKED_CATEGORIES.test(s) && SAFE_CATEGORIES.some(c => c.toLowerCase() === s.toLowerCase()));

            enriched.push({
              name: item.breach,
              date: item.xposed_date ?? undefined,
              industry: item.industry ?? undefined,
              xposedData: rawCategories.length > 0 ? rawCategories : undefined,
              records: typeof item.xposed_records === "number" ? item.xposed_records : undefined,
            });
          }
        }
      }
    } catch {
      // analytics failure is non-fatal – fall back to names only
    }

    // Build the final breach list
    let breaches: BreachEntry[];
    if (analyticsOk && enriched.length > 0) {
      // Merge: enriched entries first, then any names not in enriched
      const enrichedNames = new Set(enriched.map((e) => e.name));
      const extras = breachNames
        .filter((n) => !enrichedNames.has(n))
        .map((n): BreachEntry => ({ name: n }));
      breaches = [...enriched, ...extras];
    } else {
      breaches = breachNames.map((n): BreachEntry => ({ name: n }));
    }

    return {
      source: "breach",
      status: "found",
      data: {
        count: breachNames.length,
        breaches,
        hasDetails: analyticsOk,
      },
    };
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return { source: "breach", status: "error", message: "Request timed out" };
    }
    return { source: "breach", status: "error", message: "Network error" };
  }
}
