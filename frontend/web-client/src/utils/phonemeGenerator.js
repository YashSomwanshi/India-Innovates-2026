/**
 * phonemeGenerator.js — Universal multilingual text-to-viseme converter
 *
 * Maps characters from ANY language (Hindi, Tamil, Telugu, Bengali, Marathi,
 * English, etc.) to viseme sound groups for lip sync animation.
 *
 * Strategy: Instead of exact phonemes, we classify each character into a
 * universal sound group based on Unicode block + articulatory properties.
 */

// ══════════════════════════════════════════════════
// UNIVERSAL SOUND GROUPS → Viseme mapping
// ══════════════════════════════════════════════════
// These map to the actual morph target names in the GLB model
const SOUND_GROUP = {
  OPEN_VOWEL:   "AA",     // → viseme_aa (open mouth: अ आ ா ా a)
  MID_VOWEL:    "EH",     // → viseme_E  (mid mouth: ए ே ే e)
  CLOSE_VOWEL:  "IH",     // → viseme_I  (narrow: इ ி ి i)
  ROUND_VOWEL:  "AA",     // → viseme_O  (rounded: ओ ோ ో o)
  HIGH_VOWEL:   "UH",     // → viseme_U  (tight round: उ ூ ూ u)
  BILABIAL:     "P",      // → viseme_PP (closed lips: प म ب b m p)
  LABIODENTAL:  "F",      // → viseme_FF (teeth-lip: फ f v)
  DENTAL:       "T",      // → viseme_DD (tongue-teeth: त द ت t d)
  ALVEOLAR:     "N",      // → viseme_nn (tongue-ridge: न ன న n l)
  RETROFLEX:    "T",      // → viseme_DD (curled tongue: ट ड ண ట)
  PALATAL:      "CH",     // → viseme_CH (palate: च छ ச చ ch j sh)
  VELAR:        "K",      // → viseme_kk (back: क ग க క k g)
  SIBILANT:     "S",      // → viseme_SS (hissing: स श ས స s z)
  RHOTIC:       "R",      // → viseme_RR (r-sound: र ர ర r)
  NASAL:        "N",      // → viseme_nn (nasal: ण ñ ng)
  ASPIRATE:     "HH",     // → viseme_SS (breathy: ह హ ஹ h)
  SILENCE:      "SIL",    // → viseme_sil
};

// ══════════════════════════════════════════════════
// DEVANAGARI (Hindi, Marathi, Sanskrit) — U+0900-097F
// ══════════════════════════════════════════════════
function classifyDevanagari(code) {
  // Vowels: अ(0905) आ(0906) इ(0907) ई(0908) उ(0909) ऊ(090A) ऋ(090B)
  //         ए(090F) ऐ(0910) ओ(0913) औ(0914)
  // Vowel matras: ा(093E) ि(093F) ी(0940) ु(0941) ू(0942) ृ(0943)
  //              े(0947) ै(0948) ो(094B) ौ(094C)
  if (code === 0x0905 || code === 0x0906 || code === 0x093E) return SOUND_GROUP.OPEN_VOWEL;
  if (code === 0x0907 || code === 0x0908 || code === 0x093F || code === 0x0940) return SOUND_GROUP.CLOSE_VOWEL;
  if (code === 0x0909 || code === 0x090A || code === 0x0941 || code === 0x0942) return SOUND_GROUP.HIGH_VOWEL;
  if (code === 0x090F || code === 0x0910 || code === 0x0947 || code === 0x0948) return SOUND_GROUP.MID_VOWEL;
  if (code === 0x0913 || code === 0x0914 || code === 0x094B || code === 0x094C) return SOUND_GROUP.ROUND_VOWEL;
  if (code === 0x090B || code === 0x0943) return SOUND_GROUP.RHOTIC;

  // Consonants: classify by place of articulation
  // Velars: क(0915) ख(0916) ग(0917) घ(0918) ङ(0919)
  if (code >= 0x0915 && code <= 0x0919) return code === 0x0919 ? SOUND_GROUP.NASAL : SOUND_GROUP.VELAR;
  // Palatals: च(091A) छ(091B) ज(091C) झ(091D) ञ(091E)
  if (code >= 0x091A && code <= 0x091E) return code === 0x091E ? SOUND_GROUP.NASAL : SOUND_GROUP.PALATAL;
  // Retroflexes: ट(091F) ठ(0920) ड(0921) ढ(0922) ण(0923)
  if (code >= 0x091F && code <= 0x0923) return code === 0x0923 ? SOUND_GROUP.NASAL : SOUND_GROUP.RETROFLEX;
  // Dentals: त(0924) थ(0925) द(0926) ध(0927) न(0928)
  if (code >= 0x0924 && code <= 0x0928) return code === 0x0928 ? SOUND_GROUP.ALVEOLAR : SOUND_GROUP.DENTAL;
  // Labials: प(092A) फ(092B) ब(092C) भ(092D) म(092E)
  if (code === 0x092A || code === 0x092C || code === 0x092D || code === 0x092E) return SOUND_GROUP.BILABIAL;
  if (code === 0x092B) return SOUND_GROUP.LABIODENTAL; // फ is closer to 'f'
  // Semi-vowels & others
  if (code === 0x092F) return SOUND_GROUP.CLOSE_VOWEL; // य (ya)
  if (code === 0x0930) return SOUND_GROUP.RHOTIC;       // र (ra)
  if (code === 0x0932) return SOUND_GROUP.ALVEOLAR;     // ल (la)
  if (code === 0x0935) return SOUND_GROUP.LABIODENTAL;  // व (va)
  // Sibilants: श(0936) ष(0937) स(0938)
  if (code >= 0x0936 && code <= 0x0938) return SOUND_GROUP.SIBILANT;
  // ह(0939)
  if (code === 0x0939) return SOUND_GROUP.ASPIRATE;
  // Halant / virama (094D) — skip, it modifies previous consonant
  if (code === 0x094D) return null;
  // Anusvara (0902) / Chandrabindu (0901) — nasal
  if (code === 0x0901 || code === 0x0902) return SOUND_GROUP.NASAL;
  // Visarga (0903)
  if (code === 0x0903) return SOUND_GROUP.ASPIRATE;
  // Any other Devanagari character
  if (code >= 0x0900 && code <= 0x097F) return SOUND_GROUP.OPEN_VOWEL;
  return null;
}

// ══════════════════════════════════════════════════
// TAMIL — U+0B80-0BFF
// ══════════════════════════════════════════════════
function classifyTamil(code) {
  // Tamil vowels: அ(0B85) ஆ(0B86) இ(0B87) ஈ(0B88) உ(0B89) ஊ(0B8A)
  //              எ(0B8E) ஏ(0B8F) ஐ(0B90) ஒ(0B92) ஓ(0B93) ஔ(0B94)
  if (code === 0x0B85 || code === 0x0B86) return SOUND_GROUP.OPEN_VOWEL;
  if (code === 0x0B87 || code === 0x0B88) return SOUND_GROUP.CLOSE_VOWEL;
  if (code === 0x0B89 || code === 0x0B8A) return SOUND_GROUP.HIGH_VOWEL;
  if (code === 0x0B8E || code === 0x0B8F || code === 0x0B90) return SOUND_GROUP.MID_VOWEL;
  if (code === 0x0B92 || code === 0x0B93 || code === 0x0B94) return SOUND_GROUP.ROUND_VOWEL;
  // Tamil vowel signs (matras)
  if (code === 0x0BBE) return SOUND_GROUP.OPEN_VOWEL;
  if (code === 0x0BBF || code === 0x0BC0) return SOUND_GROUP.CLOSE_VOWEL;
  if (code === 0x0BC1 || code === 0x0BC2) return SOUND_GROUP.HIGH_VOWEL;
  if (code === 0x0BC6 || code === 0x0BC7 || code === 0x0BC8) return SOUND_GROUP.MID_VOWEL;
  if (code === 0x0BCA || code === 0x0BCB || code === 0x0BCC) return SOUND_GROUP.ROUND_VOWEL;
  // Tamil consonants
  if (code === 0x0B95) return SOUND_GROUP.VELAR;      // க
  if (code === 0x0B99) return SOUND_GROUP.NASAL;       // ங
  if (code === 0x0B9A) return SOUND_GROUP.PALATAL;     // ச
  if (code === 0x0B9E) return SOUND_GROUP.NASAL;       // ஞ
  if (code === 0x0B9F) return SOUND_GROUP.RETROFLEX;   // ட
  if (code === 0x0BA3) return SOUND_GROUP.NASAL;       // ண
  if (code === 0x0BA4) return SOUND_GROUP.DENTAL;      // த
  if (code === 0x0BA8 || code === 0x0BA9) return SOUND_GROUP.ALVEOLAR; // ந ன
  if (code === 0x0BAA) return SOUND_GROUP.BILABIAL;    // ப
  if (code === 0x0BAE) return SOUND_GROUP.BILABIAL;    // ம
  if (code === 0x0BAF) return SOUND_GROUP.CLOSE_VOWEL; // ய
  if (code === 0x0BB0 || code === 0x0BB1) return SOUND_GROUP.RHOTIC; // ர ற
  if (code === 0x0BB2 || code === 0x0BB3 || code === 0x0BB4) return SOUND_GROUP.ALVEOLAR; // ல ள ழ
  if (code === 0x0BB5) return SOUND_GROUP.LABIODENTAL; // வ
  if (code === 0x0BB6 || code === 0x0BB7 || code === 0x0BB8) return SOUND_GROUP.SIBILANT; // ஶ ஷ ஸ
  if (code === 0x0BB9) return SOUND_GROUP.ASPIRATE;    // ஹ
  if (code === 0x0BCD) return null; // Virama — skip
  // Fallback for Tamil range
  if (code >= 0x0B80 && code <= 0x0BFF) return SOUND_GROUP.OPEN_VOWEL;
  return null;
}

// ══════════════════════════════════════════════════
// TELUGU — U+0C00-0C7F
// ══════════════════════════════════════════════════
function classifyTelugu(code) {
  if (code === 0x0C05 || code === 0x0C06 || code === 0x0C3E) return SOUND_GROUP.OPEN_VOWEL;
  if (code === 0x0C07 || code === 0x0C08 || code === 0x0C3F || code === 0x0C40) return SOUND_GROUP.CLOSE_VOWEL;
  if (code === 0x0C09 || code === 0x0C0A || code === 0x0C41 || code === 0x0C42) return SOUND_GROUP.HIGH_VOWEL;
  if (code === 0x0C0F || code === 0x0C10 || code === 0x0C47 || code === 0x0C48) return SOUND_GROUP.MID_VOWEL;
  if (code === 0x0C13 || code === 0x0C14 || code === 0x0C4B || code === 0x0C4C) return SOUND_GROUP.ROUND_VOWEL;
  // Telugu consonants — same articulatory grouping as Devanagari
  if (code >= 0x0C15 && code <= 0x0C19) return code === 0x0C19 ? SOUND_GROUP.NASAL : SOUND_GROUP.VELAR;
  if (code >= 0x0C1A && code <= 0x0C1E) return code === 0x0C1E ? SOUND_GROUP.NASAL : SOUND_GROUP.PALATAL;
  if (code >= 0x0C1F && code <= 0x0C23) return code === 0x0C23 ? SOUND_GROUP.NASAL : SOUND_GROUP.RETROFLEX;
  if (code >= 0x0C24 && code <= 0x0C28) return code === 0x0C28 ? SOUND_GROUP.ALVEOLAR : SOUND_GROUP.DENTAL;
  if (code === 0x0C2A || code === 0x0C2C || code === 0x0C2D || code === 0x0C2E) return SOUND_GROUP.BILABIAL;
  if (code === 0x0C2B) return SOUND_GROUP.LABIODENTAL;
  if (code === 0x0C2F) return SOUND_GROUP.CLOSE_VOWEL;
  if (code === 0x0C30 || code === 0x0C31) return SOUND_GROUP.RHOTIC;
  if (code === 0x0C32 || code === 0x0C33) return SOUND_GROUP.ALVEOLAR;
  if (code === 0x0C35) return SOUND_GROUP.LABIODENTAL;
  if (code >= 0x0C36 && code <= 0x0C38) return SOUND_GROUP.SIBILANT;
  if (code === 0x0C39) return SOUND_GROUP.ASPIRATE;
  if (code === 0x0C4D) return null; // Virama
  if (code >= 0x0C00 && code <= 0x0C7F) return SOUND_GROUP.OPEN_VOWEL;
  return null;
}

// ══════════════════════════════════════════════════
// BENGALI — U+0980-09FF
// ══════════════════════════════════════════════════
function classifyBengali(code) {
  if (code === 0x0985 || code === 0x0986 || code === 0x09BE) return SOUND_GROUP.OPEN_VOWEL;
  if (code === 0x0987 || code === 0x0988 || code === 0x09BF || code === 0x09C0) return SOUND_GROUP.CLOSE_VOWEL;
  if (code === 0x0989 || code === 0x098A || code === 0x09C1 || code === 0x09C2) return SOUND_GROUP.HIGH_VOWEL;
  if (code === 0x098F || code === 0x0990 || code === 0x09C7 || code === 0x09C8) return SOUND_GROUP.MID_VOWEL;
  if (code === 0x0993 || code === 0x0994 || code === 0x09CB || code === 0x09CC) return SOUND_GROUP.ROUND_VOWEL;
  if (code >= 0x0995 && code <= 0x0999) return code === 0x0999 ? SOUND_GROUP.NASAL : SOUND_GROUP.VELAR;
  if (code >= 0x099A && code <= 0x099E) return code === 0x099E ? SOUND_GROUP.NASAL : SOUND_GROUP.PALATAL;
  if (code >= 0x099F && code <= 0x09A3) return code === 0x09A3 ? SOUND_GROUP.NASAL : SOUND_GROUP.RETROFLEX;
  if (code >= 0x09A4 && code <= 0x09A8) return code === 0x09A8 ? SOUND_GROUP.ALVEOLAR : SOUND_GROUP.DENTAL;
  if (code === 0x09AA || code === 0x09AC || code === 0x09AD || code === 0x09AE) return SOUND_GROUP.BILABIAL;
  if (code === 0x09AB) return SOUND_GROUP.LABIODENTAL;
  if (code === 0x09AF) return SOUND_GROUP.CLOSE_VOWEL;
  if (code === 0x09B0) return SOUND_GROUP.RHOTIC;
  if (code === 0x09B2) return SOUND_GROUP.ALVEOLAR;
  if (code === 0x09B6 || code === 0x09B7 || code === 0x09B8) return SOUND_GROUP.SIBILANT;
  if (code === 0x09B9) return SOUND_GROUP.ASPIRATE;
  if (code === 0x09CD) return null; // Virama
  if (code >= 0x0980 && code <= 0x09FF) return SOUND_GROUP.OPEN_VOWEL;
  return null;
}

// ══════════════════════════════════════════════════
// ENGLISH / LATIN — a-z
// ══════════════════════════════════════════════════
const ENGLISH_DIGRAPHS = {
  th: SOUND_GROUP.DENTAL, sh: SOUND_GROUP.PALATAL, ch: SOUND_GROUP.PALATAL,
  ph: SOUND_GROUP.LABIODENTAL, ng: SOUND_GROUP.NASAL, wh: SOUND_GROUP.ASPIRATE,
  ck: SOUND_GROUP.VELAR, qu: SOUND_GROUP.VELAR,
  oo: SOUND_GROUP.HIGH_VOWEL, ee: SOUND_GROUP.CLOSE_VOWEL,
  ea: SOUND_GROUP.CLOSE_VOWEL, ai: SOUND_GROUP.MID_VOWEL,
  ay: SOUND_GROUP.MID_VOWEL, ey: SOUND_GROUP.MID_VOWEL,
  ow: SOUND_GROUP.ROUND_VOWEL, ou: SOUND_GROUP.ROUND_VOWEL,
  oi: SOUND_GROUP.ROUND_VOWEL, oy: SOUND_GROUP.ROUND_VOWEL,
  au: SOUND_GROUP.ROUND_VOWEL, aw: SOUND_GROUP.ROUND_VOWEL,
};
const ENGLISH_DIGRAPH_KEYS = Object.keys(ENGLISH_DIGRAPHS);

const ENGLISH_SINGLE = {
  a: SOUND_GROUP.OPEN_VOWEL, e: SOUND_GROUP.MID_VOWEL,
  i: SOUND_GROUP.CLOSE_VOWEL, o: SOUND_GROUP.ROUND_VOWEL,
  u: SOUND_GROUP.HIGH_VOWEL,
  b: SOUND_GROUP.BILABIAL, c: SOUND_GROUP.VELAR,
  d: SOUND_GROUP.DENTAL, f: SOUND_GROUP.LABIODENTAL,
  g: SOUND_GROUP.VELAR, h: SOUND_GROUP.ASPIRATE,
  j: SOUND_GROUP.PALATAL, k: SOUND_GROUP.VELAR,
  l: SOUND_GROUP.ALVEOLAR, m: SOUND_GROUP.BILABIAL,
  n: SOUND_GROUP.ALVEOLAR, p: SOUND_GROUP.BILABIAL,
  q: SOUND_GROUP.VELAR, r: SOUND_GROUP.RHOTIC,
  s: SOUND_GROUP.SIBILANT, t: SOUND_GROUP.DENTAL,
  v: SOUND_GROUP.LABIODENTAL, w: SOUND_GROUP.HIGH_VOWEL,
  x: SOUND_GROUP.VELAR, y: SOUND_GROUP.CLOSE_VOWEL,
  z: SOUND_GROUP.SIBILANT,
};

// ══════════════════════════════════════════════════
// GENERIC INDIC CLASSIFIER (covers remaining scripts)
// Kannada 0C80-0CFF, Malayalam 0D00-0D7F, Gujarati 0A80-0AFF,
// Gurmukhi 0A00-0A7F, Odia 0B00-0B7F
// ══════════════════════════════════════════════════
function classifyGenericIndic(code, base) {
  const offset = code - base;
  // Vowels (independent): offset 0x05-0x14
  if (offset >= 0x05 && offset <= 0x06) return SOUND_GROUP.OPEN_VOWEL;
  if (offset >= 0x07 && offset <= 0x08) return SOUND_GROUP.CLOSE_VOWEL;
  if (offset >= 0x09 && offset <= 0x0A) return SOUND_GROUP.HIGH_VOWEL;
  if (offset === 0x0B) return SOUND_GROUP.RHOTIC;
  if (offset >= 0x0F && offset <= 0x10) return SOUND_GROUP.MID_VOWEL;
  if (offset >= 0x13 && offset <= 0x14) return SOUND_GROUP.ROUND_VOWEL;
  // Vowel matras: offset 0x3E-0x4C
  if (offset === 0x3E) return SOUND_GROUP.OPEN_VOWEL;
  if (offset === 0x3F || offset === 0x40) return SOUND_GROUP.CLOSE_VOWEL;
  if (offset === 0x41 || offset === 0x42) return SOUND_GROUP.HIGH_VOWEL;
  if (offset === 0x47 || offset === 0x48) return SOUND_GROUP.MID_VOWEL;
  if (offset === 0x4B || offset === 0x4C) return SOUND_GROUP.ROUND_VOWEL;
  // Consonants by group (same pattern across all Indic scripts)
  if (offset >= 0x15 && offset <= 0x19) return offset === 0x19 ? SOUND_GROUP.NASAL : SOUND_GROUP.VELAR;
  if (offset >= 0x1A && offset <= 0x1E) return offset === 0x1E ? SOUND_GROUP.NASAL : SOUND_GROUP.PALATAL;
  if (offset >= 0x1F && offset <= 0x23) return offset === 0x23 ? SOUND_GROUP.NASAL : SOUND_GROUP.RETROFLEX;
  if (offset >= 0x24 && offset <= 0x28) return offset === 0x28 ? SOUND_GROUP.ALVEOLAR : SOUND_GROUP.DENTAL;
  if (offset === 0x2A || offset === 0x2C || offset === 0x2D || offset === 0x2E) return SOUND_GROUP.BILABIAL;
  if (offset === 0x2B) return SOUND_GROUP.LABIODENTAL;
  if (offset === 0x2F) return SOUND_GROUP.CLOSE_VOWEL;  // ya
  if (offset === 0x30) return SOUND_GROUP.RHOTIC;        // ra
  if (offset === 0x32 || offset === 0x33) return SOUND_GROUP.ALVEOLAR;  // la
  if (offset === 0x35) return SOUND_GROUP.LABIODENTAL;   // va
  if (offset >= 0x36 && offset <= 0x38) return SOUND_GROUP.SIBILANT;
  if (offset === 0x39) return SOUND_GROUP.ASPIRATE;
  if (offset === 0x4D) return null; // Virama
  return SOUND_GROUP.OPEN_VOWEL; // Generic fallback
}

// ══════════════════════════════════════════════════
// MASTER CLASSIFIER
// ══════════════════════════════════════════════════
function classifyCharacter(code) {
  // Latin lowercase
  if (code >= 0x61 && code <= 0x7A) return ENGLISH_SINGLE[String.fromCharCode(code)] || null;
  // Devanagari
  if (code >= 0x0900 && code <= 0x097F) return classifyDevanagari(code);
  // Bengali
  if (code >= 0x0980 && code <= 0x09FF) return classifyBengali(code);
  // Gurmukhi
  if (code >= 0x0A00 && code <= 0x0A7F) return classifyGenericIndic(code, 0x0A00);
  // Gujarati
  if (code >= 0x0A80 && code <= 0x0AFF) return classifyGenericIndic(code, 0x0A80);
  // Odia
  if (code >= 0x0B00 && code <= 0x0B7F) return classifyGenericIndic(code, 0x0B00);
  // Tamil
  if (code >= 0x0B80 && code <= 0x0BFF) return classifyTamil(code);
  // Telugu
  if (code >= 0x0C00 && code <= 0x0C7F) return classifyTelugu(code);
  // Kannada
  if (code >= 0x0C80 && code <= 0x0CFF) return classifyGenericIndic(code, 0x0C80);
  // Malayalam
  if (code >= 0x0D00 && code <= 0x0D7F) return classifyGenericIndic(code, 0x0D00);
  // Arabic / Urdu (basic)
  if (code >= 0x0600 && code <= 0x06FF) return SOUND_GROUP.OPEN_VOWEL;
  // Numbers, punctuation, spaces → skip
  return null;
}

// ══════════════════════════════════════════════════
// SOUND GROUP → ARPAbet phoneme (for visemesMapping.js compat)
// ══════════════════════════════════════════════════
const SOUND_TO_ARPABET = {
  AA: "AA", EH: "EH", IH: "IH", UH: "UH",
  P: "P", F: "F", T: "T", N: "N",
  CH: "CH", K: "K", S: "S", R: "R",
  HH: "HH", SIL: "SIL",
};

// ══════════════════════════════════════════════════
// CACHE
// ══════════════════════════════════════════════════
const cache = new Map();
const MAX_CACHE_SIZE = 100;

/**
 * Convert text (any language) to a sound group sequence.
 * Returns [{phoneme, time}] where phoneme is an ARPAbet-compatible key.
 *
 * @param {string} text
 * @param {number} [audioDuration] — optional audio duration to scale timing
 * @returns {Array<{phoneme: string, time: number}>}
 */
export function generatePhonemes(text, audioDuration) {
  if (!text) return [];

  const cacheKey = text + "|" + (audioDuration || "");
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const lower = text.toLowerCase();
  const phonemes = [];
  let time = 0;
  const PHONEME_DUR = 0.07;
  const WORD_GAP = 0.04;

  let i = 0;
  while (i < lower.length) {
    const ch = lower[i];
    const code = lower.charCodeAt(i);

    // Space / newline → word gap
    if (ch === " " || ch === "\n" || ch === "\r" || ch === "\t") {
      if (phonemes.length > 0 && phonemes[phonemes.length - 1].phoneme !== "SIL") {
        phonemes.push({ phoneme: "SIL", time });
        time += WORD_GAP;
      }
      i++;
      continue;
    }

    // English digraph check
    if (code >= 0x61 && code <= 0x7A && i < lower.length - 1) {
      const pair = lower[i] + lower[i + 1];
      if (ENGLISH_DIGRAPHS[pair]) {
        const arpabet = SOUND_TO_ARPABET[ENGLISH_DIGRAPHS[pair]] || "AA";
        phonemes.push({ phoneme: arpabet, time });
        time += PHONEME_DUR;
        i += 2;
        continue;
      }
    }

    // Classify single character
    const soundGroup = classifyCharacter(code);
    if (soundGroup) {
      const arpabet = SOUND_TO_ARPABET[soundGroup] || "AA";
      phonemes.push({ phoneme: arpabet, time });
      time += PHONEME_DUR;
    }
    // else: punctuation, numbers, unknown → skip (no phoneme)
    i++;
  }

  // Scale timing to audio duration
  if (audioDuration && audioDuration > 0 && time > 0) {
    const scale = audioDuration / time;
    for (const p of phonemes) {
      p.time *= scale;
    }
  }

  // Cache management
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(cacheKey, phonemes);

  return phonemes;
}

/**
 * Binary search for the current phoneme at a given time.
 */
export function getCurrentPhoneme(phonemes, currentTime) {
  if (!phonemes || phonemes.length === 0) return null;
  let lo = 0;
  let hi = phonemes.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (phonemes[mid].time <= currentTime) lo = mid + 1;
    else hi = mid - 1;
  }
  return hi >= 0 ? phonemes[hi].phoneme : null;
}
