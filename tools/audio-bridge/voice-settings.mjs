// Built-in Realtime voices also supported by the voicemail speech model.
export const callVoices = ['marin', 'coral', 'sage', 'shimmer', 'marin_confident'];
export const defaultCallVoice = 'marin';
export const normalizeVoice = voice => callVoices.includes(voice) ? voice : defaultCallVoice;
export const apiVoice = voice => normalizeVoice(voice) === 'marin_confident' ? 'marin' : normalizeVoice(voice);
export function speakingStyle(voice) {
  const style = { marin: 'calm, warm and relaxed', coral: 'warm, friendly and conversational', sage: 'measured, composed and professional', shimmer: 'bright, clear and upbeat', marin_confident: 'confident, assured and direct, with crisp diction and a purposeful cadence' }[normalizeVoice(voice)];
  return `Voice delivery: use a natural feminine-sounding voice, ${style}. Keep clear diction and a comfortable pitch. Be confident without sounding aggressive, theatrical or rushed. This is a delivery preference, not a claim of human identity, age or gender.`;
}
