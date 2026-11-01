import { describe, it, expect, beforeEach } from "vitest";
import { AppStorage } from "@/lib/persistence/storage";

describe("AppStorage Client Persistence", () => {
  beforeEach(() => {
    AppStorage.clearAllData();
  });

  it("loads default preferences when storage is empty", () => {
    const prefs = AppStorage.getPreferences();
    expect(prefs.theme).toBe("dark");
    expect(prefs.defaultRegulation).toBe("COMBINED");
  });

  it("updates and persists preferences", () => {
    AppStorage.savePreferences({ theme: "light", defaultRegulation: "GDPR_EU" });
    const updated = AppStorage.getPreferences();
    expect(updated.theme).toBe("light");
    expect(updated.defaultRegulation).toBe("GDPR_EU");
  });

  it("persists still-using IDs and deleted account IDs", () => {
    const ids = new Set(["google.com", "github.com"]);
    AppStorage.saveStillUsingIds(ids);

    const loaded = AppStorage.getStillUsingIds();
    expect(loaded.has("google.com")).toBe(true);
    expect(loaded.has("github.com")).toBe(true);
    expect(loaded.has("other.com")).toBe(false);
  });

  it("records scan history adhering to max retention limit", () => {
    AppStorage.savePreferences({ maxStoredScans: 2 });

    AppStorage.recordScan({
      userEmail: "test@example.com",
      totalPlatforms: 10,
      totalAccounts: 8,
      inactiveAccounts: 3,
      highRiskAccounts: 1,
      overallRiskScore: 42,
    });

    AppStorage.recordScan({
      userEmail: "test@example.com",
      totalPlatforms: 12,
      totalAccounts: 9,
      inactiveAccounts: 4,
      highRiskAccounts: 2,
      overallRiskScore: 48,
    });

    AppStorage.recordScan({
      userEmail: "test@example.com",
      totalPlatforms: 15,
      totalAccounts: 11,
      inactiveAccounts: 5,
      highRiskAccounts: 2,
      overallRiskScore: 50,
    });

    const history = AppStorage.getScanHistory();
    expect(history).toHaveLength(2);
    expect(history[0].totalPlatforms).toBe(15);
  });
});
