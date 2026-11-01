import { describe, it, expect } from "vitest";
import { DeviceEventAnalyzer } from "@/lib/intelligence/security/deviceEventAnalyzer";
import { ApiKeyEventDetector } from "@/lib/intelligence/security/apiKeyEventDetector";

describe("Device, Location & Developer Event Analyzer", () => {
  it("extracts public IP addresses while ignoring localhost/private subnets", () => {
    const text = "Login detected from IP: 198.51.100.42 and proxy 127.0.0.1";
    const ip = DeviceEventAnalyzer.extractIpAddress(text);
    expect(ip).toBe("198.51.100.42");
  });

  it("extracts device and browser models", () => {
    const text = "Sign-in from Google Chrome on Apple MacBook Pro in London";
    expect(DeviceEventAnalyzer.extractDevice(text)).toBe("Apple Mac");
    expect(DeviceEventAnalyzer.extractBrowser(text)).toBe("Google Chrome");
  });

  it("marks extracted location as estimated to enforce epistemic honesty", () => {
    const text = "Sign-in observed from Location: Bengaluru, India";
    const loc = DeviceEventAnalyzer.extractLocation(text);
    expect(loc.location).toBe("Bengaluru, India");
    expect(loc.isLocationEstimated).toBe(true);
  });

  it("safely decodes Base64URL text bodies without buffer error", () => {
    // "Security alert: suspicious login" in base64url
    const raw = Buffer.from("Security alert: suspicious login").toString("base64url");
    const decoded = DeviceEventAnalyzer.decodeBase64Url(raw);
    expect(decoded).toBe("Security alert: suspicious login");
  });

  it("detects developer API key, token revocation, and OAuth events", () => {
    const apiKey = ApiKeyEventDetector.analyze(
      "New API key created for OpenAI Platform",
      "Secret key sk-proj-... was generated."
    );
    expect(apiKey.isDeveloperOrAccountEvent).toBe(true);
    expect(apiKey.eventType).toBe("API_KEY_CREATED");
    expect(apiKey.severity).toBe("HIGH");

    const oauth = ApiKeyEventDetector.analyze(
      "You authorized a new application",
      "Vercel was granted delegated access to your repositories."
    );
    expect(oauth.eventType).toBe("OAUTH_APP_AUTHORIZED");

    const ssh = ApiKeyEventDetector.analyze(
      "A new SSH key was added to your account",
      "Key titled 'Work Laptop' was registered."
    );
    expect(ssh.eventType).toBe("SSH_KEY_ADDED");
  });
});
