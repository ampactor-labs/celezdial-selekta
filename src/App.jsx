// ═══════════════════════════════════════════════════════════════
// CELESTIAL PAD v13 — Per-Sign Character · Adaptive Voicing
//
// ─── ARCHITECTURE OVERVIEW ──────────────────────────────────
//
// 12 Tone.PolySynth instances (2-voice polyphony each), one per
// zodiac sign. Each sign's oscillator type is determined by its
// ruling planet via PLANETARY_CHARACTER (fat/AM/FM variants).
// SIGN_CHARACTER merges SIGNS + PLANETARY_CHARACTER at init:
//   PolySynth (per-sign oscType, multiplied ADSR envelope)
//     → Panner (fixed stereo base + LFO drift per pan group)
//       → sumBus (Gain node — all voices merge here)
//
// The sumBus feeds a serial FX chain ending at destination.
// Voices summing BEFORE saturation is intentional — Chebyshev
// waveshaping on a polyphonic sum creates intermodulation
// distortion (sum/difference tones between partials). This is
// what gives the pad its FM-like shimmer and harmonic density.
//
// ─── PLANETARY CHARACTER ──────────────────────────────────
//
// Each sign inherits its ruling planet's sonic personality:
//   oscType     — fat (count/spread), AM, or FM variant
//   ADSR muls   — orbital speed ↔ envelope speed
//
// 5 fat-type signs (Leo, Aries, Scorpio, Taurus, Libra) support
// oscCount/spread and Eclipse spread ramp. 3 AM signs (Cancer,
// Sagittarius, Pisces) and 4 FM signs (Gemini, Virgo, Capricorn,
// Aquarius) skip spread — they drift via detune only.
//
// Envelope knobs set a base value; each sign applies its planetary
// multiplier. Mars signs attack in ~60% of base time, Saturn in
// ~150%. Inner-planet voices arrive first — orbital speed = sonic.
//
// ─── FX CHAIN (configurable — see tuning.js CHAINS) ──────
//
// Active default: "Zodiac"
//   sumBus → Vibrato → Echo(CrossFade) → EQ3 → Chebyshev
//     → [Distortion] → Freeverb → Chorus → [Phaser]
//     → MonitorEQ → tanh soft clip → destination
//
// ─── ADAPTIVE VOICING ─────────────────────────────────────
//
// Polyphonic gain compensation: boost = 5 × log10(12 / active).
// 12 voices = 0dB, 6 = +1.5dB, 3 = +3dB, 1 = +5.4dB.
// Applied in toggleSign (before triggerAttack) and breathe.
// Stacks with OCTAVE_GAIN (Fletcher-Munson).
// NOT applied in randomize (chaotic by design).
//
// ─── STATE MODEL ────────────────────────────────────────────
//
// engineRef      — Tone.js audio graph, created on first interaction.
//                  Null until user clicks (browser autoplay policy).
// activeSigns    — Set<string> of currently sounding sign names.
// params         — Object of 35 direct knob values. Each knob maps
//                  1:1 to an engine parameter via KNOB_MAP. Shadow
//                  mode temporarily overrides FX params; when Shadow
//                  disengages, param values are restored.
// oscIndex       — null | 0–7. null = per-sign planetary defaults.
//                  Breathe cycles: null → 0 → ... → 7 → null → ...
//                  When 0–7, all synths share that OSC_TYPES entry.
// shadow         — Boolean. Shadow/Eclipse mode active. Ramps FX
//                  params toward chaos targets over rampTime seconds.
//
// ─── CONTROLS ───────────────────────────────────────────────
//
// Piano keyboard — Toggle individual planet voices on/off.
// Eclipse        — Chaos mode. Ramps all FX toward extreme values,
//                  widens osc spread (fat types only), randomizes
//                  detune. Toggle off restores saved param values.
// Breathe        — Cycles oscillator type: per-sign → fatsine →
//                  amsine → ... → fatsquare → per-sign. Releases
//                  active voices first, then switches. On per-sign,
//                  each sign uses its planetary default.
// Oracle dots    — Pyramid of dots below controls row. Clicking
//                  opens the Controls veil (knobs, listen, randomize).
//                  Discoverable, not advertised.
// Listen pills   — Monitor EQ presets for different playback devices.
// Knobs          — 35 direct SVG arc knobs, grouped by function.
//                  Each maps 1:1 to an engine parameter. Double-click
//                  resets to default. Shift+drag for fine control.
//                  Envelope knobs apply per-sign multipliers.
// Natal Chart    — Enter birth data, indicators appear reactively.
//                  Click keys to play.
//
// ═══════════════════════════════════════════════════════════════

import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
let Tone = null;
let _horoscopeModule = null;
async function getHoroscope() {
  if (!_horoscopeModule) {
    _horoscopeModule = await import("circular-natal-horoscope-js");
  }
  return _horoscopeModule;
}
import {
  TUNING,
  SHADOW,
  KNOB_DEFS,
  KNOB_GROUPS,
  CHAINS,
  ACTIVE_CHAIN,
  LISTEN_PRESETS,
  OSC_TYPES,
  OCTAVE_GAIN,
  PLANETARY_CHARACTER,
  SIGN_RULERS,
  CHART_A_COLOR,
  CHART_B_COLOR,
  BODY_GLYPHS,
} from "./tuning";
import {
  hexToRgb,
  rgbToHex,
  formatValue,
  logMap,
  stepMap,
  arcPoint,
  describeArc,
  KNOB_TRACK_PATH,
  KNOB_R,
  KNOB_CX,
  KNOB_CY,
  KNOB_START,
  KNOB_SWEEP,
} from "./utils";

// ─── Font Constants ───────────────────────────────────────────
const FONTS = {
  title: "'Spiral ST', serif",
  body: "system-ui, -apple-system, sans-serif",
  mono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
};

// 12 zodiac signs — chromatic mapping C through B.
// Each carries: note class, microtonal detune from 12-TET (cents),
// octave, velocity (mix weight), glyph, fixed stereo base,
// pan group, osc count, osc spread.
// Octave spread: dim7 partitioning — C/Eb/Gb/A in oct 3, D/F/Ab/B in oct 4,
// Db/E/G/Bb in oct 5. No semitone adjacencies within any octave.
// Velocity: luminary-ruled signs (Leo/Cancer) lead, personal planet signs mid,
// social planet signs (Jupiter/Saturn) form the harmonic bed.
// Detune: Cousto planetary frequencies at 50% strength — authentic color
// without quarter-tone shock. Signs sharing a ruler share the same offset.
const SIGNS = {
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
const SIGN_CHARACTER = Object.fromEntries(
  Object.entries(SIGNS).map(([name, cfg]) => [
    name,
    { ...cfg, ...PLANETARY_CHARACTER[SIGN_RULERS[name]] },
  ]),
);

const STYLE_CHART_A = { color: CHART_A_COLOR };
const STYLE_CHART_B = { color: CHART_B_COLOR };

// Adaptive voicing: boost gain when fewer voices are active.
// Formula: 5 × log10(12 / totalActive) dB
// totalActive = countA + countB across both synth banks.
function applyAdaptiveVoicing(eng, totalActive) {
  const boost =
    totalActive > 0 ? 5 * Math.log10(12 / Math.max(1, totalActive)) : 0;
  for (const name of SIGN_NAMES) {
    const vol = -9 + (OCTAVE_GAIN[SIGN_CHARACTER[name].octave] || 0) + boost;
    eng.synths[name].set({ volume: vol });
    if (eng.synthsB) eng.synthsB[name].set({ volume: vol });
  }
}

const SIGN_COLORS = {
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
const COLOR_OFF = "#0c0c0c";
const KNOB_DEFAULT_COLOR = "#9070cc";

const VIS_SPEED = 0.65; // visual envelope runs ~35% faster than audio

const KEYBOARD_ORDER = Object.keys(SIGNS);
const SHARP_INDICES = new Set([1, 3, 6, 8, 10]);
const NATURAL_KEYS = KEYBOARD_ORDER.filter((_, i) => !SHARP_INDICES.has(i));
const SHARP_KEYS = KEYBOARD_ORDER.filter((_, i) => SHARP_INDICES.has(i));
const SHARP_POSITIONS = ["10%", "24%", "53%", "67%", "81%"];
const SHARP_KEY_STYLES = SHARP_POSITIONS.map((left) => ({ left }));
const SIGN_NAMES = KEYBOARD_ORDER;
const SIGNS_BY_LOWERCASE = Object.fromEntries(
  SIGN_NAMES.map((k) => [k.toLowerCase(), k]),
);
// ─── Device-aware listen preset detection ─────────────────────
const DETECTED_LISTEN_PRESET = (() => {
  if (typeof window === "undefined") return "headphones";
  const mq = (q) => window.matchMedia(q).matches;
  if (mq("(max-width: 600px) and (pointer: coarse)")) return "phone";
  if (mq("(min-width: 601px) and (max-width: 1024px) and (pointer: coarse)")) return "laptop";
  return "headphones";
})();
// OSC_TYPES imported from tuning.js — 8 types cycled by Breathe

// ─── Knob Mapping ────────────────────────────────────────────

// Helper: apply a function to both A and B synth banks
function forBothBanks(eng, fn) {
  fn(eng.synths, eng.oscTypeTracker, eng.spreadTracker);
  if (eng.synthsB) fn(eng.synthsB, eng.oscTypeTrackerB, eng.spreadTrackerB);
}

const KNOB_MAP = {
  // Oscillator internals
  harmonicity: {
    apply: (eng, v) => {
      forBothBanks(eng, (synths, oscTypes) => {
        for (const name of SIGN_NAMES) {
          const t = oscTypes[name];
          if (t.startsWith("am") || t.startsWith("fm")) {
            synths[name].set({ oscillator: { harmonicity: v } });
          }
        }
      });
    },
  },
  modulationIndex: {
    apply: (eng, v) => {
      forBothBanks(eng, (synths, oscTypes) => {
        for (const name of SIGN_NAMES) {
          if (oscTypes[name].startsWith("fm")) {
            synths[name].set({ oscillator: { modulationIndex: v } });
          }
        }
      });
    },
  },
  oscSpread: {
    apply: (eng, v) => {
      forBothBanks(eng, (synths, oscTypes, spreadTrk) => {
        for (const name of SIGN_NAMES) {
          if (oscTypes[name].startsWith("fat")) {
            synths[name].set({ oscillator: { spread: v } });
            spreadTrk[name] = v;
          }
        }
      });
    },
  },
  stagger: {
    apply: () => {}, // read from paramsRef at playback time
  },
  // Voice
  attack: {
    apply: (eng, v) => {
      forBothBanks(eng, (synths) => {
        for (const name of SIGN_NAMES) {
          synths[name].set({ envelope: { attack: v * SIGN_CHARACTER[name].attackMul } });
        }
      });
    },
  },
  decay: {
    apply: (eng, v) => {
      forBothBanks(eng, (synths) => {
        for (const name of SIGN_NAMES) {
          synths[name].set({ envelope: { decay: v * SIGN_CHARACTER[name].decayMul } });
        }
      });
    },
  },
  sustain: {
    apply: (eng, v) => {
      forBothBanks(eng, (synths) => {
        for (const name of SIGN_NAMES) {
          synths[name].set({
            envelope: {
              sustain: Math.min(1, v * SIGN_CHARACTER[name].sustainMul),
            },
          });
        }
      });
    },
  },
  release: {
    apply: (eng, v) => {
      forBothBanks(eng, (synths) => {
        for (const name of SIGN_NAMES) {
          synths[name].set({ envelope: { release: v * SIGN_CHARACTER[name].releaseMul } });
        }
      });
    },
  },
  // Grit
  chebyWet: {
    apply: (eng, v) => {
      eng.fx.chebyshev.wet.value = v;
    },
  },
  chebyOrder: {
    apply: (eng, v) => {
      eng.fx.chebyshev.order = v;
    },
  },
  // EQ
  eqHigh: {
    apply: (eng, v) => {
      eng.fx.eq3.high.value = v;
    },
  },
  eqMid: {
    apply: (eng, v) => {
      eng.fx.eq3.mid.value = v;
    },
  },
  eqLow: {
    apply: (eng, v) => {
      eng.fx.eq3.low.value = v;
    },
  },
  // Vibrato
  vibratoFreq: {
    apply: (eng, v) => {
      eng.fx.vibrato.frequency.value = v;
    },
  },
  vibratoDepth: {
    apply: (eng, v) => {
      eng.fx.vibrato.depth.value = v;
    },
  },
  vibratoWet: {
    apply: (eng, v) => {
      eng.fx.vibrato.wet.value = v;
    },
  },
  // Delay (all ramped — prevents Doppler artifacts + feedback runaway)
  delayTime: {
    apply: (eng, v) => {
      const p = eng.fx.echoDelay.delayTime;
      p.cancelAndHoldAtTime(Tone.now());
      p.rampTo(v, 0.15);
    },
  },
  delayFeedback: {
    apply: (eng, v) => {
      const p = eng.fx.echoFeedbackGain.gain;
      p.cancelAndHoldAtTime(Tone.now());
      p.rampTo(v, 0.08);
    },
  },
  delayWet: {
    apply: (eng, v) => {
      const p = eng.fx.echoCrossfade.fade;
      p.cancelAndHoldAtTime(Tone.now());
      p.rampTo(v, 0.08);
    },
  },
  echoFilterFreq: {
    apply: (eng, v) => {
      const p = eng.fx.echoFilter.frequency;
      p.cancelAndHoldAtTime(Tone.now());
      p.rampTo(v, 0.1);
    },
  },
  // Reverb
  reverbRoom: {
    apply: (eng, v) => {
      eng.fx.reverb.roomSize.value = v;
    },
  },
  reverbDamp: {
    apply: (eng, v) => {
      eng.fx.reverb.dampening = v;
      eng.fx.dampSweep.center = v;
    },
  },
  reverbWet: {
    apply: (eng, v) => {
      eng.fx.reverb.wet.value = v;
    },
  },
  dampSweepRate: {
    apply: (eng, v) => {
      eng.fx.dampSweep.rate = v;
    },
  },
  dampSweepDepth: {
    apply: (eng, v) => {
      eng.fx.dampSweep.depth = v;
    },
  },
  // Space
  panLfoFreq: {
    apply: (eng, v) => {
      Object.values(eng.panLfos).forEach((l) => {
        l.frequency.value = v;
      });
    },
  },
  panLfoAmplitude: {
    apply: (eng, v) => {
      Object.values(eng.panLfos).forEach((l) => {
        l.amplitude.value = v;
      });
    },
  },
  // Phase
  phaserFreq: {
    apply: (eng, v) => {
      eng.fx.phaser.frequency.value = v;
    },
  },
  phaserOctaves: {
    apply: (eng, v) => {
      eng.fx.phaser.octaves = v;
    },
  },
  phaserBase: {
    apply: (eng, v) => {
      eng.fx.phaser.baseFrequency = v;
    },
  },
  phaserQ: {
    apply: (eng, v) => {
      eng.fx.phaser.Q.value = v;
    },
  },
  phaserWet: {
    apply: (eng, v) => {
      eng.fx.phaser.wet.value = v;
      eng.setBypass("phaser", v === 0);
    },
  },
  // Chorus
  chorusWet: {
    apply: (eng, v) => {
      eng.fx.chorus.wet.value = v;
    },
  },
  chorusFreq: {
    apply: (eng, v) => {
      eng.fx.chorus.frequency.value = v;
    },
  },
  chorusDelay: {
    apply: (eng, v) => {
      eng.fx.chorus.delayTime = v;
    },
  },
  chorusDepth: {
    apply: (eng, v) => {
      eng.fx.chorus.depth = v;
    },
  },
  // Saturate
  distortion: {
    apply: (eng, v) => {
      eng.fx.distortion.distortion = v;
    },
  },
  distortionWet: {
    apply: (eng, v) => {
      eng.fx.distortion.wet.value = v;
      eng.setBypass("distortion", v === 0);
    },
  },
  // EQ high frequency
  eqHighFreq: {
    apply: (eng, v) => {
      eng.fx.eq3.highFrequency.value = v;
    },
  },
};

const knobScaleProps = Object.fromEntries(
  Object.entries(KNOB_DEFS).map(([name, def]) => [
    name,
    def.scale === "log"
      ? logMap(def.min, def.max)
      : def.scale === "step"
        ? stepMap(def.min, def.max)
        : {},
  ]),
);

// ─── SVG Arc Knob Component ──────────────────────────────────

const Knob = React.memo(function Knob({
  label,
  value,
  defaultValue,
  min,
  max,
  format,
  onChange,
  mapToNorm,
  mapFromNorm,
}) {
  const dragRef = useRef(null);

  const norm = mapToNorm ? mapToNorm(value) : (value - min) / (max - min);
  const clampedNorm = Math.max(0, Math.min(1, norm));
  const normRef = useRef(clampedNorm);
  normRef.current = clampedNorm;
  const valueAngle = KNOB_START + clampedNorm * KNOB_SWEEP;

  const valuePath =
    clampedNorm > 0.003 ? describeArc(KNOB_START, valueAngle) : "";
  const pointer = arcPoint(valueAngle);

  const onPointerDown = useCallback(
    (e) => {
      e.target.setPointerCapture(e.pointerId);
      dragRef.current = { startY: e.clientY, startNorm: normRef.current };
    },
    [],
  );

  const onPointerMove = useCallback(
    (e) => {
      if (!dragRef.current) return;
      const sensitivity = e.shiftKey ? 0.0005 : 0.003;
      const dy = dragRef.current.startY - e.clientY;
      const newNorm = Math.max(
        0,
        Math.min(1, dragRef.current.startNorm + dy * sensitivity),
      );
      const newValue = mapFromNorm
        ? mapFromNorm(newNorm)
        : min + newNorm * (max - min);
      onChange(newValue);
    },
    [min, max, onChange, mapFromNorm],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const onDoubleClick = useCallback(() => {
    onChange(defaultValue);
  }, [defaultValue, onChange]);

  return (
    <div className="cel-knob">
      <span className="cel-knob-label">{label}</span>
      <svg
        width="56"
        height="56"
        className="cel-knob-svg"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        <path
          d={KNOB_TRACK_PATH}
          fill="none"
          stroke="rgba(180,140,255,0.15)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {valuePath && <path d={valuePath} className="cel-knob-value-arc" />}
        <circle
          cx={pointer.x}
          cy={pointer.y}
          r="4"
          className="cel-knob-pointer"
        />
        <circle
          cx={KNOB_CX}
          cy={KNOB_CY}
          r="6"
          fill="rgba(180,140,255,0.08)"
          stroke="rgba(180,140,255,0.2)"
          strokeWidth="1"
        />
      </svg>
      <span className="cel-knob-value">{format ? format(value) : value}</span>
    </div>
  );
});

// ─── Audio Engine Factory ────────────────────────────────────

let _enginePromise = null; // creation lock — prevents duplicate contexts

async function createEngine() {
  Tone = await import("tone");
  const yield_ = () => new Promise(r => setTimeout(r, 0));
  // iOS: route through media channel — bypasses mute switch (iOS 17+)
  if ("audioSession" in navigator) {
    navigator.audioSession.type = "playback";
  }

  const ctx = new Tone.Context({
    latencyHint: "playback",
    sampleRate: TUNING.sampleRate,
    lookAhead: 0.3,
    updateInterval: 0.025,
  });
  Tone.setContext(ctx);
  await Tone.start();
  // Belt-and-suspenders: wait for the raw AudioContext to actually resume
  if (ctx.rawContext.state !== "running") {
    await ctx.rawContext.resume();
  }

  // ─── Diagnostic: AudioContext state tracking ───
  _diag.ctx = ctx;
  _diag.audioInfo = {
    baseLatency: ctx.rawContext.baseLatency ?? null,
    outputLatency: ctx.rawContext.outputLatency ?? null,
    bufferSize: ctx.rawContext.baseLatency != null
      ? Math.round(ctx.rawContext.baseLatency * ctx.rawContext.sampleRate)
      : null,
    sampleRate: ctx.rawContext.sampleRate,
  };
  _diag.ctxStateLog.push({ state: ctx.rawContext.state, time: performance.now() });
  ctx.rawContext.addEventListener('statechange', () => {
    _diag.ctxStateLog.push({ state: ctx.rawContext.state, time: performance.now() });
    if (ctx.rawContext.state !== 'running')
      console.warn(`[selekta] AudioContext → ${ctx.rawContext.state}`);
  });

  // iOS: silent keepalive prevents context suspension on lock/background.
  // Pre-iOS 17 fallback for mute switch bypass (inaudible at 1e-37 gain).
  const keepAlive = ctx.rawContext.createOscillator();
  const muteGain = ctx.rawContext.createGain();
  muteGain.gain.value = 1e-37;
  keepAlive.connect(muteGain);
  muteGain.connect(ctx.rawContext.destination);
  keepAlive.start();
  await yield_();

  // ─── FX chain (constructed before synths so panners have a target) ───

  const chebyshev = new Tone.Chebyshev(TUNING.chebyOrder);
  chebyshev.wet.value = TUNING.chebyWet;
  chebyshev.oversample = "none";

  const eq3 = new Tone.EQ3({
    high: TUNING.eqHigh,
    mid: TUNING.eqMid,
    low: TUNING.eqLow,
    highFrequency: TUNING.eqHighFreq,
  });

  const vibrato = new Tone.Vibrato({
    frequency: TUNING.vibratoFreq,
    depth: TUNING.vibratoDepth,
  });
  vibrato.wet.value = TUNING.vibratoWet;

  // ─── Custom echo loop (filter + saturation in feedback path) ───
  const echoDelay = new Tone.Delay({
    delayTime: TUNING.delayTime,
    maxDelay: 2,
  });
  const echoFeedbackGain = new Tone.Gain(TUNING.delayFeedback);
  const echoFilter = new Tone.Filter({
    frequency: TUNING.echoFilterFreq,
    type: "lowpass",
    rolloff: -12,
  });
  const echoSat = new Tone.WaveShaper(
    (v) => Math.tanh(v * TUNING.echoSatDrive),
    1024,
  );
  const echoCrossfade = new Tone.CrossFade(TUNING.delayWet);
  const echoInputGain = new Tone.Gain(TUNING.echoInputGain);

  // Feedback loop: delay out → filter → saturator → gain → delay in
  echoDelay.connect(echoFilter);
  echoFilter.connect(echoSat);
  echoSat.connect(echoFeedbackGain);
  echoFeedbackGain.connect(echoDelay);

  const reverb = new Tone.Freeverb({
    roomSize: TUNING.reverbRoom,
    dampening: TUNING.reverbDamp,
  });
  reverb.wet.value = TUNING.reverbWet;

  const reverbPreDelay = new Tone.Delay({ delayTime: 0.025, maxDelay: 0.1 });
  reverbPreDelay.connect(reverb);

  // Damp sweep — sinusoidal modulation of reverb dampening.
  // Sweeps the comb filter cutoff for evolving resonance morphing.
  // depth=0 disables. At depth=1, sweeps full range around center.
  const dampSweep = {
    rate: TUNING.dampSweepRate,
    depth: TUNING.dampSweepDepth,
    center: TUNING.reverbDamp,
    _phase: 0,
    _eventId: null,
    start() {
      if (this._eventId !== null) this.stop();
      if (Tone.Transport.state !== "started") Tone.Transport.start();
      const tickSec = 0.05;
      this._eventId = Tone.Transport.scheduleRepeat(() => {
        if (this.depth <= 0) return;
        this._phase += 2 * Math.PI * this.rate * tickSec;
        if (this._phase > 2 * Math.PI) this._phase -= 2 * Math.PI;
        const mod = Math.sin(this._phase);
        const logCenter = Math.log(this.center);
        const logRange = this.depth * 2.5;
        const val = Math.exp(logCenter + mod * logRange);
        reverb.dampening = Math.max(200, Math.min(8000, val));
      }, tickSec);
    },
    stop() {
      if (this._eventId !== null) {
        Tone.Transport.clear(this._eventId);
        this._eventId = null;
      }
    },
  };
  dampSweep.start();

  const monitorEQ = new Tone.EQ3({
    low: 0,
    mid: 0,
    high: 0,
    lowFrequency: TUNING.monitorLowFreq,
    highFrequency: TUNING.monitorHighFreq,
  });

  const phaser = new Tone.Phaser({
    frequency: TUNING.phaserFreq,
    octaves: TUNING.phaserOctaves,
    baseFrequency: TUNING.phaserBase,
    Q: TUNING.phaserQ,
  });
  phaser.wet.value = TUNING.phaserWet;

  const chorus = new Tone.Chorus({
    frequency: TUNING.chorusFreq,
    delayTime: TUNING.chorusDelay,
    depth: TUNING.chorusDepth,
  });
  chorus.wet.value = TUNING.chorusWet;

  const distortion = new Tone.Distortion({
    distortion: TUNING.distortion,
    oversample: "none",
  });
  distortion.wet.value = TUNING.distortionWet;

  // tanh soft clip — preserves Freeverb resonant peaks that Limiter(-1) killed
  const softClip = new Tone.WaveShaper((val) => Math.tanh(val), 4096);
  softClip.oversample = "none";

  // Summing bus — all panners feed here so voices intermodulate through Chebyshev
  const sumBus = new Tone.Gain(1);

  const highpass = new Tone.Filter({
    frequency: TUNING.highpassFreq,
    type: "highpass",
    rolloff: TUNING.highpassRolloff,
  });
  sumBus.connect(highpass);

  // ─── Chain builder ───
  function wireChain(src, nodes, config) {
    const { order, bypass } = config;
    let prev = src;
    for (const name of order) {
      if (name === "ECHO") {
        prev.connect(nodes.echoCrossfade.a);
        prev.connect(nodes.echoInputGain);
        nodes.echoInputGain.connect(nodes.echoDelay);
        nodes.echoDelay.connect(nodes.echoCrossfade.b);
        prev = nodes.echoCrossfade;
      } else {
        prev.connect(nodes[name]);
        prev = nodes[name];
      }
    }
    prev.toDestination();

    const bypassState = {};
    const bypassable = {};
    for (const [name, cfg] of Object.entries(bypass)) {
      bypassState[name] = true;
      bypassable[name] = {
        node: nodes[name],
        prev: nodes[cfg.after],
        next: nodes[cfg.before],
      };
    }
    return { bypassState, bypassable };
  }

  const chainNodes = {
    chebyshev,
    eq3,
    vibrato,
    reverb: reverbPreDelay, // chain sees this as "reverb" node, pre-delay feeds actual reverb
    chorus,
    monitorEQ,
    softClip,
    phaser,
    distortion,
    echoCrossfade,
    echoDelay,
    echoInputGain,
  };
  await yield_();
  const { bypassState, bypassable } = wireChain(
    highpass,
    chainNodes,
    CHAINS[ACTIVE_CHAIN],
  );

  function setBypass(name, bypassed) {
    if (bypassState[name] === bypassed) return;
    const b = bypassable[name];
    try {
      if (bypassed) {
        if (b.node.wet) {
          b.node.wet.rampTo(0, 0.05);
          setTimeout(() => {
            try {
              b.prev.disconnect(b.node);
              b.node.disconnect(b.next);
              b.prev.connect(b.next);
            } catch (e) {
              /* ignore */
            }
          }, 60);
        } else {
          b.prev.disconnect(b.node);
          b.node.disconnect(b.next);
          b.prev.connect(b.next);
        }
      } else {
        b.prev.disconnect(b.next);
        b.prev.connect(b.node);
        b.node.connect(b.next);
        if (b.node.wet) b.node.wet.rampTo(b.node.wet.value || 1, 0.05);
      }
      bypassState[name] = bypassed;
    } catch (e) {
      /* ignore */
    }
  }

  // ─── Per-sign synths + panners ──────────────────────────

  const synths = {};
  const panners = {};
  const spreadTracker = {};

  Object.entries(SIGN_CHARACTER).forEach(([name, cfg]) => {
    const panner = new Tone.Panner(cfg.panBase);
    const synth = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: 1,
      voice: Tone.Synth,
      options: {
        oscillator: {
          type: cfg.oscType,
          ...(cfg.oscType.startsWith("fat")
            ? { count: cfg.oscCount, spread: cfg.oscSpread }
            : {}),
        },
        envelope: {
          attack: TUNING.attack * cfg.attackMul,
          decay: TUNING.decay * cfg.decayMul,
          sustain: Math.min(1, TUNING.sustain * cfg.sustainMul),
          release: TUNING.release * cfg.releaseMul,
        },
        volume: -9 + (OCTAVE_GAIN[cfg.octave] || 0),
      },
    });
    synth.set({ detune: cfg.detuneCents });
    synth.connect(panner);
    panner.connect(sumBus);
    synths[name] = synth;
    panners[name] = panner;
    spreadTracker[name] = cfg.oscSpread;
  });
  await yield_();

  const oscTypeTracker = Object.fromEntries(
    Object.entries(SIGN_CHARACTER).map(([name, cfg]) => [name, cfg.oscType]),
  );

  const detuneTracker = Object.fromEntries(
    Object.keys(SIGN_CHARACTER).map((s) => [s, SIGN_CHARACTER[s].detuneCents]),
  );

  // ─── Chart B synth bank — same per-sign oscTypes, mirrored pan ──
  const synthsB = {};
  const pannersB = {};
  const spreadTrackerB = {};

  Object.entries(SIGN_CHARACTER).forEach(([name, cfg]) => {
    const pannerB = new Tone.Panner(-cfg.panBase * 0.3);
    const synthB = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: 1,
      voice: Tone.Synth,
      options: {
        oscillator: {
          type: cfg.oscType,
          ...(cfg.oscType.startsWith("fat")
            ? { count: cfg.oscCount, spread: cfg.oscSpread }
            : {}),
        },
        envelope: {
          attack: TUNING.attack * cfg.attackMul,
          decay: TUNING.decay * cfg.decayMul,
          sustain: Math.min(1, TUNING.sustain * cfg.sustainMul),
          release: TUNING.release * cfg.releaseMul,
        },
        volume: -9 + (OCTAVE_GAIN[cfg.octave] || 0),
      },
    });
    synthB.set({ detune: cfg.detuneCents });
    synthB.connect(pannerB);
    pannerB.connect(sumBus);
    synthsB[name] = synthB;
    pannersB[name] = pannerB;
    spreadTrackerB[name] = cfg.oscSpread;
  });

  const oscTypeTrackerB = Object.fromEntries(
    Object.entries(SIGN_CHARACTER).map(([name, cfg]) => [name, cfg.oscType]),
  );

  const detuneTrackerB = Object.fromEntries(
    Object.keys(SIGN_CHARACTER).map((s) => [s, SIGN_CHARACTER[s].detuneCents]),
  );

  // ─── Group LFOs — one per panGroup, drift all panners in that group ──

  const panLfos = {};
  ["A", "B", "C", "D"].forEach((group) => {
    const lfo = new Tone.LFO({ frequency: TUNING.panLfoFreq, min: -1, max: 1 });
    lfo.amplitude.value = TUNING.panLfoAmplitude;
    lfo.start();
    Object.entries(SIGN_CHARACTER).forEach(([name, cfg]) => {
      if (cfg.panGroup === group) lfo.connect(panners[name].pan);
    });
    panLfos[group] = lfo;
  });

  return {
    synths,
    panners,
    panLfos,
    spreadTracker,
    detuneTracker,
    oscTypeTracker,
    synthsB,
    pannersB,
    spreadTrackerB,
    detuneTrackerB,
    oscTypeTrackerB,
    setBypass,
    fx: {
      reverb,
      echoDelay,
      echoFeedbackGain,
      echoFilter,
      echoSat,
      echoCrossfade,
      echoInputGain,
      chorus,
      vibrato,
      chebyshev,
      eq3,
      monitorEQ,
      phaser,
      distortion,
      dampSweep,
    },
    dispose() {
      dampSweep.stop();
      Object.values(synths).forEach((s) => s.dispose());
      Object.values(panners).forEach((p) => p.dispose());
      Object.values(synthsB).forEach((s) => s.dispose());
      Object.values(pannersB).forEach((p) => p.dispose());
      Object.values(panLfos).forEach((l) => l.dispose());
      [
        sumBus,
        highpass,
        chebyshev,
        distortion,
        eq3,
        vibrato,
        echoDelay,
        echoFeedbackGain,
        echoFilter,
        echoSat,
        echoCrossfade,
        echoInputGain,
        chorus,
        reverbPreDelay,
        reverb,
        phaser,
        monitorEQ,
        softClip,
      ].forEach((n) => n.dispose());
    },
  };
}

// ─── Component ───────────────────────────────────────────────

// Reusable gradient data pool — avoids per-frame heap allocation in rAF loop
const _GRAD_POOL = Array.from({ length: 24 }, () => ({
  sign: '', cx: 0, cy: 0, r: 0, g: 0, b: 0, alpha: 0, falloff: 0,
}));
let _gradCount = 0;
let _prevLevelSum = -1;
let _prevGradCount = -1;

// ─── Diagnostics ──────────────────────────────────────────────
const _DEBUG = typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('debug');

const _diag = {
  frameGaps: new Float32Array(512),  // circular: last ~17s of frame gaps @30fps
  frameGapIdx: 0,
  frameGapCount: 0,
  frameDrops: 0,
  _prevTickTime: 0,

  longTasks: [],      // capped at 64 — entries from PerformanceObserver longtask
  _ltMax: 64,

  gradCacheHits: 0,
  gradCacheMisses: 0,

  driftSamples: new Float32Array(128),  // circular: clock drift probe (ms)
  driftIdx: 0,
  driftCount: 0,
  _driftFrameCounter: 0,
  lastDriftMs: 0,

  ctxStateLog: [],   // [{state, time}] — AudioContext state transitions
  engine: null,
  ctx: null,
  driftUnderruns: 0,      // samples where drift < -2ms
  noteEvents: [],         // capped at 100 — [{type, sign, time}]
  audioInfo: null,        // set after engine init: {baseLatency, outputLatency, bufferSize, sampleRate}
};

if (typeof PerformanceObserver !== 'undefined') {
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (_diag.longTasks.length >= _diag._ltMax) _diag.longTasks.shift();
        _diag.longTasks.push({ start: e.startTime, duration: e.duration });
      }
    }).observe({ entryTypes: ['longtask'] });
  } catch (_) {}
}

// ─── Platform detection ───────────────────────────────────────
const _platform = (() => {
  if (typeof window === 'undefined') return {};
  const ua = navigator.userAgent;
  return {
    isIOS: /iPad|iPhone|iPod/.test(ua) && !window.MSStream,
    isAndroid: /Android/.test(ua),
    isSafari: /^((?!chrome|android).)*safari/i.test(ua),
    isChrome: /Chrome/.test(ua),
    ua: ua.slice(0, 150),
  };
})();

if (typeof window !== 'undefined') {
  window.__selekta = {
    get diag() { return _diag; },
    get frameDrops() { return _diag.frameDrops; },
    get longTasks() { return _diag.longTasks; },
    get gradCacheRatio() {
      const t = _diag.gradCacheHits + _diag.gradCacheMisses;
      return t ? (_diag.gradCacheHits / t * 100).toFixed(1) + '%' : 'n/a';
    },
    get lastDriftMs() { return _diag.lastDriftMs; },
    get ctxStateLog() { return _diag.ctxStateLog; },
    get engine() { return _diag.engine; },
    get ctx() { return _diag.ctx; },
    get debug() { return _DEBUG; },
    get platform() { return _platform; },
    get audioInfo() { return _diag.audioInfo; },
    get driftUnderruns() { return _diag.driftUnderruns; },
    get noteEvents() { return _diag.noteEvents; },

    summary() {
      const t = _diag.gradCacheHits + _diag.gradCacheMisses;
      const cacheRate = t ? (_diag.gradCacheHits / t * 100).toFixed(1) : 'n/a';
      const recentLt = _diag.longTasks.slice(-5)
        .map(e => `  ${e.duration.toFixed(0)}ms @+${(e.start/1000).toFixed(1)}s`)
        .join('\n') || '  (none)';
      return [
        '=== Selekta Diagnostics ===',
        `Platform: ${_platform.isIOS ? 'iOS' : _platform.isAndroid ? 'Android' : 'desktop'} | ${_platform.isSafari ? 'Safari' : _platform.isChrome ? 'Chrome' : 'other'}`,
        `AudioContext: ${_diag.ctx?.rawContext?.state ?? 'no engine'}`,
        `Audio buffer: ${_diag.audioInfo ? `${_diag.audioInfo.bufferSize ?? '?'} samples (${_diag.audioInfo.baseLatency != null ? (_diag.audioInfo.baseLatency * 1000).toFixed(1) + 'ms base latency)' : 'latency unknown)'}` : 'n/a'}`,
        `Frames logged: ${_diag.frameGapCount}  |  drops (>50ms): ${_diag.frameDrops}`,
        `Clock drift: ${_diag.driftCount > 0 ? _diag.lastDriftMs.toFixed(2) : 'n/a'} ms  |  underruns (<-2ms): ${_diag.driftUnderruns} / ${_diag.driftCount}`,
        `Gradient cache: ${cacheRate}% hit  (${_diag.gradCacheHits}H / ${_diag.gradCacheMisses}M)`,
        `Long tasks (last 5):\n${recentLt}`,
        `Note events logged: ${_diag.noteEvents.length}`,
        `State transitions: ${_diag.ctxStateLog.length}`,
        `Debug mode: ${_DEBUG ? 'ON (perf marks active)' : 'OFF (?debug to enable)'}`,
      ].join('\n');
    },

    reset() {
      _diag.frameGaps.fill(0); _diag.frameGapIdx = 0;
      _diag.frameGapCount = 0; _diag.frameDrops = 0; _diag._prevTickTime = 0;
      _diag.longTasks.length = 0;
      _diag.gradCacheHits = 0; _diag.gradCacheMisses = 0;
      _diag.driftSamples.fill(0); _diag.driftIdx = 0;
      _diag.driftCount = 0; _diag._driftFrameCounter = 0; _diag.lastDriftMs = 0;
      _diag.driftUnderruns = 0;
      _diag.noteEvents.length = 0;
      _diag.audioInfo = null;
      _diag.ctxStateLog.length = 0;
      console.log('[selekta] diagnostics reset');
    },

    frameStats() {
      const gaps = [..._diag.frameGaps].filter(g => g > 0).sort((a, b) => a - b);
      if (!gaps.length) return 'no data';
      const pct = (p) => gaps[Math.floor(gaps.length * p)] ?? 0;
      return { count: gaps.length, p50: pct(0.5).toFixed(1), p95: pct(0.95).toFixed(1), p99: pct(0.99).toFixed(1), max: gaps[gaps.length-1].toFixed(1) };
    },
  };
}

export default function App() {
  const engineRef = useRef(null);
  const [status, setStatus] = useState("idle");
  const [activeSigns, setActiveSigns] = useState(new Set());
  const [shadow, setShadow] = useState(false);
  const [oscIndex, setOscIndex] = useState(null);
  const [listenPreset, setListenPreset] = useState(DETECTED_LISTEN_PRESET);
  const shadowIntervalsRef = useRef([]);
  const visualStateRef = useRef({});
  const keyRefsRef = useRef({});
  const rootRef = useRef(null);
  const emanationRef = useRef(null);
  const shadowRef = useRef(false);
  const pendingOscTypeRef = useRef(null);
  const activeOscTypeRef = useRef(null);
  const canvasCtxRef = useRef(null);
  const rafIdRef = useRef(null);
  const lastFrameTimeRef = useRef(null);
  const keyPositionsRef = useRef({});
  const startLoopRef = useRef(null);
  const lastGlowRef = useRef({});
  const lastAccentRef = useRef(null);
  const colorIndexRef = useRef({});
  const [natalDate, setNatalDate] = useState("1968-01-22");
  const [natalTime, setNatalTime] = useState("");
  const [natalLat, setNatalLat] = useState("39.96");
  const [natalLng, setNatalLng] = useState("-82.99");
  const [natalActivations, setNatalActivations] = useState({});
  // Chart B state
  const [natalDateB, setNatalDateB] = useState("");
  const [natalTimeB, setNatalTimeB] = useState("");
  const [natalLatB, setNatalLatB] = useState("39.96");
  const [natalLngB, setNatalLngB] = useState("-82.99");
  const [natalActivationsB, setNatalActivationsB] = useState({});
  const [activeSignsB, setActiveSignsB] = useState(new Set());
  const [chartMode, setChartMode] = useState("A"); // "A" or "B"
  const [copyFeedback, setCopyFeedback] = useState(false);
  const initParams = () =>
    Object.fromEntries(
      Object.entries(KNOB_DEFS).map(([k, d]) => [k, d.default]),
    );
  const [params, setParams] = useState(initParams);
  const renderThrottleRef = useRef(0);
  const trailingRenderRef = useRef(null);
  const gradientCacheRef = useRef({});
  const paramsRef = useRef(initParams());
  const natalDebounceARef = useRef(null);
  const natalDebounceBRef = useRef(null);
  const natalGenARef = useRef(0);
  const natalGenBRef = useRef(0);
  const activeSignsARef = useRef(new Set());
  const activeSignsBRef = useRef(new Set());

  const setParam = useCallback((name, value) => {
    const p = paramsRef.current;
    p[name] = value;
    const eng = engineRef.current;
    if (eng) KNOB_MAP[name]?.apply(eng, value);

    clearTimeout(trailingRenderRef.current);
    const now = performance.now();
    if (now - renderThrottleRef.current > 50) {
      renderThrottleRef.current = now;
      setParams({ ...p });
    } else {
      trailingRenderRef.current = setTimeout(() => {
        setParams({ ...paramsRef.current });
      }, 60);
    }
  }, []);

  // Stable callbacks — one per param, never re-created
  const paramSetters = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(KNOB_DEFS).map((name) => [name, (v) => setParam(name, v)]),
      ),
    [setParam],
  );

  const randomizeParams = useCallback(() => {
    const eng = engineRef.current;
    const newParams = {};
    for (const [name, def] of Object.entries(KNOB_DEFS)) {
      const norm = Math.random();
      const props =
        def.scale === "log"
          ? logMap(def.min, def.max)
          : def.scale === "step"
            ? stepMap(def.min, def.max)
            : null;
      const value = props
        ? props.mapFromNorm(norm)
        : def.min + norm * (def.max - def.min);
      newParams[name] = value;
      if (eng) KNOB_MAP[name]?.apply(eng, value);
    }
    paramsRef.current = newParams;
    setParams(newParams);
  }, []);

  const buildSnapshot = useCallback(() => ({
    meta: { name: "untitled", timestamp: new Date().toISOString(), version: "v12" },
    chain: ACTIVE_CHAIN,
    oscType: oscIndex === null ? "per-sign" : OSC_TYPES[oscIndex],
    signs: Object.fromEntries(SIGN_NAMES.map(s => [s, activeSigns.has(s)])),
    knobs: { ...paramsRef.current },
    listen: listenPreset,
    eclipse: shadow,
  }), [oscIndex, activeSigns, listenPreset, shadow]);

  const exportSnapshot = useCallback(() => {
    const snap = buildSnapshot();
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `celezdial-snapshot-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [buildSnapshot]);

  const copySnapshot = useCallback(() => {
    const snap = buildSnapshot();
    navigator.clipboard.writeText(JSON.stringify(snap, null, 2)).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1200);
    });
  }, [buildSnapshot]);

  // Pre-computed format functions — stable references for React.memo
  const formatFns = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(KNOB_DEFS).map(([name, def]) => [
          name,
          (v) => formatValue(v, def),
        ]),
      ),
    [],
  );

  // Pre-computed grouped knobs with row support for side-by-side pairs
  const groupedKnobs = useMemo(() => {
    const groups = KNOB_GROUPS.map(({ key, label, row }) => ({
      key,
      label,
      row,
      knobs: Object.entries(KNOB_DEFS).filter(([_, d]) => d.group === key),
    }));
    const result = [];
    const seen = new Set();
    for (const g of groups) {
      if (seen.has(g.key)) continue;
      seen.add(g.key);
      if (g.row != null) {
        const partners = groups.filter(
          (x) => x.row === g.row && !seen.has(x.key),
        );
        partners.forEach((p) => seen.add(p.key));
        result.push({ type: "row", groups: [g, ...partners] });
      } else {
        result.push({ type: "single", ...g });
      }
    }
    return result;
  }, []);


  useEffect(() => {
    return () => {
      shadowIntervalsRef.current.forEach((id) => Tone.Transport.clear(id));
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
      _enginePromise = null;
    };
  }, []);

  useEffect(() => {
    shadowRef.current = shadow;
  }, [shadow]);

  // ─── iOS audio lifecycle recovery ─────────────────────────────
  // Handles: interrupted state (phone call, Siri, notifications),
  // tab backgrounding, screen lock, bfcache restore.
  useEffect(() => {
    const tryResume = async () => {
      try {
        if (!Tone) return;
        if (Tone.getContext()?.rawContext?.state !== "running") {
          await Tone.start();
          const raw = Tone.getContext()?.rawContext;
          if (raw && raw.state !== "running") await raw.resume();
        }
      } catch (_) {}
    };

    // Resume on tab/app restore
    const onVisibility = () => {
      if (!document.hidden) tryResume();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Resume on any touch (catches interrupted state after phone calls)
    const onTouch = () => tryResume();
    document.addEventListener("touchend", onTouch, { passive: true });

    // Handle bfcache restore (user hits back)
    const onPageShow = (e) => {
      if (e.persisted) tryResume();
    };
    window.addEventListener("pageshow", onPageShow);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("touchend", onTouch);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  // ─── Position cache (eliminates getBoundingClientRect in rAF) ──
  useEffect(() => {
    const updatePositions = () => {
      const rootEl = rootRef.current;
      if (!rootEl) return;
      const rr = rootEl.getBoundingClientRect();
      const positions = {};
      for (const sign of KEYBOARD_ORDER) {
        const el = keyRefsRef.current[sign];
        if (el) {
          const kr = el.getBoundingClientRect();
          positions[sign] = {
            cx: kr.left + kr.width / 2 - rr.left,
            cy: kr.top + kr.height / 2 - rr.top,
          };
        }
      }
      keyPositionsRef.current = positions;
      // Size canvas to match root + cache 2d context
      const canvas = emanationRef.current;
      if (canvas) {
        canvas.width = rr.width;
        canvas.height = rr.height;
        canvasCtxRef.current = canvas.getContext("2d");
        gradientCacheRef.current = {};
      }
    };
    updatePositions();
    const ro = new ResizeObserver(updatePositions);
    if (rootRef.current) ro.observe(rootRef.current);
    window.addEventListener("resize", updatePositions);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updatePositions);
    };
  }, []);

  // ─── Visual color engine (rAF loop) ─────────────────────────
  // Each active planet holds a fixed color (one of 4 colorful palette entries).
  // On release, that color lerps toward #0c0c0c — light dissolves into void.
  // Loop only runs when planets are active (idle = no rAF = saves battery).
  useEffect(() => {
    const [darkR, darkG, darkB] = hexToRgb(COLOR_OFF);

    const tick = (now) => {
      if (now - lastFrameTimeRef.current < 33) {
        requestAnimationFrame(tick);
        return;
      }
      lastFrameTimeRef.current = now;

      // ── Diagnostic: frame timing ──
      if (_DEBUG) {
        if (_diag.frameGapCount > 0) {
          const _gap = now - _diag._prevTickTime;
          _diag.frameGaps[_diag.frameGapIdx++ % 512] = _gap;
          if (_gap > 50) _diag.frameDrops++;
        }
        _diag._prevTickTime = now;
        _diag.frameGapCount++;
      }

      // ── Diagnostic: clock drift probe (every 32 frames) ──
      if (_DEBUG) {
        if (_diag.ctx && ++_diag._driftFrameCounter >= 8) {
          _diag._driftFrameCounter = 0;
          const _raw = _diag.ctx.rawContext;
          if (_raw.state === 'running' && _raw.getOutputTimestamp) {
            const _ts = _raw.getOutputTimestamp();
            if (_ts.contextTime > 0) {
              const _drift = (_raw.currentTime -
                (_ts.contextTime + (performance.now() - _ts.performanceTime) / 1000)) * 1000;
              _diag.driftSamples[_diag.driftIdx++ % 128] = _drift;
              _diag.driftCount++;
              _diag.lastDriftMs = _drift;
              if (_drift < -2) {
                _diag.driftUnderruns++;
                console.warn(`[selekta] clock drift ${_drift.toFixed(1)}ms — scheduling starvation`);
              }
            }
          }
        }
      }

      if (_DEBUG) performance.mark('selekta:tick-start');

      let blendR = 0,
        blendG = 0,
        blendB = 0,
        totalWeight = 0;
      _gradCount = 0;
      let hasActive = false;

      for (const vsKey in visualStateRef.current) {
        const vs = visualStateRef.current[vsKey];
        if (!vs) continue;
        hasActive = true;
        // Strip _B suffix for element/position lookups
        const sign = vsKey.endsWith("_B") ? vsKey.slice(0, -2) : vsKey;
        if (now < vs.startTime) continue;
        const elapsed = (now - vs.startTime) / 1000;
        let level = vs.envelopeLevel;

        switch (vs.stage) {
          case "attack":
            level = Math.min(1, elapsed / vs.attackTime);
            if (level >= 1) {
              vs.stage = "decay";
              vs.startTime = now;
            }
            break;
          case "decay": {
            const dp = Math.min(1, elapsed / vs.decayTime);
            level = 1 - (1 - vs.sustainLevel) * dp;
            if (dp >= 1) vs.stage = "sustain";
            break;
          }
          case "sustain":
            level = vs.sustainLevel;
            break;
          case "release": {
            const rp = Math.min(1, elapsed / vs.releaseTime);
            level = vs.releaseStartLevel * (1 - rp);
            if (rp >= 1) {
              vs.stage = "idle";
              level = 0;
            }
            break;
          }
          default:
            level = 0;
        }
        vs.envelopeLevel = level;

        const [ar, ag, ab] = vs.activeColor;
        let r = ar,
          g = ag,
          b = ab;

        if (vs.stage === "release" && vs.releaseStartLevel > 0.001) {
          const rp = 1 - level / vs.releaseStartLevel;
          r = Math.round(ar + (darkR - ar) * rp);
          g = Math.round(ag + (darkG - ag) * rp);
          b = Math.round(ab + (darkB - ab) * rp);
        }

        // Key glow — write only when changed (dirty flag)
        const glowAlpha = level > 0.01 ? Math.round(Math.min(level * 0.7, 0.45) * 100) / 100 : 0;
        // Cache rgb string — only rebuild when color changes
        if (vs._prevR !== r || vs._prevG !== g || vs._prevB !== b) {
          vs._glowRgb = `rgb(${r},${g},${b})`;
          vs._prevR = r; vs._prevG = g; vs._prevB = b;
        }
        const el = keyRefsRef.current[sign];
        if (el) {
          const prevGlow = lastGlowRef.current[vsKey];
          if (prevGlow !== glowAlpha) {
            el.style.setProperty(
              "--glow-hue",
              glowAlpha > 0 ? vs._glowRgb : "transparent",
            );
            if (vs._prevGlowAlpha !== glowAlpha) {
              vs._glowAlphaStr = String(glowAlpha);
              vs._prevGlowAlpha = glowAlpha;
            }
            el.style.setProperty("--glow-opacity", vs._glowAlphaStr);
            lastGlowRef.current[vsKey] = glowAlpha;
          }
        }

        // Emanation — push data for canvas draw (no strings, no getBoundingClientRect)
        const pos = keyPositionsRef.current[sign];
        if (pos && level > 0.01 && _gradCount < _GRAD_POOL.length) {
          const _gd = _GRAD_POOL[_gradCount++];
          _gd.sign = vsKey;
          _gd.cx = pos.cx;
          _gd.cy = pos.cy;
          _gd.r = r;
          _gd.g = g;
          _gd.b = b;
          _gd.alpha = level * 0.38;
          _gd.falloff = shadowRef.current ? 95 : 78;
        }

        if (level > 0.01) {
          blendR += ar * level;
          blendG += ag * level;
          blendB += ab * level;
          totalWeight += level;
        }

        if (vs.stage === "idle") {
          if (el) {
            el.style.setProperty("--glow-opacity", "0");
            lastGlowRef.current[vsKey] = 0;
          }
          visualStateRef.current[vsKey] = null; // preserve V8 hidden class
        }
      }

      // Canvas emanation — single GPU-composited draw
      // Skip redraw if level sum and active sign count are unchanged (e.g. during sustain).
      const _canvasDirty = Math.abs(totalWeight - _prevLevelSum) > 0.003 || _gradCount !== _prevGradCount;
      _prevLevelSum = totalWeight;
      _prevGradCount = _gradCount;

      const canvas = emanationRef.current;
      const ctx = canvasCtxRef.current;
      if (canvas && ctx && _canvasDirty) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (_gradCount > 0) {
          const canvasH = canvas.height;
          const _cache = gradientCacheRef.current;
          for (let i = 0; i < _gradCount; i++) {
            const gd = _GRAD_POOL[i];
            const radius = ((canvasH * gd.falloff) / 100) | 0;
            const cx = gd.cx | 0, cy = gd.cy | 0;
            let entry = _cache[gd.sign];
            if (
              !entry ||
              entry.r !== gd.r || entry.g !== gd.g || entry.b !== gd.b ||
              entry.cx !== cx || entry.cy !== cy ||
              entry.radius !== radius
            ) {
              const ng = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
              ng.addColorStop(0, `rgba(${gd.r},${gd.g},${gd.b},1)`);
              ng.addColorStop(1, `rgba(${gd.r},${gd.g},${gd.b},0)`);
              entry = { grad: ng, r: gd.r, g: gd.g, b: gd.b, cx, cy, radius };
              _cache[gd.sign] = entry;
              _diag.gradCacheMisses++;
            } else {
              _diag.gradCacheHits++;
            }
            ctx.globalAlpha = gd.alpha;
            ctx.fillStyle = entry.grad;
            ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
          }
          ctx.globalAlpha = 1;
        }
      }

      // Knob accent — skip write if unchanged
      const rootEl = rootRef.current;
      if (rootEl) {
        let accent;
        if (totalWeight > 0.01) {
          accent = rgbToHex(
            Math.round(blendR / totalWeight),
            Math.round(blendG / totalWeight),
            Math.round(blendB / totalWeight),
          );
        } else {
          accent = KNOB_DEFAULT_COLOR;
        }
        if (accent !== lastAccentRef.current) {
          rootEl.style.setProperty("--knob-accent", accent);
          lastAccentRef.current = accent;
        }
      }

      if (_DEBUG) performance.measure('selekta:tick', 'selekta:tick-start');

      // Idle detection — stop rAF when nothing is active
      if (hasActive) {
        rafIdRef.current = requestAnimationFrame(tick);
      } else {
        rafIdRef.current = null;
        lastFrameTimeRef.current = null;
      }
    };

    const startLoop = () => {
      if (!rafIdRef.current) rafIdRef.current = requestAnimationFrame(tick);
    };
    startLoopRef.current = startLoop;

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      lastFrameTimeRef.current = null;
    };
  }, []);

  const ensureEngine = useCallback(async () => {
    if (engineRef.current) return engineRef.current;
    // Serialize creation — all concurrent callers share one promise
    if (!_enginePromise) {
      _enginePromise = createEngine().then((eng) => {
        for (const [name, def] of Object.entries(KNOB_DEFS)) {
          KNOB_MAP[name]?.apply(eng, def.default);
        }
        // Apply detected listen preset EQ
        const lp = LISTEN_PRESETS[DETECTED_LISTEN_PRESET];
        if (lp && eng.fx.monitorEQ) {
          eng.fx.monitorEQ.low.value = lp.low;
          eng.fx.monitorEQ.mid.value = lp.mid;
          eng.fx.monitorEQ.high.value = lp.high;
        }
        engineRef.current = eng;
        _diag.engine = eng;
        setStatus("ready");
        return eng;
      });
    }
    return _enginePromise;
  }, []);

  // Pre-warm: start engine build on first user gesture anywhere on page.
  // Resolves the 1186ms init block so it's done before sign press.
  useEffect(() => {
    let warmed = false;
    const warm = () => {
      if (warmed) return;
      warmed = true;
      document.removeEventListener('pointerdown', warm, { capture: true });
      ensureEngine().catch(() => {});
    };
    document.addEventListener('pointerdown', warm, { capture: true, passive: true });
    return () => document.removeEventListener('pointerdown', warm, { capture: true });
  }, [ensureEngine]);

  // Apply pending osc type from breathe — used in toggleSign
  function applyPendingOscType(eng) {
    const t = pendingOscTypeRef.current;
    if (!t) return;
    const p = paramsRef.current;
    const applyToBank = (synths, oscTypes, spreadTrk) => {
      if (t === "per-sign") {
        for (const name of SIGN_NAMES) {
          const sc = SIGN_CHARACTER[name];
          synths[name].set({ oscillator: { type: sc.oscType } });
          oscTypes[name] = sc.oscType;
          if (sc.oscType.startsWith("fat")) {
            synths[name].set({ oscillator: { count: sc.oscCount, spread: p.oscSpread } });
            spreadTrk[name] = p.oscSpread;
          }
          if (sc.oscType.startsWith("am") || sc.oscType.startsWith("fm")) {
            synths[name].set({ oscillator: { harmonicity: p.harmonicity } });
          }
          if (sc.oscType.startsWith("fm")) {
            synths[name].set({ oscillator: { modulationIndex: p.modulationIndex } });
          }
        }
      } else {
        const isFat = t.startsWith("fat");
        const isAMFM = t.startsWith("am") || t.startsWith("fm");
        const isFM = t.startsWith("fm");
        for (const name of SIGN_NAMES) {
          synths[name].set({ oscillator: { type: t } });
          oscTypes[name] = t;
          if (isFat) {
            synths[name].set({
              oscillator: {
                count: SIGN_CHARACTER[name].oscCount,
                spread: p.oscSpread,
              },
            });
            spreadTrk[name] = p.oscSpread;
          }
          if (isAMFM) {
            synths[name].set({ oscillator: { harmonicity: p.harmonicity } });
          }
          if (isFM) {
            synths[name].set({ oscillator: { modulationIndex: p.modulationIndex } });
          }
        }
      }
    };
    applyToBank(eng.synths, eng.oscTypeTracker, eng.spreadTracker);
    applyToBank(eng.synthsB, eng.oscTypeTrackerB, eng.spreadTrackerB);
    pendingOscTypeRef.current = null;
  }

  // Restore spread + detune (Eclipse exit, Breathe shadow cleanup, toggleShadow exit)
  function restoreSpreadAndDetune(eng) {
    const spreadVal = paramsRef.current.oscSpread;
    for (const name of SIGN_NAMES) {
      const sc = SIGN_CHARACTER[name];
      const signType = activeOscTypeRef.current ?? sc.oscType;
      if (signType.startsWith("fat")) {
        eng.synths[name].set({ oscillator: { spread: spreadVal } });
        eng.spreadTracker[name] = spreadVal;
        eng.synthsB[name].set({ oscillator: { spread: spreadVal } });
        eng.spreadTrackerB[name] = spreadVal;
      }
      eng.synths[name].set({ detune: sc.detuneCents });
      eng.detuneTracker[name] = sc.detuneCents;
      eng.synthsB[name].set({ detune: sc.detuneCents });
      eng.detuneTrackerB[name] = sc.detuneCents;
    }
  }

  const toggleSign = useCallback(
    async (sign) => {
      const eng = await ensureEngine();
      const cfg = SIGN_CHARACTER[sign];
      if (!cfg) return;
      const note = `${cfg.note}${cfg.octave}`;
      const p = paramsRef.current || initParams();
      const attack = p.attack;
      const decay = p.decay;
      const sustain = p.sustain;
      const release = p.release;
      const isB = chartMode === "B" && natalDateB;
      const synths = isB ? eng.synthsB : eng.synths;
      const activations = isB ? natalActivationsB : natalActivations;
      const setSigns = isB ? setActiveSignsB : setActiveSigns;
      const chartColor = isB ? hexToRgb(CHART_B_COLOR) : null;

      const activeRef = isB ? activeSignsBRef : activeSignsARef;
      const otherRef = isB ? activeSignsARef : activeSignsBRef;

      setSigns((prev) => {
        const next = new Set(prev);
        if (next.has(sign)) {
          if (_diag.noteEvents.length >= 100) _diag.noteEvents.shift();
          _diag.noteEvents.push({ type: 'release', sign, bank: isB ? 'B' : 'A', time: performance.now() });
          synths[sign].releaseAll(Tone.now());
          synths[sign].set({ detune: cfg.detuneCents });
          next.delete(sign);
          const vsKey = isB ? `${sign}_B` : sign;
          const vs = visualStateRef.current[vsKey];
          if (vs) {
            vs.releaseStartLevel = vs.envelopeLevel;
            vs.stage = "release";
            vs.startTime = performance.now();
            vs.releaseTime = release * cfg.releaseMul;
          }
          activeRef.current = next;
          applyAdaptiveVoicing(eng, next.size + otherRef.current.size);
        } else {
          applyPendingOscType(eng);
          if (activations[sign]) {
            synths[sign].set({
              detune: activations[sign].detuneCents,
            });
          }
          next.add(sign);
          activeRef.current = next;
          applyAdaptiveVoicing(eng, next.size + otherRef.current.size);
          if (_diag.noteEvents.length >= 100) _diag.noteEvents.shift();
          _diag.noteEvents.push({ type: 'attack', sign, bank: isB ? 'B' : 'A', time: performance.now() });
          synths[sign].triggerAttack(note, Tone.now(), cfg.vel);
          const pal = SIGN_COLORS[sign];
          const ci = colorIndexRef.current[sign] || 0;
          colorIndexRef.current[sign] = (ci + 1) % 4;
          const vsKey = isB ? `${sign}_B` : sign;
          visualStateRef.current[vsKey] = {
            stage: "attack",
            startTime: performance.now(),
            envelopeLevel: 0,
            attackTime: attack * cfg.attackMul * VIS_SPEED,
            decayTime: decay * cfg.decayMul * VIS_SPEED,
            sustainLevel: Math.min(1, sustain * cfg.sustainMul),
            releaseTime: release * cfg.releaseMul * VIS_SPEED,
            releaseStartLevel: 0,
            activeColor: chartColor || (pal ? hexToRgb(pal[ci]) : [144, 112, 204]),
          };
          if (startLoopRef.current) startLoopRef.current();
        }
        setStatus(next.size > 0 || otherRef.current.size > 0 ? "playing" : "ready");
        return next;
      });
    },
    [ensureEngine, natalActivations, natalActivationsB, chartMode, natalDateB],
  );

  const handleKeyboardClick = useCallback(
    (e) => {
      const btn = e.target.closest("[data-sign]");
      if (btn) toggleSign(btn.dataset.sign);
    },
    [toggleSign],
  );

  const stopNatalPlayback = useCallback((eng) => {
    for (const name of SIGN_NAMES) {
      eng.synths[name].releaseAll(Tone.now());
      eng.synthsB[name].releaseAll(Tone.now());
    }
    const saved = paramsRef.current || initParams();
    eng.fx.reverb.wet.rampTo(saved.reverbWet, 0.5);
  }, []);

  const breathe = useCallback(async () => {
    const eng = await ensureEngine();
    if (shadow) {
      const { reverb, echoFeedbackGain, echoCrossfade, vibrato, chebyshev } =
        eng.fx;
      const rt = SHADOW.rampTime;
      const saved = paramsRef.current;
      shadowIntervalsRef.current.forEach((id) => Tone.Transport.clear(id));
      shadowIntervalsRef.current = [];
      reverb.wet.rampTo(saved.reverbWet, rt);
      echoFeedbackGain.gain.rampTo(saved.delayFeedback, rt);
      echoCrossfade.fade.rampTo(saved.delayWet, rt);
      vibrato.depth.rampTo(saved.vibratoDepth, rt);
      vibrato.frequency.rampTo(saved.vibratoFreq, rt);
      chebyshev.wet.rampTo(saved.chebyWet, rt);
      Object.values(eng.panLfos).forEach((lfo) => {
        lfo.frequency.rampTo(saved.panLfoFreq, rt);
        lfo.amplitude.rampTo(saved.panLfoAmplitude, rt);
      });
      restoreSpreadAndDetune(eng);
      setShadow(false);
    }
    // Cycle osc type — null → 0 → 1 → ... → 7 → null → ...
    const next =
      oscIndex === null
        ? 0
        : oscIndex + 1 >= OSC_TYPES.length
          ? null
          : oscIndex + 1;
    pendingOscTypeRef.current = next === null ? "per-sign" : OSC_TYPES[next];
    activeOscTypeRef.current = next === null ? null : OSC_TYPES[next];
    setOscIndex(next);
    // Apply immediately if notes are sounding
    if (activeSigns.size > 0) {
      applyPendingOscType(eng);
    }
  }, [activeSigns, ensureEngine, oscIndex, shadow]);

  const stopAll = useCallback(async () => {
    const eng = await ensureEngine();
    stopNatalPlayback(eng);
    const p = paramsRef.current || initParams();
    const release = p.release;
    for (const sign of activeSigns) {
      const vs = visualStateRef.current[sign];
      if (vs) {
        vs.releaseStartLevel = vs.envelopeLevel;
        vs.stage = "release";
        vs.startTime = performance.now();
        vs.releaseTime = release * SIGN_CHARACTER[sign].releaseMul * VIS_SPEED;
      }
    }
    for (const sign of activeSignsB) {
      const vs = visualStateRef.current[`${sign}_B`];
      if (vs) {
        vs.releaseStartLevel = vs.envelopeLevel;
        vs.stage = "release";
        vs.startTime = performance.now();
        vs.releaseTime = release * SIGN_CHARACTER[sign].releaseMul * VIS_SPEED;
      }
    }
    applyAdaptiveVoicing(eng, 0);
    activeSignsARef.current = new Set();
    activeSignsBRef.current = new Set();
    setActiveSigns(new Set());
    setActiveSignsB(new Set());
    setStatus("ready");
  }, [activeSigns, activeSignsB, ensureEngine, stopNatalPlayback]);

  const toggleShadow = useCallback(async () => {
    const eng = await ensureEngine();
    const { reverb, echoFeedbackGain, echoCrossfade, vibrato, chebyshev } =
      eng.fx;
    const st = SHADOW;

    if (!shadow) {
      const rt = st.rampTime;
      reverb.wet.rampTo(st.reverbWet, rt);
      echoFeedbackGain.gain.rampTo(st.delayFeedback, rt);
      echoCrossfade.fade.rampTo(st.delayWet, rt);
      vibrato.depth.rampTo(st.vibratoDepth, rt);
      vibrato.frequency.rampTo(st.vibratoFreq, rt);
      chebyshev.wet.rampTo(st.chebyWet, rt);

      Object.values(eng.panLfos).forEach((lfo) => {
        lfo.frequency.rampTo(st.panLfoFreq, rt);
        lfo.amplitude.rampTo(st.panLfoAmplitude, rt);
      });

      // Slow spread ramp — per-sign fat check (AM/FM signs skip spread)
      const intervals = [];
      const spreadEventId = Tone.Transport.scheduleRepeat(() => {
        let allDone = true;
        for (const name of SIGN_NAMES) {
          const signType =
            activeOscTypeRef.current ?? SIGN_CHARACTER[name].oscType;
          if (!signType.startsWith("fat")) continue;
          const current = eng.spreadTracker[name];
          if (current < st.oscSpread) {
            allDone = false;
            const next = Math.min(current + 4, st.oscSpread);
            eng.spreadTracker[name] = next;
            eng.synths[name].set({ oscillator: { spread: next } });
            eng.spreadTrackerB[name] = next;
            eng.synthsB[name].set({ oscillator: { spread: next } });
          }
        }
        if (allDone) Tone.Transport.clear(spreadEventId);
      }, 0.2);
      intervals.push(spreadEventId);

      // Smooth detune drift — lerp toward random targets
      const detuneId = Tone.Transport.scheduleRepeat(() => {
        for (const name of SIGN_NAMES) {
          const base = SIGN_CHARACTER[name]?.detuneCents || 0;
          const current = eng.detuneTracker[name] ?? base;
          const target = base + (Math.random() * 2 - 1) * st.detuneRange;
          const next = current + (target - current) * 0.3;
          eng.detuneTracker[name] = next;
          eng.synths[name].set({ detune: next });
          eng.detuneTrackerB[name] = next;
          eng.synthsB[name].set({ detune: next });
        }
      }, 1.2);
      intervals.push(detuneId);

      shadowIntervalsRef.current = intervals;
    } else {
      shadowIntervalsRef.current.forEach((id) => Tone.Transport.clear(id));
      shadowIntervalsRef.current = [];

      const rt = st.rampTime;
      const saved = paramsRef.current;
      reverb.wet.rampTo(saved.reverbWet, rt);
      echoFeedbackGain.gain.rampTo(saved.delayFeedback, rt);
      echoCrossfade.fade.rampTo(saved.delayWet, rt);
      vibrato.depth.rampTo(saved.vibratoDepth, rt);
      vibrato.frequency.rampTo(saved.vibratoFreq, rt);
      chebyshev.wet.rampTo(saved.chebyWet, rt);

      Object.values(eng.panLfos).forEach((lfo) => {
        lfo.frequency.rampTo(saved.panLfoFreq, rt);
        lfo.amplitude.rampTo(saved.panLfoAmplitude, rt);
      });

      restoreSpreadAndDetune(eng);
    }
    setShadow((s) => !s);
  }, [shadow, ensureEngine]);

  const applyListenPreset = useCallback(
    async (key) => {
      const eng = await ensureEngine();
      const preset = LISTEN_PRESETS[key];
      if (!preset || !eng.fx.monitorEQ) return;
      eng.fx.monitorEQ.low.value = preset.low;
      eng.fx.monitorEQ.mid.value = preset.mid;
      eng.fx.monitorEQ.high.value = preset.high;
      setListenPreset(key);
    },
    [ensureEngine],
  );

  const listenHandlers = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(LISTEN_PRESETS).map((k) => [k, () => applyListenPreset(k)]),
      ),
    [applyListenPreset],
  );

  // Pure chart computation — reused for both Chart A and Chart B
  const computeChart = useCallback(async (date, time, lat, lng) => {
    if (!date) return null;

    const { Origin, Horoscope } = await getHoroscope();

    const [year, month, day] = date.split("-").map(Number);
    let hour = 12,
      minute = 0;
    if (time) {
      [hour, minute] = time.split(":").map(Number);
    }

    const latitude = parseFloat(lat) || 0;
    const longitude = parseFloat(lng) || 0;

    const origin = new Origin({
      year,
      month: month - 1,
      date: day,
      hour,
      minute,
      latitude,
      longitude,
    });

    const chart = new Horoscope({
      origin,
      houseSystem: "whole-sign",
      zodiac: "tropical",
      aspectPoints: ["bodies", "points", "angles"],
      aspectWithPoints: ["bodies", "points", "angles"],
      aspectTypes: ["major"],
      language: "en",
    });

    const bodyMap = {
      Sun: "sun",
      Moon: "moon",
      Mercury: "mercury",
      Venus: "venus",
      Mars: "mars",
      Jupiter: "jupiter",
      Saturn: "saturn",
      Uranus: "uranus",
      Neptune: "neptune",
      Pluto: "pluto",
      Chiron: "chiron",
    };

    const activations = {};

    for (const [label, bodyKey] of Object.entries(bodyMap)) {
      const body = chart.CelestialBodies[bodyKey];
      if (!body) continue;
      const signName = body.Sign.label;
      const signKey = SIGNS_BY_LOWERCASE[signName.toLowerCase()];
      if (!signKey) continue;
      const degree = body.ChartPosition.Ecliptic.DecimalDegrees % 30;
      const detune = (degree - 15) * TUNING.centsPerDegree;
      if (!activations[signKey])
        activations[signKey] = { planets: [], detuneCents: detune };
      activations[signKey].planets.push(label);
    }

    let ascKey = null;
    if (time && chart.Ascendant?.Sign) {
      const ascSign = chart.Ascendant.Sign.label;
      ascKey = SIGNS_BY_LOWERCASE[ascSign.toLowerCase()];
      if (ascKey) {
        const degree =
          chart.Ascendant.ChartPosition.Ecliptic.DecimalDegrees % 30;
        const detune = (degree - 15) * TUNING.centsPerDegree;
        if (!activations[ascKey])
          activations[ascKey] = { planets: [], detuneCents: detune };
        activations[ascKey].planets.push("Ascendant");
      }
    }

    const bodies = {};
    for (const [label, bodyKey] of Object.entries(bodyMap)) {
      const body = chart.CelestialBodies[bodyKey];
      if (!body) continue;
      const signName = body.Sign.label;
      const signKey = SIGNS_BY_LOWERCASE[signName.toLowerCase()];
      if (!signKey) continue;
      bodies[label] = {
        sign: signKey,
        degree: body.ChartPosition.Ecliptic.DecimalDegrees % 30,
      };
    }
    if (ascKey) {
      bodies["Ascendant"] = {
        sign: ascKey,
        degree: chart.Ascendant.ChartPosition.Ecliptic.DecimalDegrees % 30,
      };
    }

    return { activations, bodies, hasTime: !!time };
  }, []);

  useEffect(() => {
    clearTimeout(natalDebounceARef.current);
    natalDebounceARef.current = setTimeout(async () => {
      const gen = ++natalGenARef.current;
      if (natalDate) {
        const result = await computeChart(natalDate, natalTime, natalLat, natalLng);
        if (gen !== natalGenARef.current) return;
        setNatalActivations(result ? result.activations : {});
      } else {
        setNatalActivations({});
      }
    }, 300);
    return () => clearTimeout(natalDebounceARef.current);
  }, [natalDate, natalTime, natalLat, natalLng, computeChart]);

  useEffect(() => {
    clearTimeout(natalDebounceBRef.current);
    natalDebounceBRef.current = setTimeout(async () => {
      const gen = ++natalGenBRef.current;
      if (natalDateB) {
        const result = await computeChart(natalDateB, natalTimeB, natalLatB, natalLngB);
        if (gen !== natalGenBRef.current) return;
        setNatalActivationsB(result ? result.activations : {});
      } else {
        setNatalActivationsB({});
      }
    }, 300);
    return () => clearTimeout(natalDebounceBRef.current);
  }, [natalDateB, natalTimeB, natalLatB, natalLngB, computeChart]);

  return (
    <>
      <style>{CSS}</style>
      <div
        className={`cel-root${shadow ? " cel-eclipse-active" : ""}`}
        ref={rootRef}
      >
        <canvas className="cel-emanation" ref={emanationRef} />
        <div className="cel-keyboard" onClick={handleKeyboardClick}>
          {NATURAL_KEYS.map(
            (sign) => {
              const cfg = SIGNS[sign];
              const activeA = activeSigns.has(sign);
              const activeB = activeSignsB.has(sign);
              const hasChartA = natalActivations[sign];
              const hasChartB = natalActivationsB[sign];
              return (
                <button
                  key={sign}
                  type="button"
                  ref={(el) => {
                    keyRefsRef.current[sign] = el;
                  }}
                  className={`cel-key cel-key-natural${activeA ? " cel-key-active-a" : ""}${activeB ? " cel-key-active-b" : ""}${activeA || activeB ? " cel-key-active" : ""}`}
                  data-sign={sign}
                >
                  {hasChartA && <span className="cel-chart-dot cel-chart-dot-a" />}
                  {hasChartB && <span className="cel-chart-dot cel-chart-dot-b" />}
                  <span className="cel-key-glyph">{cfg.glyph}</span>
                  <span className="cel-key-name">{sign}</span>
                  {(hasChartA || hasChartB) && (
                    <span className="cel-key-bodies">
                      {hasChartA && hasChartA.planets.map(p => (
                        <span key={`a-${p}`} className="cel-body-glyph cel-body-a">{BODY_GLYPHS[p] || p[0]}</span>
                      ))}
                      {hasChartB && hasChartB.planets.map(p => (
                        <span key={`b-${p}`} className="cel-body-glyph cel-body-b">{BODY_GLYPHS[p] || p[0]}</span>
                      ))}
                    </span>
                  )}
                  <span className="cel-key-note">{cfg.note}</span>
                </button>
              );
            },
          )}
          {SHARP_KEYS.map(
            (sign, i) => {
              const cfg = SIGNS[sign];
              const activeA = activeSigns.has(sign);
              const activeB = activeSignsB.has(sign);
              const hasChartA = natalActivations[sign];
              const hasChartB = natalActivationsB[sign];
              return (
                <button
                  key={sign}
                  type="button"
                  ref={(el) => {
                    keyRefsRef.current[sign] = el;
                  }}
                  className={`cel-key cel-key-sharp${activeA ? " cel-key-active-a" : ""}${activeB ? " cel-key-active-b" : ""}${activeA || activeB ? " cel-key-active" : ""}`}
                  style={SHARP_KEY_STYLES[i]}
                  data-sign={sign}
                >
                  {hasChartA && <span className="cel-chart-dot cel-chart-dot-a" />}
                  {hasChartB && <span className="cel-chart-dot cel-chart-dot-b" />}
                  <span className="cel-key-glyph">{cfg.glyph}</span>
                  <span className="cel-key-name">{sign}</span>
                </button>
              );
            },
          )}
        </div>

        {/* A/B mode toggle */}
        {natalDateB && (
          <div className="cel-ab-toggle">
            <button
              type="button"
              className={`cel-ab-pill${chartMode === "A" ? " cel-ab-active-a" : ""}`}
              onClick={() => setChartMode("A")}
            >Chart A</button>
            <button
              type="button"
              className={`cel-ab-pill${chartMode === "B" ? " cel-ab-active-b" : ""}`}
              onClick={() => setChartMode("B")}
            >Chart B</button>
          </div>
        )}

        <div className="cel-natal cel-natal-dual">
          <div className="cel-natal-body">
            <div className="cel-natal-chart-label" style={STYLE_CHART_A}>Chart A</div>
            <div className="cel-natal-inputs">
              <label className="cel-natal-field cel-pinned">
                <span>Birth date</span>
                <input
                  type="date"
                  className="cel-natal-input"
                  value={natalDate}
                  onChange={(e) => setNatalDate(e.target.value)}
                />
              </label>
              <label className="cel-natal-field cel-pinned">
                <span>Time</span>
                <input
                  type="time"
                  className="cel-natal-input"
                  value={natalTime}
                  onChange={(e) => setNatalTime(e.target.value)}
                />
              </label>
              <label
                className={`cel-natal-field${natalLat ? " has-value" : ""}`}
              >
                <span>Latitude</span>
                <input
                  type="number"
                  className="cel-natal-input"
                  value={natalLat}
                  onChange={(e) => setNatalLat(e.target.value)}
                  step="0.01"
                />
              </label>
              <label
                className={`cel-natal-field${natalLng ? " has-value" : ""}`}
              >
                <span>Longitude</span>
                <input
                  type="number"
                  className="cel-natal-input"
                  value={natalLng}
                  onChange={(e) => setNatalLng(e.target.value)}
                  step="0.01"
                />
              </label>
            </div>
          </div>

          <div className="cel-natal-body">
            <div className="cel-natal-chart-label" style={STYLE_CHART_B}>Chart B</div>
            <div className="cel-natal-inputs">
              <label className="cel-natal-field cel-pinned">
                <span>Birth date</span>
                <input
                  type="date"
                  className="cel-natal-input"
                  value={natalDateB}
                  onChange={(e) => setNatalDateB(e.target.value)}
                />
              </label>
              <label className="cel-natal-field cel-pinned">
                <span>Time</span>
                <input
                  type="time"
                  className="cel-natal-input"
                  value={natalTimeB}
                  onChange={(e) => setNatalTimeB(e.target.value)}
                />
              </label>
              <label
                className={`cel-natal-field${natalLatB ? " has-value" : ""}`}
              >
                <span>Latitude</span>
                <input
                  type="number"
                  className="cel-natal-input"
                  value={natalLatB}
                  onChange={(e) => setNatalLatB(e.target.value)}
                  step="0.01"
                />
              </label>
              <label
                className={`cel-natal-field${natalLngB ? " has-value" : ""}`}
              >
                <span>Longitude</span>
                <input
                  type="number"
                  className="cel-natal-input"
                  value={natalLngB}
                  onChange={(e) => setNatalLngB(e.target.value)}
                  step="0.01"
                />
              </label>
            </div>
          </div>

          {(activeSigns.size > 0 || activeSignsB.size > 0) && (
            <button type="button" className="cel-btn cel-natal-play" onClick={stopAll}>
              Stop
            </button>
          )}

          {/* Info panel — dual column showing both charts' placements */}
          {(Object.keys(natalActivations).length > 0 || Object.keys(natalActivationsB).length > 0) && (() => {
            const keysA = Object.keys(natalActivations);
            const keysB = Object.keys(natalActivationsB);
            const shared = keysA.filter(s => keysB.includes(s));
            return (
            <div className="cel-natal-info-panel">
              {keysA.length > 0 && (
                <div className="cel-natal-info-col">
                  <div className="cel-natal-info-header" style={STYLE_CHART_A}>Chart A{natalDate ? ` — ${natalDate}` : ""}</div>
                  <div className="cel-natal-grid">
                    {Object.entries(natalActivations).map(([sign, { planets }]) => (
                      <span key={sign} className={`cel-natal-item${shared.includes(sign) ? " cel-natal-shared" : ""}`}>
                        {SIGNS[sign].glyph} {sign}: {planets.map(p => BODY_GLYPHS[p] || p).join(" ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {keysB.length > 0 && (
                <div className="cel-natal-info-col">
                  <div className="cel-natal-info-header" style={STYLE_CHART_B}>Chart B{natalDateB ? ` — ${natalDateB}` : ""}</div>
                  <div className="cel-natal-grid">
                    {Object.entries(natalActivationsB).map(([sign, { planets }]) => (
                      <span key={sign} className={`cel-natal-item${shared.includes(sign) ? " cel-natal-shared" : ""}`}>
                        {SIGNS[sign].glyph} {sign}: {planets.map(p => BODY_GLYPHS[p] || p).join(" ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {shared.length > 0 && (
                <div className="cel-natal-shared-summary">
                  {shared.length} shared {shared.length === 1 ? "sign" : "signs"}: {shared.map(s => SIGNS[s].glyph).join(" ")}
                </div>
              )}
            </div>
            );
          })()}
        </div>

        <details className="cel-veil">
          <summary className="cel-oracle">
            {/* <span className="cel-oracle-line">.</span>
            <span className="cel-oracle-line">. .</span>
            <span className="cel-oracle-line">. . .</span>*/}
            <span className="cel-oracle-line">
              . . . . . . . . . . . . . . .
            </span>
            <span className="cel-oracle-line">
              . . . &nbsp; l o o k &nbsp; . . .
            </span>
            <span className="cel-oracle-line">
              . . &nbsp;w i t h i n&nbsp; . .
            </span>
            <span className="cel-oracle-line">. . . . . . . .</span>
          </summary>
          <div className="cel-controls">
            <button
              type="button"
              className={`cel-btn cel-shadow-btn${shadow ? " cel-shadow-active" : ""}`}
              onClick={toggleShadow}
            >
              <span className="cel-btn-glyph">&nbsp;{"\u25D0"}&nbsp;</span>
              <span className="cel-btn-label">eclipse</span>
            </button>
            <button
              type="button"
              className="cel-btn cel-breathe-btn"
              onClick={breathe}
            >
              <span className="cel-btn-label">
                {oscIndex === null ? "dynamic" : OSC_TYPES[oscIndex]}
              </span>
              <span className="cel-btn-glyph">{"\u3030"}</span>
            </button>
          </div>
          <div className="cel-macros">
            {groupedKnobs.map((item) =>
              item.type === "row" ? (
                <div
                  key={item.groups.map((g) => g.key).join("-")}
                  className="cel-group-row"
                >
                  {item.groups.map((g) => (
                    <div key={g.key} className="cel-group">
                      <span className="cel-group-label">{g.label}</span>
                      <div className="cel-group-knobs">
                        {g.knobs.map(([name, def]) => (
                          <Knob
                            key={name}
                            label={def.label}
                            value={params[name]}
                            defaultValue={def.default}
                            min={def.min}
                            max={def.max}
                            {...knobScaleProps[name]}
                            format={formatFns[name]}
                            onChange={paramSetters[name]}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div key={item.key} className="cel-group">
                  <span className="cel-group-label">{item.label}</span>
                  <div className="cel-group-knobs">
                    {item.knobs.map(([name, def]) => (
                      <Knob
                        key={name}
                        label={def.label}
                        value={params[name]}
                        defaultValue={def.default}
                        min={def.min}
                        max={def.max}
                        {...knobScaleProps[name]}
                        format={formatFns[name]}
                        onChange={paramSetters[name]}
                      />
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
          <div className="cel-listen">
            {Object.entries(LISTEN_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                type="button"
                className={`cel-listen-pill${listenPreset === key ? " cel-listen-active" : ""}`}
                onClick={listenHandlers[key]}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="cel-veil-actions">
            <button
              type="button"
              className="cel-btn cel-randomize-btn"
              onClick={randomizeParams}
            >
              Randomize
            </button>
            <button
              type="button"
              className="cel-btn cel-snapshot-btn"
              onClick={exportSnapshot}
            >
              Save
            </button>
            <button
              type="button"
              className="cel-btn cel-snapshot-btn"
              onClick={copySnapshot}
            >
              {copyFeedback ? "Copied!" : "Copy"}
            </button>
          </div>
        </details>

      </div>
      <div className="cel-footer">
        <p>v12 &middot; 12&times;2 &middot; 44.1kHz &middot; 39 knobs</p>
        <h1 className="cel-title">celezdial selekta</h1>
      </div>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const CSS = `
  @font-face {
    font-family: 'Spiral ST';
    src: url('/fonts/spiral-st/SpiralST.ttf') format('truetype');
    font-display: swap;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: #0c0c0c;
    overflow-x: hidden;
  }

  .cel-root {
    position: relative;
    min-height: 100vh;
    background: #0c0c0c;
    color: #d8d0e8;
    font-family: ${FONTS.body};
    display: flex;
    flex-direction: column;
    align-items: center;
    contain: layout;
    padding: 2.5rem 1rem calc(3rem + env(safe-area-inset-bottom, 0px));
    user-select: none;
    -webkit-user-select: none;
    isolation: isolate;
  }

  .cel-emanation {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
    pointer-events: none;
    contain: strict;
    will-change: transform;   /* promote to GPU layer; scroll won't repaint it */
  }

  /* ── Title + Oracle ────────────────────────────────── */

  .cel-title {
    font-family: ${FONTS.title};
    font-size: 1rem;
    font-weight: 400;
    letter-spacing: 0.15em;
    color: #504868;
    margin: 0;
  }

  .cel-oracle {
    text-align: center;
    color: #a098b8;
    font-size: 0.75rem;
    letter-spacing: 0.35em;
    line-height: 1.3;
    cursor: pointer;
    list-style: none;
    padding: 8px;
    margin-bottom: 0.5rem;
    opacity: 0.5;
    transition: opacity 0.3s ease;
  }

  .cel-oracle::-webkit-details-marker { display: none; }

  .cel-oracle:hover { opacity: 0.7; }

  .cel-veil[open] > .cel-oracle { opacity: 0.2; margin-bottom: 8px; }

  .cel-oracle-line {
    display: block;
  }

  /* ── Piano keyboard layout ──────────────────────────── */

  .cel-keyboard {
    position: relative;
    display: flex;
    gap: 2px;
    max-width: 560px;
    width: 100%;
    height: 160px;
    margin-bottom: 1.2rem;
    overflow: visible;
    contain: layout;
  }

  .cel-key {
    border: none;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    gap: 0.15rem;
    color: #d8d0e8;
    transition: background 0.15s ease, border-color 0.15s ease;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    padding-bottom: 0.6rem;
    position: relative;
    contain: layout style;
  }

  .cel-key::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow: 0 0 16px currentColor;
    opacity: var(--glow-opacity, 0);
    color: var(--glow-hue, transparent);
    pointer-events: none;
    will-change: opacity;
  }

  .cel-key:active {
    transform: scale(0.97);
  }

  .cel-key-natural {
    position: relative;
    flex: 1;
    height: 100%;
    background: #161616;
    border: 1px solid rgba(180, 140, 255, 0.12);
    border-radius: 0 0 8px 8px;
    z-index: 1;
  }

  .cel-key-natural:hover {
    background: #19162f;
    border-color: rgba(180, 140, 255, 0.3);
  }

  .cel-key-sharp {
    position: absolute;
    top: 0;
    width: 9%;
    height: 58%;
    background: #1d0f38;
    border: 1px solid rgba(180, 140, 255, 0.25);
    border-radius: 0 0 6px 6px;
    z-index: 2;
    padding-bottom: 0.4rem;
  }

  .cel-key-sharp:hover {
    background: #301a4e;
    border-color: rgba(180, 140, 255, 0.45);
  }

  .cel-key-active.cel-key-natural {
    background: #221a3a;
    border-color: rgba(180, 140, 255, 0.55);
  }

  .cel-key-active.cel-key-natural:hover {
    background: #2c2046;
    border-color: rgba(180, 140, 255, 0.65);
  }

  .cel-key-active.cel-key-sharp {
    background: #4e288a;
    border-color: rgba(200, 160, 255, 0.6);
  }

  .cel-key-active.cel-key-sharp:hover {
    background: #6032a0;
    border-color: rgba(200, 160, 255, 0.7);
  }

  .cel-key-glyph {
    font-size: 1.3rem;
    color: #c4a0ff;
  }

  .cel-key-sharp .cel-key-glyph {
    font-size: 1rem;
  }

  .cel-key-active .cel-key-glyph {
    color: #e0c8ff;
    text-shadow: 0 0 10px rgba(200, 160, 255, 0.6);
  }

  .cel-key-glyph-sm {
    font-size: 0.9rem;
  }

  .cel-key-name {
    font-weight: 600;
    font-size: 0.7rem;
    letter-spacing: 0.02em;
  }

  .cel-key-sharp .cel-key-name {
    font-size: 0.55rem;
  }

  .cel-key-note {
    font-size: 0.6rem;
    color: #8070a0;
  }

  .cel-key-active .cel-key-note {
    color: #b8a0d8;
  }

  .cel-key-uncertain {
    opacity: 0.4;
  }

  /* ── Eclipse mode ─────────────────────────────────────── */

  .cel-eclipse-active .cel-key::before {
    box-shadow: 0 0 20px currentColor, 0 0 40px currentColor;
  }

  /* ── Controls row (Shadow + Breathe) ────────────────── */

  .cel-controls {
    display: flex;
    gap: 0.8rem;
    justify-content: center;
    margin-bottom: 1rem;
    contain: layout;
  }

  /* ── Base button ─────────────────────────────────────── */

  .cel-btn {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(180, 140, 255, 0.15);
    border-radius: 10px;
    color: #d8d0e8;
    padding: 0.6rem 1.2rem;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .cel-btn:hover:not(:disabled) {
    background: rgba(180, 140, 255, 0.1);
    border-color: rgba(180, 140, 255, 0.35);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(140, 100, 220, 0.12);
  }

  .cel-btn:active:not(:disabled) {
    transform: translateY(0);
    background: rgba(180, 140, 255, 0.18);
  }

  .cel-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .cel-btn-glyph {
    font-size: 1.1rem;
    color: #c4a0ff;
  }

  .cel-btn-label {
    font-weight: 600;
    font-size: 0.85rem;
    letter-spacing: 0.03em;
  }

  /* ── Shadow button ───────────────────────────────────── */

  .cel-shadow-btn {
    border-color: rgba(255, 120, 60, 0.2);
    flex-direction: row;
    gap: 0.4rem;
    padding: 0.6rem 1.4rem;
  }

  .cel-shadow-btn:hover:not(:disabled) {
    background: rgba(255, 120, 60, 0.08);
    border-color: rgba(255, 120, 60, 0.35);
    box-shadow: none;
  }

  .cel-shadow-btn .cel-btn-glyph {
    color: #ff9060;
  }

  .cel-shadow-active {
    position: relative;
    background: rgba(255, 80, 30, 0.16);
    border-color: rgba(255, 120, 60, 0.6);
    box-shadow: 0 0 16px rgba(255, 80, 30, 0.3), inset 0 0 12px rgba(255, 120, 60, 0.08);
  }

  .cel-shadow-active::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow: 0 0 28px rgba(255, 80, 30, 0.5), inset 0 0 16px rgba(255, 120, 60, 0.12);
    opacity: 0;
    animation: cel-shadow-pulse 2s ease-in-out infinite;
    pointer-events: none;
  }

  .cel-shadow-active:hover:not(:disabled) {
    background: rgba(255, 80, 30, 0.24);
    border-color: rgba(255, 120, 60, 0.7);
  }

  .cel-shadow-active .cel-btn-glyph {
    color: #ffb080;
    text-shadow: 0 0 12px rgba(255, 100, 40, 0.7);
  }

  @keyframes cel-shadow-pulse {
    0%, 100% { opacity: 0; }
    50% { opacity: 1; }
  }

  /* ── Breathe button ─────────────────────────────────── */

  .cel-breathe-btn {
    border-color: rgba(255, 180, 140, 0.15);
    padding: 0.6rem 2rem;
    flex-direction: row;
    gap: 0.4rem;
    justify-content: center;
  }

  .cel-breathe-btn:hover:not(:disabled) {
    background: rgba(255, 180, 140, 0.1);
    border-color: rgba(255, 180, 140, 0.35);
    box-shadow: none;
  }

  .cel-osc-indicator {
    display: block;
    text-align: center;
    font-size: 0.6rem;
    font-family: ${FONTS.mono};
    color: rgba(180, 140, 255, 0.35);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 0.5rem;
  }

  /* ── Listen preset pills ─────────────────────────────── */

  .cel-listen {
    display: flex;
    gap: 0.4rem;
    justify-content: center;
    margin-bottom: 1.5rem;
    contain: layout;
  }

  .cel-listen-pill {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(180, 140, 255, 0.12);
    border-radius: 20px;
    color: #8878a0;
    padding: 0.3rem 0.8rem;
    font-size: 0.7rem;
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .cel-listen-pill:hover {
    background: rgba(180, 140, 255, 0.08);
    color: #d8d0e8;
  }

  .cel-listen-active {
    background: rgba(180, 140, 255, 0.14);
    border-color: rgba(180, 140, 255, 0.5);
    color: #e0c8ff;
  }

  .cel-veil-actions {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    margin: 0.8rem auto 0;
  }

  .cel-randomize-btn,
  .cel-snapshot-btn {
    font-size: 0.75rem;
    padding: 0.4rem 1.2rem;
    opacity: 0.6;
  }

  /* ── Macro Knobs ───────────────────────────────────── */

  .cel-macros {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    max-width: 600px;
    width: 100%;
    margin-bottom: 1.5rem;
    contain: layout;
  }

  .cel-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 6px 8px 4px;
    border: 1px solid rgba(180, 140, 255, 0.08);
    border-radius: 8px;
    background: rgba(180, 140, 255, 0.02);
    contain: layout style;
  }

  .cel-group-label {
    font-size: 0.55rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: rgba(180, 140, 255, 0.35);
    text-transform: uppercase;
    margin-bottom: 1px;
  }

  .cel-group-knobs {
    display: flex;
    gap: 2px;
  }

  .cel-group-row {
    display: flex;
    gap: 4px;
    justify-content: center;
  }

  .cel-knob {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
    flex: 1;
    max-width: 80px;
    contain: layout style;
  }

  .cel-knob-label {
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: #8878a0;
    text-transform: uppercase;
  }

  .cel-knob-svg {
    cursor: ns-resize;
    touch-action: none;
  }

  .cel-knob-value-arc {
    fill: none;
    stroke: var(--knob-accent, #9070cc);
    stroke-width: 3;
    stroke-linecap: round;
    transition: stroke 0.25s ease-out;
  }

  .cel-knob-pointer {
    fill: var(--knob-accent, #b490e8);
    transition: fill 0.25s ease-out;
  }

  .cel-knob-value {
    font-size: 0.6rem;
    color: #504868;
    font-family: ${FONTS.mono};
  }

  /* ── Natal chart section ─────────────────────────────── */

  .cel-natal {
    max-width: 400px;
    width: 100%;
    margin-bottom: 1.5rem;
  }

  .cel-natal-body {
    padding: 0.8rem 0;
  }

  .cel-natal-inputs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    margin-bottom: 0.8rem;
  }

  .cel-natal-input {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(180, 140, 255, 0.15);
    border-radius: 8px;
    color: #d8d0e8;
    padding: 1.1rem 0.5rem 0.35rem;
    font-size: 0.8rem;
    font-family: inherit;
    width: 100%;
  }

  .cel-natal-field {
    position: relative;
    display: block;
  }
  .cel-natal-field span {
    position: absolute;
    left: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.75rem;
    color: #605878;
    letter-spacing: 0.03em;
    pointer-events: none;
    transition: top 0.15s ease, font-size 0.15s ease, color 0.15s ease, transform 0.15s ease;
  }
  .cel-natal-field:focus-within span,
  .cel-natal-field.has-value span,
  .cel-natal-field.cel-pinned span {
    top: 0.25rem;
    transform: none;
    font-size: 0.5rem;
    color: #807098;
  }
  .cel-natal-input[type="number"]::-webkit-inner-spin-button,
  .cel-natal-input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  .cel-natal-input[type="number"] { -moz-appearance: textfield; }

  .cel-natal-play {
    width: 100%;
    border-color: rgba(180, 140, 255, 0.25);
  }

  /* ── Info / footer ───────────────────────────────────── */

  .cel-info {
    text-align: center;
    max-width: 420px;
    font-size: 0.85rem;
    line-height: 1.6;
    color: #706888;
  }

  .cel-info p {
    margin-bottom: 0.4rem;
  }

  .cel-chain {
    margin-top: 0.8rem;
    font-size: 0.75rem;
    color: #504868;
    font-family: ${FONTS.mono};
    line-height: 1.8;
  }

  .cel-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.3rem 1rem calc(0.3rem + env(safe-area-inset-bottom, 0px));
    background: rgba(12, 12, 12, 0.85);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-top: 1px solid rgba(180, 140, 255, 0.06);
    font-size: 0.6rem;
    color: #3a3050;
    z-index: 10;
  }
  .cel-footer p { margin: 0; }

  .cel-natal-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 0;
  }
  .cel-natal-item {
    font-size: 11px;
    opacity: 0.7;
  }
  .cel-natal-shared {
    opacity: 1;
    font-weight: 600;
  }
  .cel-natal-shared-summary {
    width: 100%;
    font-size: 10px;
    opacity: 0.6;
    text-align: center;
    padding-top: 0.3rem;
    border-top: 1px solid rgba(255,255,255,0.08);
  }

  /* ── Chart indicator dots on keys ─────────────────────── */

  .cel-chart-dot {
    position: absolute;
    top: 4px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .cel-chart-dot-a {
    left: 4px;
    background: ${CHART_A_COLOR};
    box-shadow: 0 0 4px ${CHART_A_COLOR};
  }

  .cel-chart-dot-b {
    right: 4px;
    background: ${CHART_B_COLOR};
    box-shadow: 0 0 4px ${CHART_B_COLOR};
  }

  .cel-key-sharp .cel-chart-dot {
    width: 5px;
    height: 5px;
    top: 3px;
  }
  .cel-key-sharp .cel-chart-dot-a { left: 3px; }
  .cel-key-sharp .cel-chart-dot-b { right: 3px; }

  /* ── Body glyphs on natural keys ────────────────────── */

  .cel-key-bodies {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1px;
    font-size: 0.55rem;
    line-height: 1;
    max-width: 100%;
    overflow: hidden;
  }

  .cel-body-glyph {
    font-size: 0.55rem;
  }

  .cel-body-a { color: ${CHART_A_COLOR}; }
  .cel-body-b { color: ${CHART_B_COLOR}; }

  /* ── A/B active key glow colors ─────────────────────── */

  .cel-key-active-a.cel-key-natural {
    background: #221a3a;
    border-color: rgba(212, 160, 60, 0.45);
  }

  .cel-key-active-b.cel-key-natural {
    background: #1a2a3a;
    border-color: rgba(60, 168, 212, 0.45);
  }

  .cel-key-active-a.cel-key-active-b.cel-key-natural {
    border-image: linear-gradient(135deg, ${CHART_A_COLOR}, ${CHART_B_COLOR}) 1;
  }

  .cel-key-active-a.cel-key-sharp {
    background: #3a2a10;
    border-color: rgba(212, 160, 60, 0.5);
  }

  .cel-key-active-b.cel-key-sharp {
    background: #102a3a;
    border-color: rgba(60, 168, 212, 0.5);
  }

  /* ── A/B mode toggle ────────────────────────────────── */

  .cel-ab-toggle {
    display: flex;
    gap: 0;
    justify-content: center;
    margin-bottom: 0.8rem;
  }

  .cel-ab-pill {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(180, 140, 255, 0.12);
    color: #8878a0;
    padding: 0.35rem 1rem;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .cel-ab-pill:first-child { border-radius: 20px 0 0 20px; }
  .cel-ab-pill:last-child { border-radius: 0 20px 20px 0; }

  .cel-ab-active-a {
    background: rgba(212, 160, 60, 0.15);
    border-color: ${CHART_A_COLOR};
    color: ${CHART_A_COLOR};
  }

  .cel-ab-active-b {
    background: rgba(60, 168, 212, 0.15);
    border-color: ${CHART_B_COLOR};
    color: ${CHART_B_COLOR};
  }

  /* ── Dual natal chart layout ────────────────────────── */

  .cel-natal-dual {
    max-width: 560px;
  }

  .cel-natal-dual .cel-natal-body {
    padding: 0.5rem 0;
  }

  .cel-natal-chart-label {
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 0.3rem;
    opacity: 0.8;
  }

  /* ── Info panel ─────────────────────────────────────── */

  .cel-natal-info-panel {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    padding: 0.5rem 0;
  }

  .cel-natal-info-col {
    flex: 1;
  }

  .cel-natal-info-header {
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 0.3rem;
    opacity: 0.8;
  }

  @media (max-width: 600px) {
    .cel-root { padding: 8px 8px calc(3rem + env(safe-area-inset-bottom, 0px)); }
    .cel-keyboard { gap: 2px; }
    .cel-key-natural { min-width: 36px; padding: 8px 2px; }
    .cel-key-sharp { width: 28px; }
    .cel-key-name { font-size: 8px; }
    .cel-key-glyph { font-size: 14px; }
    .cel-listen { flex-wrap: wrap; }
    .cel-group-row { flex-direction: column; }
    .cel-natal-info-panel { flex-direction: column; gap: 0.5rem; }
    .cel-key-bodies { font-size: 0.45rem; }
    .cel-body-glyph { font-size: 0.45rem; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;
