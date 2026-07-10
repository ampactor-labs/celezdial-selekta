// ═══════════════════════════════════════════════════════════════
// HARMONIC FURNACE — "Looking Into Fire"
//
// Overtone cascade. Aggressive, evolving, alive. The sound of
// harmonics multiplying and colliding. Dense, warm, complex —
// the overtone series made audible and visceral.
//
// KEY INSIGHT: furnace chain = delay → Chebyshev → distortion.
// Clean echoes re-enter the waveshaper on every repeat, generating
// new sum/difference tones. Each echo is harmonically denser than
// the last. The delay IS the harmonic engine.
//
// Punchy envelopes give notes impact — hammer on hot metal.
// Moderate reverb provides breathing room without drowning the
// harmonic detail. Vibrato shifts intermodulation products
// moment-to-moment, preventing static spectral patterns.
//
// Drop-in replacement for tuning.js.
// ═══════════════════════════════════════════════════════════════

// ─── FX Parameter Defaults ───────────────────────────────────
// At m=0.5 for all macros. The furnace is warm and active by default.
export const TUNING = {
  sampleRate: 16000,

  // ── Envelope (Bloom) ──
  // Punchier than cathedral — notes have attack, not just bloom.
  // Short-medium attack lets transients through the saturation chain
  // for crisp harmonic bursts. Medium decay for rhythmic presence.
  attack: 0.5,       // seconds — fast enough for transient harmonics
  decay: 2.5,        // seconds — medium tail, not glacial
  sustain: 0.3,      // 0–1 — moderate sustain, notes have shape
  release: 1.8,      // seconds — trails off through the furnace chain

  // ── Chebyshev saturation (Grit) ──
  // High order at default — the furnace runs hot. Full wet because
  // the waveshaper IS the core sound. Order 8 = rich harmonic series
  // without the ice-pick harshness of 11.
  chebyOrder: 8,     // harmonic order — deep into the overtone series
  chebyWet: 1.0,     // full saturation — the furnace is always on

  // ── Tape EQ (Tone) ──
  // Balanced default — "iron" character. Not bright, not dark.
  // The Chebyshev generates harmonics across the spectrum;
  // EQ sculpts which ones dominate.
  eqHigh: -8,        // dB — moderate high rolloff, tames harsh harmonics
  eqMid: 5,          // dB — mid-forward, presence for the overtones
  eqLow: 4,          // dB — warm low end, body for the saturation
  eqHighFreq: 2800,  // Hz — slightly lower crossover, warmer character

  // ── Vibrato (Drift) ──
  // Moderate — not the star, but critical. Pitch drift causes the
  // intermodulation products to shift constantly. Without it the
  // harmonics are static and lifeless.
  vibratoFreq: 0.35, // Hz — moderate speed, heat shimmer
  vibratoDepth: 0.22, // 0–1 — enough to destabilize harmonics
  vibratoWet: 0.5,   // 0–1 — half wet, pitch stays grounded

  // ── Echo / delay cascade (Echo) ──
  // Medium delay for rhythmic repeats. Moderate-high feedback because
  // each repeat re-enters the Chebyshev (furnace chain order).
  // The feedback loop IS the harmonic accumulator.
  delayTime: 0.4,    // seconds — rhythmic, not ambient
  delayFeedback: 0.6, // 0–1 — several repeats, each dirtier
  delayWet: 0.35,    // 0–1 — blended, not drowning

  // ── Reverb (Aether) ──
  // Breathing room, not cathedral. The harmonics need space to
  // interact but not so much wash that detail is lost.
  reverbRoom: 0.75,  // 0–1 — medium-large room
  reverbDamp: 2200,  // Hz — moderate dampening, keeps some sparkle
  reverbWet: 0.3,    // 0–1 — room presence, not the main event

  // ── Damp sweep (Aether) ──
  // Moderate sweep — reverb resonances shift, adding metallic shimmer
  // that interacts with the Chebyshev harmonics.
  dampSweepRate: 0.1,    // Hz — slow enough to feel organic
  dampSweepDepth: 0.25,  // 0–1 — noticeable metallic shift

  // ── Per-voice panning LFOs (Aether) ──
  panLfoFreq: 0.07,      // Hz — slow drift
  panLfoAmplitude: 0.15,  // 0–1 — moderate stereo width

  // ── Monitor EQ crossover frequencies ──
  monitorLowFreq: 400,
  monitorHighFreq: 2500,

  // ── Stagger / retrigger ──
  // Tighter stagger than cathedral — notes arrive closer together
  // for chord intermodulation through the furnace chain.
  stagger: 0.3,       // seconds — tighter chord spread
  retriggerGap: 80,   // ms

  // ── Phaser (Grit, dormant below 0.5) ──
  // At high grit, phaser adds sweeping comb interference on top
  // of the already-dense harmonics. White-hot territory.
  phaserFreq: 0.4,    // Hz — moderate sweep
  phaserOctaves: 5,    // wide sweep range
  phaserBase: 380,     // Hz
  phaserQ: 8,          // resonant
  phaserWet: 0.15,     // 0–1 — starts subtle when it kicks in

  // ── Echo feedback loop filter ──
  // Higher than cathedral — lets more harmonic content through
  // the feedback loop so it re-enters the waveshaper with spectral
  // richness intact. Darker = fewer harmonics to reprocess.
  echoFilterFreq: 3200, // Hz — keeps the upper harmonics alive

  // ── Distortion (Grit) ──
  // ALWAYS PARTLY ACTIVE. This is key to furnace character.
  // Stacks with Chebyshev for double saturation.
  distortion: 0.5,     // 0–1 — moderate drive
  distortionWet: 0.25, // 0–1 — always some grit in the chain

  // ── Echo feedback safety ──
  // echoSatDrive * delayFeedback = 0.85 * 0.6 = 0.51 — safe.
  echoSatDrive: 0.85,  // tanh drive — aggressive but controlled
  echoInputGain: 0.65, // pre-delay attenuator — tames hot input into delay→cheby path

  // ── Aspect sonification ──
  aspectConsonantBoost: 0.03, // velocity bump per consonant aspect
  aspectFocalBoost: 0.05,     // velocity bump per conjunction
  aspectBoostCap: 0.12,       // max total velocity lift per sign
  aspectTensionCents: 7,      // detune offset for tense-aspect pairs

  // ── Orbit mode ──
  orbitPeriodMin: 14, // seconds — fastest voice cycle (Moon)
  orbitPeriodMax: 70, // seconds — slowest voice cycle (Saturn)
  orbitDuty: 0.5,    // fraction of the cycle a voice holds before release
};

// ─── Shadow / Eclipse Mode: "Meltdown" ──────────────────────
// Everything overdrives. Chebyshev + distortion maxed, feedback high,
// intermodulation becomes a wall of shifting overtones. Ring-mod-like
// artifacts from extreme harmonic interaction. Not noise — structured
// chaos. Like watching molten metal flow.
//
// Safety: echoSatDrive * delayFeedback = 0.85 * 0.82 = 0.697 — safe.
export const SHADOW = {
  reverbWet: 0.7,          // wetter reverb, harmonics ring longer
  delayFeedback: 0.82,     // near-infinite saturating echoes
  delayWet: 0.75,          // mostly echo — cascading harmonic rounds
  vibratoDepth: 0.6,       // heavy pitch drift — intermod products scatter
  vibratoFreq: 0.08,       // slow wobble — long intermod cycles
  chebyWet: 1.0,           // already maxed, stays there
  panLfoFreq: 0.2,         // faster stereo drift
  panLfoAmplitude: 0.5,    // wide movement
  oscSpread: 100,           // oscillator detuning — more source frequencies to intermodulate
  detuneRange: 12,          // random detune variance (cents)
  rampTime: 12,            // seconds to reach meltdown — faster than cathedral
};

// ─── Macro Definitions ───────────────────────────────────────
// 6 knobs shaped for the furnace character. Every curve is designed
// around harmonic density and the delay→saturation feedback loop.

export const MACROS = {
  // ── Bloom — "Ignition" ──
  // At 0: sharp percussive attack through the saturation chain.
  //   Transient harmonics — hammer striking hot metal.
  // At 1: long slow build where harmonics accumulate gradually.
  //   Molten metal cooling — the furnace chain turns notes into drones.
  // The envelope interacts with furnace: short = rhythmic harmonic
  // bursts, long = evolving textural buildup.
  bloom: {
    label: "Bloom",
    default: 0.5,
    params: {
      attack:  ["splitLog", 0.02, 0.5, 5.0],    // 20ms snap → 500ms → 5s glacial
      decay:   ["splitLog", 0.3, 2.5, 6.0],      // 300ms punch → 2.5s → 6s sustain
      sustain: ["splitLinear", 0.05, 0.3, 0.65],  // near-silent → moderate → held
      release: ["splitLog", 0.15, 1.8, 7.0],      // quick cut → 1.8s → 7s wash
    },
  },

  // ── Aether — "Forge Chamber" ──
  // At 0: close, dry — direct sound of the furnace. Harmonics are
  //   immediate and in-your-face.
  // At 1: massive reverberant space where harmonics ring and interact.
  //   Damp sweep active at high values — reverb resonances shift,
  //   creating metallic shimmer. Chorus adds detuned copies that
  //   feed MORE intermodulation through the chain.
  aether: {
    label: "Aether",
    default: 0.5,
    params: {
      reverbRoom:     ["splitLinear", 0.35, 0.75, 0.95],  // tight → medium → large
      reverbDamp:     ["splitLog", 5000, 2200, 900],       // bright → warm → dark
      reverbMix:      ["splitLinear", 0.08, 0.3, 0.65],    // dry → present → wet
      dampSweepRate:  ["splitLog", 0.02, 0.1, 0.6],        // near-static → moderate → fast
      dampSweepDepth: ["splitLinear", 0.0, 0.25, 0.9],     // off → metallic → full sweep
      panDrift:       ["splitLog", 0.02, 0.07, 0.35],      // still → slow → active
      panWidth:       ["splitLinear", 0.0, 0.15, 0.7],     // mono → moderate → wide
      aetherShimmer:  ["dormantLinear", 0.0, 0.5],          // off until 0.5, then chorus
    },
  },

  // ── Echo — "Heat Cycles" ──
  // At 0: no delay — raw furnace sound.
  // At 1: long feedback delay creating cascading saturation rounds.
  //   Each cycle through the delay → Chebyshev path generates new
  //   partials. This is DRAMATIC — the echo IS the furnace mechanism.
  //
  // Feedback is more aggressive than other presets — the re-saturation
  // is the point. Curve reaches 0.82 at max (safe with echoSatDrive=0.85).
  echo: {
    label: "Echo",
    default: 0.5,
    params: {
      echoTime: ["splitLog", 0.08, 0.4, 1.2],  // 80ms slapback → 400ms → 1.2s
      echoFeedback: (m) =>
        // Aggressive curve: ramps to 0.6 by midpoint, then pushes to 0.82.
        // The furnace chain means each repeat gets re-saturated, so high
        // feedback = exponential harmonic density, not just volume.
        m <= 0.5
          ? (m / 0.5) * 0.6
          : 0.6 + 0.22 * Math.pow((m - 0.5) / 0.5, 0.8),  // max 0.82 (0.85 * 0.82 = 0.697 < 1.0)
      echoMix: (m) =>
        // Slightly concave — delay comes in faster than linear.
        // The furnace character depends on echo being present.
        Math.pow(m, 0.8),
      echoFilterFreq: ["splitLog", 6000, 3200, 1800],  // bright → warm → dark repeats
    },
  },

  // ── Drift — "Convection" ──
  // At 0: static harmonics — the furnace is still.
  // At 1: vibrato destabilizes input frequencies, causing intermod
  //   products to shift constantly. Like heat shimmer over the forge.
  // Moderate speed range (0.1–1.5Hz) — not subsonic drift, not chorus.
  drift: {
    label: "Drift",
    default: 0.5,
    params: {
      wobbleRate:  ["splitLog", 0.05, 0.35, 1.5],     // slow shimmer → moderate → fast
      wobbleDepth: ["splitLinear", 0.0, 0.22, 0.75],   // none → moderate → heavy
      wobbleMix:   ["splitLinear", 0.0, 0.5, 0.9],     // dry → half → nearly full
    },
  },

  // ── Grit — "Temperature" ──
  // THE primary control. Transforms the sound completely across its range.
  // At 0: Chebyshev order 1, distortion off — clean pass-through.
  //   The furnace is cold. Just voices + delay + reverb.
  // At 0.5: Order 8 + moderate distortion — warm glow. The default.
  // At 1: Order 11 + full distortion + phaser — white-hot harmonic
  //   overload. Ring-mod artifacts, dense intermodulation, structured chaos.
  grit: {
    label: "Grit",
    default: 0.55,  // slightly above center — furnace character immediately apparent
    params: {
      // Chebyshev wet: ramps to full in first half, stays maxed
      gritDrive: (m) => (m <= 0.4 ? m / 0.4 : 1.0),
      // Chebyshev order: stepped progression through odd harmonics,
      // with even orders at the extremes for different tonal color
      chebyOrder: (m) =>
        m < 0.1 ? 1 :     // cold — near-linear
        m < 0.25 ? 3 :    // warm glow
        m < 0.4 ? 5 :     // active harmonics
        m < 0.55 ? 7 :    // rich overtone series
        m < 0.7 ? 8 :     // dense (even order = different intermod character)
        m < 0.85 ? 9 :    // heavy
        11,                // white-hot
      // Distortion drive: ramps across full range.
      // Unlike cathedral, it's never fully off — furnace always has some.
      satDrive: ["splitLinear", 0.1, 0.5, 1.0],   // always some → moderate → full
      // Distortion wet: starts low, always present.
      // The furnace always has distortion in the chain.
      satMix: (m) =>
        m <= 0.3
          ? 0.1 + (m / 0.3) * 0.15   // 0.1 → 0.25 in first third
          : 0.25 + 0.75 * Math.pow((m - 0.3) / 0.7, 1.2),  // 0.25 → 1.0 accelerating
      // Phaser: dormant below 0.55, then sweeps in for white-hot territory
      phaserFreq: (m) =>
        m <= 0.55 ? 0.4 : 0.4 * Math.pow(6.0 / 0.4, (m - 0.55) / 0.45),
      phaserOctaves: (m) =>
        m <= 0.55 ? 5 : Math.round(5 + 3 * ((m - 0.55) / 0.45)),
      phaserBase: (m) =>
        m <= 0.55 ? 380 : 380 * Math.pow(80 / 380, (m - 0.55) / 0.45),
      phaserQ: () => 8,
      phaserMix: (m) =>
        m <= 0.55 ? 0.0 : 0.55 * Math.pow((m - 0.55) / 0.45, 0.7),  // ramps to 0.55 at max
    },
  },

  // ── Tone — "Metal" ──
  // Controls the spectral character of the harmonic content.
  // At 0: bright like brass — upper harmonics dominate.
  // At 0.5: balanced like iron — the default forge character.
  // At 1: dark like lead — fundamental-heavy, thick, rumbling.
  // EQ dramatically shapes which Chebyshev harmonics dominate.
  tone: {
    label: "Tone",
    default: 0.5,
    params: {
      eqHigh: ["splitLinear", 6, -8, -22],     // bright brass → warm iron → dark lead
      eqMid:  ["splitLinear", -6, 5, 10],       // scooped → present → forward
      eqLow:  ["splitLinear", -8, 4, 14],       // thin → full → massive
    },
  },
};

// ─── Listen Presets ──────────────────────────────────────────
// Same as default — monitor EQ is playback-dependent, not preset-dependent.
export const LISTEN_PRESETS = {
  headphones:  { low: -2, mid: 0, high: 1, label: "HP" },
  laptop:      { low: 6, mid: 2, high: 3, label: "Laptop" },
  phone:       { low: 4, mid: 3, high: 2, label: "Phone" },
  loudspeaker: { low: 3, mid: -2, high: 0, label: "Speaker" },
};

// ─── FX Chain Configs ────────────────────────────────────────
// All 6 chains present for experimentation. Furnace is active.
export const CHAINS = {
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
      "reverb", "phaser", "ECHO", "chorus",
      "monitorEQ", "softClip",
    ],
    bypass: {},
  },

  // ── Active: Furnace ──
  // Delay before saturation — clean echoes get waveshaped together
  // with the dry signal. Each repeat re-enters the Chebyshev, creating
  // new sum/difference tones. Progressively dirtier. The sound of
  // harmonics multiplying.
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
      "chebyshev", "distortion", "eq3", "chorus",
      "monitorEQ", "softClip",
    ],
    bypass: {},
  },

  glass: {
    order: [
      "eq3", "vibrato", "ECHO", "reverb",
      "chorus", "phaser", "monitorEQ", "softClip",
    ],
    bypass: {},
  },

  custom: {
    order: [
      "chorus", "phaser", "eq3", "vibrato",
      "chebyshev", "distortion", "ECHO",
      "monitorEQ", "softClip", "reverb",
    ],
    bypass: {},
  },
};

// Furnace chain: delay → Chebyshev → distortion.
// The delay feedback loop feeds back through the waveshaper.
export const ACTIVE_CHAIN = "furnace";
