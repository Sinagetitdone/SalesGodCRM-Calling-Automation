export type ConversationStage =
  | "GREETING"
  | "SCHEDULING"
  | "DONE"
  | "OPTED_OUT";

export interface ConversationTurn {
  readonly reply: string;
  readonly stage: ConversationStage;
  readonly optedOut: boolean;
}

// Stated up front so the person knows they are talking to an automated system.
export const OPENING_LINE =
  "Hi, this is Ava, an automated assistant calling on behalf of a senior broker's office. " +
  "Would you like to set up a brief 10-minute introduction call with him? " +
  "You can say stop at any time to opt out.";

const OPT_OUT_PATTERN =
  /\b(stop|remove me|unsubscribe|do not call|don'?t call|not interested|no thank you|no thanks)\b/i;

const YES_PATTERN =
  /\b(yes|yeah|yep|sure|okay|ok|interested|sounds good|tell me more)\b/i;

export function openingTurn(): ConversationTurn {
  return { reply: OPENING_LINE, stage: "GREETING", optedOut: false };
}

export function nextTurn(stage: ConversationStage, message: string): ConversationTurn {
  if (stage === "OPTED_OUT") {
    return {
      reply: "You have opted out, so no further messages will be sent.",
      stage,
      optedOut: true,
    };
  }

  // Opt-out is checked first, whatever the stage, so it can never be missed.
  if (OPT_OUT_PATTERN.test(message)) {
    return {
      reply: "Understood. I will not call this number again. Have a nice day.",
      stage: "OPTED_OUT",
      optedOut: true,
    };
  }

  if (stage === "SCHEDULING") {
    return {
      reply: "Thank you. Someone from the office will follow up to confirm a time. Goodbye.",
      stage: "DONE",
      optedOut: false,
    };
  }

  if (stage === "DONE") {
    return { reply: "Thank you, goodbye.", stage, optedOut: false };
  }

  if (YES_PATTERN.test(message)) {
    return {
      reply: "Great. What day and time work for a 10-minute introduction call?",
      stage: "SCHEDULING",
      optedOut: false,
    };
  }

  return {
    reply:
      "Sorry, I did not catch that. Would you like a 10-minute introduction call? " +
      "You can also say stop to opt out.",
    stage: "GREETING",
    optedOut: false,
  };
}
