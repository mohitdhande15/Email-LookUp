/**
 * Privacy-First Persistence Layer with In-Memory SSR Fallback.
 * Manages client-side storage for scan results, preferences, still-in-use tracking,
 * and security state without storing sensitive OAuth tokens or raw message content.
 */

export interface ScanHistoryRecord {
  id: string;
  timestamp: string;
  userEmail: string;
  totalPlatforms: number;
  totalAccounts: number;
  inactiveAccounts: number;
  highRiskAccounts: number;
  overallRiskScore: number;
}

export interface UserPreferences {
  theme: "dark" | "light" | "system";
  defaultRegulation: "DPDP_INDIA" | "GDPR_EU" | "CCPA_US" | "COMBINED";
  autoSaveHistory: boolean;
  maxStoredScans: number;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "dark",
  defaultRegulation: "COMBINED",
  autoSaveHistory: true,
  maxStoredScans: 20,
};

const STORAGE_KEYS = {
  PREFERENCES: "email_lookup_prefs_v1",
  STILL_USING: "email_lookup_still_using_v1",
  DELETED_ACCOUNTS: "email_lookup_deleted_v1",
  SCAN_HISTORY: "email_lookup_history_v1",
  LATEST_SCAN: "email_lookup_latest_scan_v1",
};

// In-memory fallback map for Node/SSR environments
const memoryStore = new Map<string, string>();

function getItem(key: string): string | null {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      // Fallback if localStorage throws SecurityError in strict iframes
      return memoryStore.get(key) ?? null;
    }
  }
  return memoryStore.get(key) ?? null;
}

function setItem(key: string, value: string): void {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(key, value);
      return;
    } catch {
      // Fallback
      memoryStore.set(key, value);
      return;
    }
  }
  memoryStore.set(key, value);
}

function removeItem(key: string): void {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      memoryStore.delete(key);
    }
  }
  memoryStore.delete(key);
}

export const AppStorage = {
  getPreferences(): UserPreferences {
    try {
      const raw = getItem(STORAGE_KEYS.PREFERENCES);
      if (!raw) return DEFAULT_PREFERENCES;
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_PREFERENCES;
    }
  },

  savePreferences(prefs: Partial<UserPreferences>): void {
    try {
      const current = AppStorage.getPreferences();
      const updated = { ...current, ...prefs };
      setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(updated));
    } catch (e) {
      console.warn("Failed to persist user preferences", e);
    }
  },

  getStillUsingIds(): Set<string> {
    try {
      const raw = getItem(STORAGE_KEYS.STILL_USING);
      if (!raw) return new Set();
      const list = JSON.parse(raw);
      return new Set(Array.isArray(list) ? list : []);
    } catch {
      return new Set();
    }
  },

  saveStillUsingIds(ids: Set<string>): void {
    try {
      setItem(STORAGE_KEYS.STILL_USING, JSON.stringify(Array.from(ids)));
    } catch (e) {
      console.warn("Failed to persist still using accounts", e);
    }
  },

  getDeletedAccountIds(): Set<string> {
    try {
      const raw = getItem(STORAGE_KEYS.DELETED_ACCOUNTS);
      if (!raw) return new Set();
      const list = JSON.parse(raw);
      return new Set(Array.isArray(list) ? list : []);
    } catch {
      return new Set();
    }
  },

  saveDeletedAccountIds(ids: Set<string>): void {
    try {
      setItem(STORAGE_KEYS.DELETED_ACCOUNTS, JSON.stringify(Array.from(ids)));
    } catch (e) {
      console.warn("Failed to persist deleted account records", e);
    }
  },

  getScanHistory(): ScanHistoryRecord[] {
    try {
      const raw = getItem(STORAGE_KEYS.SCAN_HISTORY);
      if (!raw) return [];
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  },

  recordScan(record: Omit<ScanHistoryRecord, "id" | "timestamp">): void {
    try {
      const history = AppStorage.getScanHistory();
      const prefs = AppStorage.getPreferences();

      const newEntry: ScanHistoryRecord = {
        ...record,
        id: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
      };

      const updated = [newEntry, ...history].slice(0, prefs.maxStoredScans);
      setItem(STORAGE_KEYS.SCAN_HISTORY, JSON.stringify(updated));
    } catch (e) {
      console.warn("Failed to record scan history", e);
    }
  },

  clearAllData(): void {
    try {
      Object.values(STORAGE_KEYS).forEach((k) => removeItem(k));
      memoryStore.clear();
    } catch (e) {
      console.warn("Failed to clear local persistence data", e);
    }
  },
};
