// Built-in Realtime voices also supported by the voicemail speech model.
export const callVoices = ['cedar', 'ash', 'echo', 'ballad', 'marin'];
export const defaultCallVoice = 'cedar';
export function speakingStyle(voice) {
  return voice === 'cedar'
    ? 'Voice delivery: aim for a confident young-adult masculine sound, approximately age 25 to 30 in perceived tone, with clear diction, calm assurance and natural warmth. Avoid sounding aggressive, theatrical or rushed. This describes delivery only; never claim to be a human or claim a real age.'
    : 'Voice delivery: speak with calm confidence, clear diction and natural warmth. Be professional without sounding aggressive, theatrical or rushed.';
}
