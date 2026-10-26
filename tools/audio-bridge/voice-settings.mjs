// One definition per UI preset; a delivery style can share a base API voice.
const voicePresets = {
  marin: { apiVoice: 'marin', style: 'calm, warm and relaxed' },
  coral: { apiVoice: 'coral', style: 'warm, friendly and conversational' },
  sage: { apiVoice: 'sage', style: 'measured, composed and professional' },
  shimmer: { apiVoice: 'shimmer', style: 'bright, clear and upbeat' },
  marin_confident: { apiVoice: 'marin', style: 'confident, assured and direct, with crisp diction and a purposeful cadence' },
};

export const callVoices = Object.keys(voicePresets);
export const defaultCallVoice = 'marin';
export const normalizeVoice = voice => callVoices.includes(voice) ? voice : defaultCallVoice;
export const apiVoice = voice => voicePresets[normalizeVoice(voice)].apiVoice;
export function speakingStyle(voice) {
  const { style } = voicePresets[normalizeVoice(voice)];
  return `Voice delivery: use a natural feminine-sounding voice, ${style}. Keep clear diction and a comfortable pitch. Be confident without sounding aggressive, theatrical or rushed. This is a delivery preference, not a claim of human identity, age or gender.`;
}
