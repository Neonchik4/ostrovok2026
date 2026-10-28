export type GhostMood = "idle" | "thinking" | "speaking" | "happy" | "flying";

type ThoughtStepTag =
  | "intent"
  | "dom"
  | "action"
  | "success"
  | "scan"
  | "error"
  | "ai";

export interface ThoughtStep {
  id: string;
  tag: ThoughtStepTag;
  text: string;
  timestamp: number;
}

export interface GhostAction {
  type: "toggle_filter" | "set_price" | "set_stars" | "select_hotel" | "reset" | "prompt";
  key?: string;
  value?: unknown;
  text?: string;
}

export interface GhostChatMessage {
  id: string;
  role: "user" | "ghost";
  text: string;
}
