import { describe, it, expect } from "vitest";
import { CleanupStateMachine } from "@/lib/intelligence/privacy/cleanup/cleanupStateMachine";
import { DeletionDifficultyEvaluator } from "@/lib/intelligence/privacy/cleanup/deletionDifficulty";

describe("Account Cleanup State Machine & Deletion Difficulty", () => {
  it("rates deletion difficulties accurately based on verified platform workflows", () => {
    const github = DeletionDifficultyEvaluator.evaluateDifficulty("github.com");
    expect(github.rating).toBe("EASY");
    expect(github.hasDirectLink).toBe(true);

    const netflix = DeletionDifficultyEvaluator.evaluateDifficulty("netflix.com");
    expect(netflix.rating).toBe("MODERATE");
    expect(netflix.hasDirectLink).toBe(true);

    const lexisnexis = DeletionDifficultyEvaluator.evaluateDifficulty("lexisnexis.com");
    expect(lexisnexis.rating).toBe("DIFFICULT");

    const unknown = DeletionDifficultyEvaluator.evaluateDifficulty("unknown-random-service.xyz");
    expect(unknown.rating).toBe("UNKNOWN");
    expect(unknown.hasDirectLink).toBe(false);
  });

  it("permits valid lifecycle state transitions and maintains audit history", () => {
    let record = CleanupStateMachine.createAccountRecord({
      userId: "user_123",
      domain: "netflix.com",
      serviceName: "Netflix",
      daysInactive: 200,
    });

    expect(record.status).toBe("DISCOVERED");
    expect(record.statusHistory.length).toBe(1);

    // Transition 1: DISCOVERED -> CLEANUP_PLANNED
    record = CleanupStateMachine.transitionAccount(record, "CLEANUP_PLANNED", "User opted to clean up");
    expect(record.status).toBe("CLEANUP_PLANNED");
    expect(record.statusHistory.length).toBe(2);

    // Transition 2: CLEANUP_PLANNED -> DELETION_REQUESTED
    record = CleanupStateMachine.transitionAccount(record, "DELETION_REQUESTED", "Sent erasure email");
    expect(record.status).toBe("DELETION_REQUESTED");

    // Transition 3: DELETION_REQUESTED -> DELETION_CONFIRMED
    record = CleanupStateMachine.transitionAccount(record, "DELETION_CONFIRMED", "Received confirmation notice");
    expect(record.status).toBe("DELETION_CONFIRMED");
    expect(record.statusHistory.length).toBe(4);
  });

  it("prohibits invalid lifecycle transitions", () => {
    const record = CleanupStateMachine.createAccountRecord({
      userId: "user_123",
      domain: "spotify.com",
      serviceName: "Spotify",
    });

    expect(record.status).toBe("DISCOVERED");

    // Cannot jump straight from DISCOVERED to DELETION_CONFIRMED
    expect(() => {
      CleanupStateMachine.transitionAccount(record, "DELETION_CONFIRMED");
    }).toThrow(/Invalid lifecycle transition/);
  });
});
