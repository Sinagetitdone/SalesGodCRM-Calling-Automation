export interface VoicemailMessage {
  readonly version: string;
  readonly text: string;
}

export function createVoicemailMessage(version: string, text: string): VoicemailMessage {
  if (!version.trim()) throw new Error("Voicemail version is required");
  if (!text.trim()) throw new Error("Voicemail text is required");

  return { version, text };
}
