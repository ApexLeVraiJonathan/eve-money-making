export type TestState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "success"; at: number }
  | { kind: "error"; message: string };
