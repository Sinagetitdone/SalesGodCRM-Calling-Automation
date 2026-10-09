import type { VoicemailMessage } from "./voicemail.js";
import { VOICEMAIL_SCRIPT } from "./voicemail-script.js";

export type CallOutcome = "ANSWERED" | "VOICEMAIL" | "NO_ANSWER";

export type FollowUp =
  | { readonly action: "NONE" }
  | { readonly action: "AI_CONVERSATION" }
  | {
      readonly action: "LEAVE_VOICEMAIL";
      readonly voicemailVersion: string;
      readonly text: string;
    }
  | { readonly action: "RETRY_LATER" };

// Decides the next step for a dispatched call. Calls that were not dispatched
// (blocked or failed) have no follow-up.
export function followUpFor(
  call: {
    readonly state: string;
    readonly outcome?: CallOutcome;
  },
  voicemail: VoicemailMessage = VOICEMAIL_SCRIPT,
): FollowUp {
  if (call.state !== "DISPATCHED") return { action: "NONE" };

  switch (call.outcome) {
    case "ANSWERED":
      return { action: "AI_CONVERSATION" };
    case "VOICEMAIL":
      return {
        action: "LEAVE_VOICEMAIL",
        voicemailVersion: voicemail.version,
        text: voicemail.text,
      };
    default:
      return { action: "RETRY_LATER" };
  }
}
