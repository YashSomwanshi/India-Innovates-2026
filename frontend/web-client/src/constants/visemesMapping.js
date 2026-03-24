/**
 * Full ARPAbet phoneme → viseme morph target mapping.
 * Used by Avatar3DRealtime to drive lip sync from phoneme sequences.
 */
const visemesMapping = {
  // Vowels
  AA: "viseme_aa",
  AE: "viseme_aa",
  AH: "viseme_aa",
  AO: "viseme_O",
  AW: "viseme_O",
  AY: "viseme_aa",
  EH: "viseme_E",
  ER: "viseme_RR",
  EY: "viseme_E",
  IH: "viseme_I",
  IY: "viseme_I",
  OW: "viseme_O",
  OY: "viseme_O",
  UH: "viseme_U",
  UW: "viseme_U",

  // Consonants
  B: "viseme_PP",
  CH: "viseme_CH",
  D: "viseme_DD",
  DH: "viseme_TH",
  F: "viseme_FF",
  G: "viseme_kk",
  HH: "viseme_SS",
  JH: "viseme_CH",
  K: "viseme_kk",
  L: "viseme_nn",
  M: "viseme_PP",
  N: "viseme_nn",
  NG: "viseme_nn",
  P: "viseme_PP",
  R: "viseme_RR",
  S: "viseme_SS",
  SH: "viseme_CH",
  T: "viseme_DD",
  TH: "viseme_TH",
  V: "viseme_FF",
  W: "viseme_U",
  Y: "viseme_I",
  Z: "viseme_SS",
  ZH: "viseme_CH",

  // Silence
  SIL: "viseme_sil",

  // Legacy single-letter mappings (backward compat)
  A: "viseme_PP",
  C: "viseme_I",
  E: "viseme_O",
  X: "viseme_PP",
};

export default visemesMapping;
