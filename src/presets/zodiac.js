// ═══════════════════════════════════════════════════════════════
// ZODIAC — The "ultimate" chain preset.
//
// Fuses the best interactions from tape, furnace, and cathedral:
//   vibrato → ECHO → eq3 → chebyshev → [dist] → reverb → chorus → [phaser] → monEQ → clip
//
// Why this order matters:
//   1. Vibrato first — pitch drift creates time-varying input to
//      everything downstream. Chebyshev generates DIFFERENT harmonics
//      each moment because the frequencies are moving. Alive, not static.
//   2. Echo before saturation — each delay repeat re-enters the
//      waveshaper. 3 repeats = 3 rounds of intermodulation = exponential
//      overtone growth. The echo is a harmonic generation mechanism.
//   3. EQ before saturation — Tone macro controls WHICH FREQUENCIES
//      get saturated. Boost lows = sub-harmonic intermod (massive).
//      Boost highs = bright overtone cascade. This makes Tone a
//      harmonic color selector, not just a filter.
//   4. Clean reverb after saturation — Freeverb comb resonances
//      interact with the dense harmonic series. Shimmer without mud.
//   5. Post-reverb modulation — chorus widens, phaser adds moving
//      spectral notches in the final wash.
//
// Designed for: Lionel Williams' musical astrology demo.
// Beautiful on load. Cosmic at the extremes. Every macro hits hard.
// ═══════════════════════════════════════════════════════════════

export const TUNING = {
  sampleRate: 16000,

  // ── Envelope ──
  // Medium-slow pad. Not glacial like Deep Space, not punchy like Furnace.
  // The sweet spot for zodiac: notes bloom with presence.
  attack: 2.0,
  decay: 3.5,
  sustain: 0.25,
  release: 6.0,

  // ── Chebyshev ──
  // Order 5: rich but musical. Generates 5th harmonic and below.
  // Full wet — all signal passes through the waveshaper.
  // With echo before saturation, this processes accumulated repeats.
  chebyOrder: 5,
  chebyWet: 1.0,

  // ── EQ (BEFORE saturation — harmonic color selector) ──
  // Slight warmth bias: gentle high rolloff pushes more energy into
  // the harmonics-generating low/mid range. Mid presence ensures
  // the fundamental stays strong through the waveshaper.
  eqHigh: -4,
  eqMid: 4,
  eqLow: 4,
  eqHighFreq: 3200,

  // ── Vibrato (FIRST in chain — controls aliveness) ──
  // Slow and noticeable. Every downstream effect inherits the drift.
  // 0.15Hz = ~7 second cycle. Majestic, not frantic.
  vibratoFreq: 0.15,
  vibratoDepth: 0.3,
  vibratoWet: 0.85,

  // ── Echo (BEFORE saturation — harmonic accumulation) ──
  // Each repeat feeds back through EQ → Chebyshev, generating new
  // intermodulation products. Moderate feedback keeps it musical.
  // Darker filter because the saturation adds brightness.
  delayTime: 0.55,
  delayFeedback: 0.62,
  delayWet: 0.4,

  // ── Reverb (AFTER saturation — clean shimmer) ──
  // Large room, moderate darkness. Processes the harmonically dense
  // signal — comb filter resonances interact with the overtone series.
  reverbRoom: 0.92,
  reverbDamp: 1200,
  reverbWet: 0.35,

  // ── Damp sweep ──
  // Subtle evolving resonances. The comb filter morphing is
  // especially effective after saturation — shifting which
  // harmonics resonate.
  dampSweepRate: 0.06,
  dampSweepDepth: 0.1,

  // ── Pan LFOs ──
  panLfoFreq: 0.05,
  panLfoAmplitude: 0.15,

  // ── Monitor EQ ──
  monitorLowFreq: 400,
  monitorHighFreq: 2500,

  // ── Timing ──
  stagger: 0.4,
  retriggerGap: 80,

  // ── Phaser (dormant, activated by Grit above 0.5) ──
  phaserFreq: 0.3,
  phaserOctaves: 3,
  phaserBase: 350,
  phaserQ: 10,
  phaserWet: 0.0,

  // ── Echo filter ──
  // Darker than default — accumulated repeats through saturation
  // add brightness, so the filter compensates.
  echoFilterFreq: 3500,

  // ── Distortion (dormant, activated by Grit above 0.5) ──
  distortion: 0.35,
  distortionWet: 0.0,

  // ── Echo feedback safety ──
  // Loop gain = echoSatDrive × delayFeedback = 0.9 × 0.62 = 0.558. Safe.
  // Slightly under 1.0 drive gives extra headroom for the pre-saturation
  // echo accumulation.
  echoSatDrive: 0.9,
  echoInputGain: 0.8,

  // ── Aspect sonification ──
  aspectConsonantBoost: 0.03, // velocity bump per consonant aspect
  aspectFocalBoost: 0.04,     // velocity bump per conjunction
  aspectBoostCap: 0.1,       // max total velocity lift per sign
  aspectTensionCents: 4,      // detune offset for tense-aspect pairs

  // ── Orbit mode ──
  orbitPeriodMin: 16, // seconds — fastest voice cycle (Moon)
  orbitPeriodMax: 88, // seconds — slowest voice cycle (Saturn)
  orbitDuty: 0.45,    // fraction of the cycle a voice holds before release
};

// ─── Eclipse / Shadow ────────────────────────────────────────
// Exploits the zodiac chain maximally:
// - High feedback through saturation = cascading harmonic generations
// - Deep vibrato = rapidly shifting intermod products
// - High reverb = infinite shimmer of the dense harmonics
// - Wide panning = immersive chaos
export const SHADOW = {
  reverbWet: 0.6,
  delayFeedback: 0.88,       // × echoSatDrive(0.9) = 0.792. Safe.
  delayWet: 0.85,
  vibratoDepth: 0.7,
  vibratoFreq: 0.04,          // 25-second pitch cycle. Tidal.
  chebyWet: 1.0,
  panLfoFreq: 0.15,
  panLfoAmplitude: 0.5,
  oscSpread: 110,
  detuneRange: 12,
  rampTime: 14,                // slow descent into chaos
};

// ─── Macros ──────────────────────────────────────────────────
// Optimized for the zodiac chain's unique interactions.
// Every macro hits harder because of WHERE its effect sits.

export const MACROS = {
  // ── Bloom — "Stellar Ignition" ──
  // Short attacks through this chain create distinct transient harmonics
  // (the initial waveshaping burst). Long attacks let harmonics accumulate
  // gradually. Wide range for maximum exploration.
  bloom: {
    label: "Bloom",
    default: 0.5,
    params: {
      attack:  ["splitLog", 0.02, 2.0, 10.0],     // 20ms spark → 2s bloom → 10s glacial
      decay:   ["splitLog", 0.2, 3.5, 10.0],       // 200ms → 3.5s → 10s
      sustain: ["splitLinear", 0.0, 0.25, 0.7],    // silence → quarter → sustained
      release: ["splitLog", 0.2, 6.0, 14.0],       // 200ms → 6s → 14s infinite wash
    },
  },

  // ── Aether — "Celestial Hall" ──
  // Reverb processes harmonically dense signal. Higher wet = more
  // comb-filter interaction with the overtone series. Damp sweep
  // is especially effective here — shifts which harmonics resonate.
  aether: {
    label: "Aether",
    default: 0.5,
    params: {
      reverbRoom:     ["splitLinear", 0.4, 0.92, 1.0],
      reverbDamp:     ["splitLog", 5000, 1200, 400],     // bright → warm → very dark
      reverbMix:      ["splitLinear", 0.08, 0.35, 0.65], // higher max — thick post-saturation wash
      dampSweepRate:  ["splitLog", 0.01, 0.06, 1.2],     // faster max — dramatic resonance morphing
      dampSweepDepth: ["splitLinear", 0.0, 0.1, 0.85],   // more range — comb shimmer after saturation
      panDrift:       ["splitLog", 0.01, 0.05, 0.6],
      panWidth:       ["splitLinear", 0.0, 0.15, 0.9],   // wide max for immersive stereo
      aetherShimmer:  ["dormantLinear", 0.0, 0.5],       // chorus on harmonically dense signal = thick
    },
  },

  // ── Echo — "Harmonic Cascade" ──
  // THE unique control in the zodiac chain. Each echo repeat re-enters
  // the waveshaper. More feedback = more rounds of intermodulation =
  // exponentially richer harmonics. This isn't just an echo — it's
  // a harmonic generation engine.
  echo: {
    label: "Echo",
    default: 0.5,
    params: {
      echoTime:       ["splitLog", 0.08, 0.55, 1.8],    // wider range — short taps to long cascades
      echoFeedback:   (m) =>                              // more aggressive — this IS the sound
        m <= 0.5
          ? (m / 0.5) * 0.62
          : 0.62 + 0.23 * Math.pow((m - 0.5) / 0.5, 1.3), // max ~0.85 × 0.9 drive = 0.765 safe
      echoMix:        (m) => m,
      echoFilterFreq: ["splitLog", 6000, 3500, 1200],    // goes darker — saturation adds brightness
    },
  },

  // ── Drift — "Orbital Motion" ──
  // Vibrato is FIRST in chain. Every downstream effect — echo,
  // saturation, reverb — processes pitch-shifted signal. More drift
  // = more harmonic variation over time. Keeps speeds moderate —
  // too fast and the intermodulation becomes noise.
  drift: {
    label: "Drift",
    default: 0.5,
    params: {
      wobbleRate:  ["splitLog", 0.02, 0.15, 1.2],       // slower center than default — majestic
      wobbleDepth: ["splitLinear", 0.0, 0.3, 0.8],      // deeper max — feeds saturation more variation
      wobbleMix:   ["splitLinear", 0.0, 0.85, 1.0],     // higher center — always some drift
    },
  },

  // ── Grit — "Harmonic Temperature" ──
  // Controls the saturation engine. At low values, gentle Chebyshev
  // on the drifting echoed signal. At high values, stacked distortion
  // + phaser creating spectral interference AFTER the reverb wash.
  grit: {
    label: "Grit",
    default: 0.5,
    params: {
      gritDrive:    (m) => (m <= 0.5 ? m / 0.5 : 1.0),
      chebyOrder:   (m) =>
        m < 0.15 ? 1
          : m < 0.35 ? 3
            : m < 0.55 ? 5
              : m < 0.7 ? 7
                : m < 0.85 ? 9
                  : 11,
      satDrive:     ["splitLinear", 0.0, 0.35, 1.0],
      satMix:       ["dormantLinear", 0.0, 1.0],
      phaserFreq:   (m) =>
        m <= 0.5 ? 0.3 : 0.3 * Math.pow(6.0 / 0.3, (m - 0.5) / 0.5),
      phaserOctaves:(m) =>
        m <= 0.5 ? 3 : Math.round(3 + 3 * ((m - 0.5) / 0.5)),
      phaserBase:   (m) =>
        m <= 0.5 ? 350 : 350 * Math.pow(120 / 350, (m - 0.5) / 0.5),
      phaserQ:      () => 10,
      phaserMix:    ["dormantLinear", 0.0, 1.0],
    },
  },

  // ── Tone — "Harmonic Color" ──
  // EQ is BEFORE the waveshaper. This doesn't just filter — it
  // controls which frequencies enter the Chebyshev polynomial.
  // Boosting lows = sub-harmonic intermodulation (MASSIVE bottom end).
  // Boosting highs = bright overtone cascade (crystalline aggression).
  // Wider range than any other preset because the effect is amplified
  // by the saturation.
  tone: {
    label: "Tone",
    default: 0.5,
    params: {
      eqHigh: ["splitLinear", 15, -4, -20],    // +15dB crystalline → -4 warm → -20dB subterranean
      eqMid:  ["splitLinear", -15, 4, 15],     // scooped → present → FORWARD (massive through saturation)
      eqLow:  ["splitLinear", -15, 4, 15],     // thin → full → sub-harmonic intermod territory
    },
  },
};

// ─── Listen Presets ──────────────────────────────────────────
export const LISTEN_PRESETS = {
  headphones:  { low: -2, mid: 0,  high: 1,  label: "HP" },
  laptop:      { low: 6,  mid: 2,  high: 3,  label: "Laptop" },
  phone:       { low: 4,  mid: 3,  high: 2,  label: "Phone" },
  loudspeaker: { low: 3,  mid: -2, high: 0,  label: "Speaker" },
};

// ─── Chains ──────────────────────────────────────────────────
export const CHAINS = {
  zodiac: {
    order: [
      "vibrato", "ECHO", "eq3", "chebyshev",
      "reverb", "chorus", "monitorEQ", "softClip",
    ],
    bypass: {
      distortion: { after: "chebyshev", before: "reverb" },
      phaser: { after: "chorus", before: "monitorEQ" },
    },
  },
  cathedral: {
    order: [
      "chebyshev", "eq3", "vibrato", "ECHO",
      "reverb", "chorus", "monitorEQ", "softClip",
    ],
    bypass: {
      distortion: { after: "chebyshev", before: "eq3" },
      phaser: { after: "chorus", before: "monitorEQ" },
    },
  },
  void: {
    order: [
      "chebyshev", "distortion", "eq3", "vibrato",
      "reverb", "phaser", "ECHO",
      "chorus", "monitorEQ", "softClip",
    ],
    bypass: {},
  },
  furnace: {
    order: [
      "ECHO", "chebyshev", "distortion", "eq3",
      "vibrato", "reverb", "chorus", "phaser",
      "monitorEQ", "softClip",
    ],
    bypass: {},
  },
  tape: {
    order: [
      "vibrato", "chebyshev", "distortion", "eq3",
      "ECHO", "reverb", "chorus", "phaser",
      "monitorEQ", "softClip",
    ],
    bypass: {},
  },
  evolve: {
    order: [
      "vibrato", "ECHO", "reverb", "phaser",
      "chebyshev", "distortion", "eq3",
      "chorus", "monitorEQ", "softClip",
    ],
    bypass: {},
  },
  glass: {
    order: [
      "eq3", "vibrato", "ECHO",
      "reverb", "chorus", "phaser",
      "monitorEQ", "softClip",
    ],
    bypass: {},
  },
};

export const ACTIVE_CHAIN = "zodiac";
