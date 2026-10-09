import { createVoicemailMessage } from "./voicemail.js";

// Voicemail text supplied by the account owner, used verbatim (version v1).
export const VOICEMAIL_SCRIPT = createVoicemailMessage(
  "v1",
  `Hi, this is Ava. I’m calling from Brian Darisay’s office. He’s a senior broker, and he’s currently expanding his agency beyond his Vegas, Phoenix, and San Diego offices, so he’s connecting with driven, newly licensed agents at the moment.

He also personally mentors his partners on how to create multi-handed income and build a business.

If that’s something you might be exploring at the moment—being part of a system-driven agency where you can build your own team—I’d be more than happy to set up a brief 10-minute introduction call with him so you can see if your goals align.

You can call me back or give me a text at 760-205-8290. Thank you, and have a nice day.`,
);
