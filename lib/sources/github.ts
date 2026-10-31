import type { SourceResult } from "./types";

export async function checkGitHub(
  email: string,
  signal: AbortSignal
): Promise<SourceResult> {
  try {
    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "email-lookup-edu/1.0",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (token && token !== "paste_your_token_here") {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const searchUrl = `https://api.github.com/search/users?q=${encodeURIComponent(
      email + " in:email"
    )}&per_page=1`;

    const searchRes = await fetch(searchUrl, { signal, headers });

    if (searchRes.status === 403 || searchRes.status === 429) {
      return {
        source: "github",
        status: "error",
        message: "Rate limited by GitHub API. Try again later.",
      };
    }

    if (!searchRes.ok) {
      return {
        source: "github",
        status: "error",
        message: `GitHub search returned ${searchRes.status}`,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const searchData: any = await searchRes.json();

    if (!searchData.items || searchData.items.length === 0) {
      return { source: "github", status: "not_found" };
    }

    const userUrl: string = searchData.items[0].url;
    const userRes = await fetch(userUrl, { signal, headers });

    if (!userRes.ok) {
      return {
        source: "github",
        status: "error",
        message: `GitHub user fetch returned ${userRes.status}`,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user: any = await userRes.json();

    let lastPublicActivity: string | null = null;
    if (user.login) {
      try {
        const eventsUrl = `https://api.github.com/users/${encodeURIComponent(
          user.login
        )}/events/public?per_page=1`;
        const eventsRes = await fetch(eventsUrl, { signal, headers });
        if (eventsRes.ok) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const eventsData: any = await eventsRes.json();
          if (
            Array.isArray(eventsData) &&
            eventsData.length > 0 &&
            eventsData[0]?.created_at
          ) {
            lastPublicActivity = eventsData[0].created_at;
          }
        }
      } catch {
        // Non-fatal if public events call fails or times out
      }
    }

    return {
      source: "github",
      status: "found",
      data: {
        login: user.login ?? null,
        name: user.name ?? null,
        bio: user.bio ?? null,
        company: user.company ?? null,
        location: user.location ?? null,
        avatarUrl: user.avatar_url ?? null,
        profileUrl: user.html_url ?? `https://github.com/${user.login}`,
        followers: user.followers ?? 0,
        publicRepos: user.public_repos ?? 0,
        lastPublicActivity,
      },
    };
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      return { source: "github", status: "error", message: "Request timed out" };
    }
    return { source: "github", status: "error", message: "Network error" };
  }
}
