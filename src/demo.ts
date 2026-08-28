export const DEMO_STORAGE_KEY = "demo:integration-handoff-room:sample-v1";
export const DEMO_SCHEMA_VERSION = 1;

export interface DemoFixture {
  id: string;
  title: string;
  method: "POST";
  path: string;
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  redactions: string[];
}

export interface DemoDecision {
  id: string;
  title: string;
  detail: string;
  owner: string;
  role: string;
  dueDate: string;
  status: "Decided" | "Needs confirmation";
}

export interface DemoChecklistItem {
  id: string;
  label: string;
  required: boolean;
  completed: boolean;
}

export interface DemoAcknowledgement {
  reviewerName: string;
  acknowledgedAt: string;
  revisionId: string;
  disclaimerVersion: string;
}

export interface DemoState {
  schemaVersion: number;
  room: {
    id: string;
    title: string;
    client: string;
    release: string;
    revisionId: string;
    reviewer: string;
    fixture: DemoFixture;
    decisions: DemoDecision[];
    checklist: DemoChecklistItem[];
  };
  acknowledgement?: DemoAcknowledgement;
}

export interface HandoverRecord {
  schema_version: number;
  exported_at: string;
  room: {
    id: string;
    title: string;
    client: string;
    release: string;
    revision_id: string;
    disclaimer: string;
  };
  selected_fixture: DemoFixture;
  decisions: DemoDecision[];
  checklist: DemoChecklistItem[];
  acknowledgement: DemoAcknowledgement;
}

export function createSeedDemo(): DemoState {
  return {
    schemaVersion: DEMO_SCHEMA_VERSION,
    room: {
      id: "room_demo_payments_2026_08",
      title: "Payment status release",
      client: "Northstar Market",
      release: "Release 2026.08 · revision R03",
      revisionId: "R03",
      reviewer: "Morgan Chen · client reviewer",
      fixture: {
        id: "fixture_payment_status_paid",
        title: "Payment status — paid response",
        method: "POST",
        path: "/v1/payment-status",
        request: {
          payment_reference: "invoice-2048",
          requested_at: "2026-08-28T14:20:00Z"
        },
        response: {
          payment_reference: "invoice-2048",
          status: "paid",
          settled_at: "2026-08-28T14:19:42Z",
          currency: "USD"
        },
        redactions: ["No secret-like values found in this prepared sample."]
      },
      decisions: [
        {
          id: "decision-status-value",
          title: "Show the state as paid",
          detail: "Client screens use the status value from this response. They do not infer payment state from a redirect.",
          owner: "Dara Singh",
          role: "Agency API lead",
          dueDate: "Confirmed for this release",
          status: "Decided"
        },
        {
          id: "decision-retry-window",
          title: "Retry after 30 seconds",
          detail: "If a status is pending, the client waits 30 seconds before the next check. It stops after three checks.",
          owner: "Elliot Park",
          role: "Client operations",
          dueDate: "Confirm before launch",
          status: "Needs confirmation"
        }
      ],
      checklist: [
        {
          id: "check-status-value",
          label: "I can find the payment status in the sample response.",
          required: true,
          completed: false
        },
        {
          id: "check-retry-window",
          label: "I understand the 30-second retry decision.",
          required: true,
          completed: false
        },
        {
          id: "check-owner",
          label: "I know who owns the remaining launch confirmation.",
          required: true,
          completed: false
        }
      ]
    }
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isDemoState(value: unknown): value is DemoState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const state = value as Partial<DemoState>;
  return state.schemaVersion === DEMO_SCHEMA_VERSION && Boolean(state.room?.fixture) && Array.isArray(state.room?.checklist);
}

export function loadDemoState(storage: Storage | undefined = globalThis.localStorage): DemoState {
  try {
    const stored = storage?.getItem(DEMO_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as unknown;
      if (isDemoState(parsed)) {
        return parsed;
      }
    }
  } catch {
    // The sample remains usable when browser storage is unavailable.
  }

  const seed = createSeedDemo();
  saveDemoState(seed, storage);
  return seed;
}

export function saveDemoState(state: DemoState, storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // No real data is at risk; an in-memory render still lets the visitor try the room.
  }
}

export function resetDemoState(storage: Storage | undefined = globalThis.localStorage): DemoState {
  const seed = createSeedDemo();
  saveDemoState(seed, storage);
  return seed;
}

export function setChecklistItem(state: DemoState, itemId: string, completed: boolean): DemoState {
  const next = clone(state);
  const item = next.room.checklist.find((candidate) => candidate.id === itemId);
  if (item) {
    item.completed = completed;
  }
  return next;
}

export function completedRequiredCount(state: DemoState): number {
  return state.room.checklist.filter((item) => item.required && item.completed).length;
}

export function requiredCount(state: DemoState): number {
  return state.room.checklist.filter((item) => item.required).length;
}

export function canAcknowledge(state: DemoState, reviewerName: string, confirmed: boolean): boolean {
  return Boolean(reviewerName.trim()) && confirmed && completedRequiredCount(state) === requiredCount(state) && !state.acknowledgement;
}

export function acknowledgeDemo(state: DemoState, reviewerName: string, acknowledgedAt = new Date().toISOString()): DemoState {
  const trimmedName = reviewerName.trim();
  if (!canAcknowledge(state, trimmedName, true)) {
    throw new Error("Complete each required step and enter the reviewer name before recording the acknowledgement.");
  }

  const next = clone(state);
  next.acknowledgement = {
    reviewerName: trimmedName,
    acknowledgedAt,
    revisionId: next.room.revisionId,
    disclaimerVersion: "M1-demo-2026-08-28"
  };
  next.room.reviewer = `${trimmedName} · client reviewer`;
  return next;
}

export function createHandoverRecord(state: DemoState, exportedAt = new Date().toISOString()): HandoverRecord {
  if (!state.acknowledgement) {
    throw new Error("Record the acknowledgement before exporting this sample handover.");
  }

  return {
    schema_version: DEMO_SCHEMA_VERSION,
    exported_at: exportedAt,
    room: {
      id: state.room.id,
      title: state.room.title,
      client: state.room.client,
      release: state.room.release,
      revision_id: state.room.revisionId,
      disclaimer: "This sample acknowledgement records a review. It is not a contract or legal signature."
    },
    selected_fixture: clone(state.room.fixture),
    decisions: clone(state.room.decisions),
    checklist: clone(state.room.checklist),
    acknowledgement: clone(state.acknowledgement)
  };
}

export function fixturePayload(fixture: DemoFixture): string {
  return `${fixture.method} ${fixture.path}\nContent-Type: application/json\n\n${JSON.stringify(fixture.request, null, 2)}\n\n200 OK\nContent-Type: application/json\n\n${JSON.stringify(fixture.response, null, 2)}`;
}
