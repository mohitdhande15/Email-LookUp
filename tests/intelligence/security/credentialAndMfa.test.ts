import { describe, it, expect } from "vitest";
import { PasswordEventDetector } from "@/lib/intelligence/security/passwordEventDetector";
import { MfaEventDetector } from "@/lib/intelligence/security/mfaEventDetector";
import { RecoveryEventDetector } from "@/lib/intelligence/security/recoveryEventDetector";

describe("Credential & MFA Event Detectors", () => {
  it("distinguishes password changed from password reset request", () => {
    const changed = PasswordEventDetector.analyze(
      "Your password was changed",
      "The password for your GitHub account was updated on Oct 14."
    );
    expect(changed.isPasswordEvent).toBe(true);
    expect(changed.eventType).toBe("PASSWORD_CHANGED");
    expect(changed.actionStatus).toBe("COMPLETED");

    const requested = PasswordEventDetector.analyze(
      "Reset your password",
      "Click the link below to reset your password. If you didn't request this, ignore it."
    );
    expect(requested.isPasswordEvent).toBe(true);
    expect(requested.eventType).toBe("PASSWORD_RESET");
    expect(requested.actionStatus).toBe("ATTEMPTED");
  });

  it("flags MFA disabled as CRITICAL severity", () => {
    const disabled = MfaEventDetector.analyze(
      "Security Notice: Two-factor authentication was disabled",
      "Two-factor authentication has been turned off for your account."
    );
    expect(disabled.isMfaEvent).toBe(true);
    expect(disabled.eventType).toBe("MFA_DISABLED");
    expect(disabled.severity).toBe("CRITICAL");
  });

  it("flags MFA enabled as informational", () => {
    const enabled = MfaEventDetector.analyze(
      "Two-factor authentication enabled",
      "You successfully configured two-factor authentication."
    );
    expect(enabled.isMfaEvent).toBe(true);
    expect(enabled.eventType).toBe("MFA_ENABLED");
    expect(enabled.severity).toBe("INFO");
  });

  it("detects recovery email and phone modifications", () => {
    const recEmail = RecoveryEventDetector.analyze(
      "Recovery email was changed",
      "Your recovery email address was updated to another address."
    );
    expect(recEmail.isRecoveryEvent).toBe(true);
    expect(recEmail.eventType).toBe("RECOVERY_INFO_CHANGED");
    expect(recEmail.severity).toBe("HIGH");

    const recPhone = RecoveryEventDetector.analyze(
      "Recovery phone was updated",
      "Your SMS verification phone was changed."
    );
    expect(recPhone.isRecoveryEvent).toBe(true);
  });
});
