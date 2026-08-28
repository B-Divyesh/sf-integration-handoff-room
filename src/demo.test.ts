import { describe, expect, it } from "vitest";
import {
  acknowledgeDemo,
  canAcknowledge,
  completedRequiredCount,
  createHandoverRecord,
  createSeedDemo,
  resetDemoState,
  setChecklistItem
} from "./demo";

describe("the isolated sample room", () => {
  it("starts with a realistic, sanitized payment-status release", () => {
    const state = createSeedDemo();

    expect(state.room.title).toBe("Payment status release");
    expect(state.room.fixture.path).toBe("/v1/payment-status");
    expect(state.room.fixture.redactions).toHaveLength(1);
    expect(state.room.decisions).toHaveLength(2);
  });

  it("requires every sample review step before an acknowledgement", () => {
    let state = createSeedDemo();
    expect(canAcknowledge(state, "Taylor", true)).toBe(false);

    for (const item of state.room.checklist) {
      state = setChecklistItem(state, item.id, true);
    }

    expect(completedRequiredCount(state)).toBe(3);
    expect(canAcknowledge(state, "Taylor", true)).toBe(true);
  });

  it("serializes the selected fixture, decisions, checklist, and acknowledgement", () => {
    let state = createSeedDemo();
    for (const item of state.room.checklist) {
      state = setChecklistItem(state, item.id, true);
    }
    state = acknowledgeDemo(state, "Taylor Reed", "2026-08-28T15:00:00.000Z");

    const handover = createHandoverRecord(state, "2026-08-28T15:01:00.000Z");
    expect(handover.selected_fixture.title).toContain("Payment status");
    expect(handover.decisions).toHaveLength(2);
    expect(handover.checklist).toHaveLength(3);
    expect(handover.acknowledgement.reviewerName).toBe("Taylor Reed");
  });

  it("resets a provided storage adapter to a new seed", () => {
    const entries = new Map<string, string>();
    const storage: Storage = {
      get length() {
        return entries.size;
      },
      clear: () => entries.clear(),
      getItem: (key) => entries.get(key) ?? null,
      key: (index) => [...entries.keys()][index] ?? null,
      removeItem: (key) => entries.delete(key),
      setItem: (key, value) => entries.set(key, value)
    };

    const reset = resetDemoState(storage);
    expect(reset.room.checklist.every((item) => !item.completed)).toBe(true);
    expect([...entries.keys()]).toEqual(["demo:integration-handoff-room:sample-v1"]);
  });
});
