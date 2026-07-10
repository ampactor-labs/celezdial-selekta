// Sign data — the 12 voices and their visual identities.
// Chromatic mapping C through B per Lionel's chromatic-calendar.
// Each carries: note class, microtonal detune from 12-TET (cents),
// octave, velocity (mix weight), glyph, fixed stereo base,
// pan group, osc count, osc spread.
// Octave spread: dim7 partitioning — C/Eb/Gb/A in oct 3, D/F/Ab/B in oct 4,
// Db/E/G/Bb in oct 5. No semitone adjacencies within any octave.
// Velocity: luminary-ruled signs (Leo/Cancer) lead, personal planet signs mid,
// social planet signs (Jupiter/Saturn) form the harmonic bed.
// Detune: Cousto planetary frequencies at 50% strength — authentic color
// without quarter-tone shock. Signs sharing a ruler share the same offset.

import { PLANETARY_CHARACTER, SIGN_RULERS } from "./tuning";

export const SIGNS = {
  Aquarius: {
    octave: 3,
    vel: 0.33,
    glyph: "\u2652\uFE0E",
    note: "C",
    detuneCents: 6, // Saturn ×0.5
    panBase: -0.7,
    panGroup: "A",
    oscCount: 2,
    oscSpread: 5,
  },
  Pisces: {
    octave: 5,
    vel: 0.38,
    glyph: "\u2653\uFE0E",
    note: "Db",
    detuneCents: -6.5, // Jupiter ×0.5
    panBase: 0.65,
    panGroup: "D",
    oscCount: 3,
    oscSpread: 12,
  },
  Aries: {
    octave: 4,
    vel: 0.52,
    glyph: "\u2648\uFE0E",
    note: "D",
    detuneCents: -12.5, // Mars ×0.5
    panBase: -0.4,
    panGroup: "B",
    oscCount: 2,
    oscSpread: 8,
  },
  Taurus: {
    octave: 3,
    vel: 0.5,
    glyph: "\u2649\uFE0E",
    note: "Eb",
    detuneCents: 5, // Venus ×0.5
    panBase: 0.55,
    panGroup: "C",
    oscCount: 2,
    oscSpread: 5,
  },
  Gemini: {
    octave: 5,
    vel: 0.48,
    glyph: "\u264A\uFE0E",
    note: "E",
    detuneCents: 16.5, // Mercury ×0.5
    panBase: -0.3,
    panGroup: "B",
    oscCount: 3,
    oscSpread: 12,
  },
  Cancer: {
    octave: 4,
    vel: 0.6,
    glyph: "\u264B\uFE0E",
    note: "F",
    detuneCents: 11.5, // Moon ×0.5
    panBase: 0.7,
    panGroup: "D",
    oscCount: 2,
    oscSpread: 8,
  },
  Leo: {
    octave: 3,
    vel: 0.65,
    glyph: "\u264C\uFE0E",
    note: "Gb",
    detuneCents: 19, // Sun ×0.5
    panBase: 0.1,
    panGroup: "B",
    oscCount: 2,
    oscSpread: 5,
  },
  Virgo: {
    octave: 5,
    vel: 0.45,
    glyph: "\u264D\uFE0E",
    note: "G",
    detuneCents: 16.5, // Mercury ×0.5
    panBase: -0.6,
    panGroup: "A",
    oscCount: 3,
    oscSpread: 12,
  },
  Libra: {
    octave: 4,
    vel: 0.47,
    glyph: "\u264E\uFE0E",
    note: "Ab",
    detuneCents: 5, // Venus ×0.5
    panBase: 0.35,
    panGroup: "C",
    oscCount: 2,
    oscSpread: 8,
  },
  Scorpio: {
    octave: 3,
    vel: 0.48,
    glyph: "\u264F\uFE0E",
    note: "A",
    detuneCents: -12.5, // Mars ×0.5
    panBase: -0.2,
    panGroup: "C",
    oscCount: 2,
    oscSpread: 5,
  },
  Sagittarius: {
    octave: 5,
    vel: 0.4,
    glyph: "\u2650\uFE0E",
    note: "Bb",
    detuneCents: -6.5, // Jupiter ×0.5
    panBase: 0.15,
    panGroup: "D",
    oscCount: 3,
    oscSpread: 12,
  },
  Capricorn: {
    octave: 4,
    vel: 0.35,
    glyph: "\u2651\uFE0E",
    note: "B",
    detuneCents: 6, // Saturn ×0.5
    panBase: -0.55,
    panGroup: "A",
    oscCount: 2,
    oscSpread: 8,
  },
};

// Merge planetary character into sign config — all engine code reads from this.
export const SIGN_CHARACTER = Object.fromEntries(
  Object.entries(SIGNS).map(([name, cfg]) => [
    name,
    { ...cfg, ...PLANETARY_CHARACTER[SIGN_RULERS[name]] },
  ]),
);

export const SIGN_COLORS = {
  Aquarius: ["#3f575a", "#688a8d", "#95bbbe", "#d0ecf0", "#0c0c0c"],
  Pisces: ["#657ba5", "#7495bf", "#4e5d74", "#779ebf", "#0c0c0c"],
  Aries: ["#dabd9d", "#8c5c4a", "#f27b5f", "#c26d5c", "#0c0c0c"],
  Taurus: ["#878a8d", "#d9b292", "#f4dbc4", "#414141", "#0c0c0c"],
  Gemini: ["#595856", "#c0bdbc", "#8d8a88", "#f5f6f7", "#0c0c0c"],
  Cancer: ["#c0c0c8", "#8888a0", "#e8e8f0", "#606078", "#0c0c0c"],
  Leo: ["#f28320", "#f15d22", "#d94126", "#a41d21", "#0c0c0c"],
  Virgo: ["#8d8a88", "#595856", "#c0bdbc", "#f5f6f7", "#0c0c0c"],
  Libra: ["#d9b292", "#878a8d", "#f4dbc4", "#414141", "#0c0c0c"],
  Scorpio: ["#4a3a5c", "#7b6898", "#a08cb8", "#c8b8d8", "#0c0c0c"],
  Sagittarius: ["#282311", "#c08237", "#bfaf9b", "#c0a480", "#0c0c0c"],
  Capricorn: ["#8b7355", "#c4a96d", "#e0c98f", "#5a4a32", "#0c0c0c"],
};
export const COLOR_OFF = "#0c0c0c";
export const KNOB_DEFAULT_COLOR = "#9070cc";

export const KEYBOARD_ORDER = Object.keys(SIGNS);
export const SHARP_INDICES = new Set([1, 3, 6, 8, 10]);
export const NATURAL_KEYS = KEYBOARD_ORDER.filter(
  (_, i) => !SHARP_INDICES.has(i),
);
export const SHARP_KEYS = KEYBOARD_ORDER.filter((_, i) =>
  SHARP_INDICES.has(i),
);
export const SHARP_POSITIONS = ["10%", "24%", "53%", "67%", "81%"];
export const SIGN_NAMES = KEYBOARD_ORDER;
export const SIGNS_BY_LOWERCASE = Object.fromEntries(
  SIGN_NAMES.map((k) => [k.toLowerCase(), k]),
);

// QWERTY row → sign, piano-style: naturals on home row keys, sharps above.
// a=C(Aquarius) w=Db(Pisces) s=D(Aries) e=Eb d=E f=F t=Gb g=G y=Ab h=A u=Bb j=B
export const KEY_TO_SIGN = Object.fromEntries(
  ["a", "w", "s", "e", "d", "f", "t", "g", "y", "h", "u", "j"].map(
    (key, i) => [key, KEYBOARD_ORDER[i]],
  ),
);
export const SIGN_TO_KEY = Object.fromEntries(
  Object.entries(KEY_TO_SIGN).map(([k, s]) => [s, k]),
);
