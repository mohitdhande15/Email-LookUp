import { createHash } from "node:crypto";
import type { SourceResult } from "./types";

export async function checkGravatar(
  email: string,
  signal: AbortSignal
): Promise<SourceResult> {
  try {
    const hash = createHash("sha256")
      .update(email.trim().toLowerCase())
      .digest("hex");

    const res = await fetch(`https://api.gravatar.com/v3/profiles/${hash}`, {
      signal,
      headers: { Accept: "application/json" },
    });

    if (res.status === 404) {
      return { source: "gravatar", status: "not_found" };
    }

    if (!res.ok) {
      return {
        source: "gravatar",
        status: "error",
        message: `Gravatar returned ${res.status}`,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile: any = await res.json();

    // Build verified accounts list
    const verifiedAccounts: Array<{ label: string; url: string }> = [];
    if (Array.isArray(profile.verified_accounts)) {
      for (const acct of profile.verified_accounts) {
        verifiedAccounts.push({
          label: acct.service_label ?? acct.service_type ?? "Unknown",
          url: acct.url ?? "",
        });
      }
    }

    return {
      source: "gravatar",
      status: "found",
      data: {
        name: profile.display_name ?? null,
        location: profile.location ?? null,
        jobTitle: profile.job_title ?? null,
        company: profile.company ?? null,
        avatarUrl: profile.avatar_url ?? `https://www.gravatar.com/avatar/${hash}?s=200`,
        profileUrl: profile.profile_url ?? `https://gravatar.com/${hash}`,
        verifiedAccounts,
      },
    };
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return { source: "gravatar", status: "error", message: "Request timed out" };
    }
    return { source: "gravatar", status: "error", message: "Network error" };
  }
}
