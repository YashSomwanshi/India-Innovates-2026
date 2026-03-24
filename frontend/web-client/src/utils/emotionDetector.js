/**
 * emotionDetector.js — Keyword-based emotion detection from text
 *
 * Scans LLM response text for emotion-indicating keywords and returns
 * the dominant emotion string, which maps to a facial expression preset.
 */

const EMOTION_KEYWORDS = {
  happy: [
    "hello", "welcome", "great", "wonderful", "congratulations",
    "thank", "happy", "glad", "excellent", "fantastic", "amazing",
    "good news", "pleasure", "delighted", "cheers", "bravo",
    "well done", "awesome", "success", "celebrate", "joy",
  ],
  serious: [
    "danger", "important", "warning", "critical", "urgent",
    "caution", "beware", "emergency", "attention", "careful",
    "serious", "severe", "mandatory", "required", "essential",
    "crucial", "vital", "necessary", "immediately",
  ],
  sad: [
    "sorry", "unfortunately", "regret", "loss", "failed",
    "apologize", "condolence", "tragic", "sad", "disappoint",
    "unable", "cannot", "impossible", "mistake",
  ],
  surprised: [
    "wow", "incredible", "unbelievable", "shocking", "astonishing",
    "remarkable", "extraordinary", "unexpected",
  ],
};

/**
 * Detect the dominant emotion in a text string.
 *
 * @param {string} text — The text to analyze
 * @returns {string} — "happy" | "serious" | "sad" | "surprised" | "neutral"
 */
export function detectEmotion(text) {
  if (!text) return "neutral";

  const lower = text.toLowerCase();
  const scores = {};

  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    scores[emotion] = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        scores[emotion] += 1;
      }
    }
  }

  // Find the emotion with the highest score
  let best = "neutral";
  let bestScore = 0;
  for (const [emotion, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      best = emotion;
    }
  }

  return best;
}
