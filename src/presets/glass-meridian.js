// ═══════════════════════════════════════════════════════════════
// GLASS MERIDIAN — "Light refracting through crystal"
//
// Sonic personality: Pure, fragile, luminous. Each note is a clear
// bell tone with subtle spectral shimmer. No saturation in the
// signal path — beauty lives in the purity of clean voices
// interacting with bright reverb resonances and precise echoes.
//
// Chain: glass — sum → eq → vibrato → ECHO → reverb → chorus → phaser → monEQ → clip
// No chebyshev, no distortion. The signal stays clean.
//
// Designed for: First impression at demo. Must be immediately
// captivating — "wow, what IS that?" territory.
// ═══════════════════════════════════════════════════════════════

// ─── FX Parameter Defaults ───────────────────────────────────
// Values at m=0.5 for each macro. Tuned for crystalline character.
export const TUNING = {
  sampleRate: 16000,

  // ── Envelope (Bloom macro) ──
  // Singing bowl character at midpoint: clear attack, sustained ring.
  attack: 0.5,         // seconds — moderate, not percussive, not glacial
  decay: 1.2,          // seconds — medium decay lets notes ring
  sustain: 0.45,       // 0–1 — higher sustain than other presets: notes SING
  release: 2.0,        // seconds — graceful fade, not abrupt

  // ── Chebyshev saturation ──
  // Present in TUNING for engine init but INACTIVE in glass chain.
  // Chebyshev node exists but is never wired into signal path.
  chebyOrder: 1,       // harmonic order (1 = pass-through if somehow reached)
  chebyWet: 0.0,       // fully dry — glass chain skips this entirely

  // ── Crystal EQ (Tone macro) ──
  // Bright, airy default. Highs boosted, lows gently scooped.
  // EQ is FIRST in the glass chain — shapes the raw voice before anything else.
  eqHigh: 6,           // dB — bright high shelf, crystalline presence
  eqMid: 1,            // dB — clean, slightly forward mids
  eqLow: -4,           // dB — scooped lows, reduces muddiness
  eqHighFreq: 3500,    // Hz — high band crossover, tuned for bell harmonics

  // ── Light shimmer / vibrato (Drift macro) ──
  // Fast and shallow — "light dancing on water," not VHS drift.
  vibratoFreq: 0.4,    // Hz — faster than default, subtle shimmer
  vibratoDepth: 0.15,  // 0–1 — very shallow, just enough movement
  vibratoWet: 0.3,     // 0–1 — blended, not dominant

  // ── Bright echo / reflections (Echo macro) ──
  // Short, bright delays — sound bouncing off glass surfaces.
  // Slapback sparkle character: many fast reflections, not long wash.
  delayTime: 0.18,     // seconds — short slapback (180ms)
  delayFeedback: 0.4,  // 0–1 — moderate repeats
  delayWet: 0.25,      // 0–1 — present but not dominant

  // ── Bright hall reverb (Aether macro) ──
  // Medium-bright hall. Reverb adds space without darkening.
  // Comb filter resonances create harmonic shimmer from clean tones.
  reverbRoom: 0.65,    // 0–1 — medium hall
  reverbDamp: 4000,    // Hz — BRIGHT dampening (high cutoff = more highs survive)
  reverbWet: 0.4,      // 0–1 — present, not drowning

  // ── Damp sweep (Aether macro) ──
  // Gentle modulation of reverb character — subtle spectral animation.
  dampSweepRate: 0.06, // Hz — slow sweep
  dampSweepDepth: 0.15, // 0–1 — subtle movement

  // ── Per-voice panning LFOs (Aether macro) ──
  panLfoFreq: 0.04,    // Hz — very slow stereo drift
  panLfoAmplitude: 0.15, // 0–1 — gentle width

  // ── Monitor EQ crossover frequencies ──
  monitorLowFreq: 400,
  monitorHighFreq: 2500,

  // ── Stagger / retrigger ──
  stagger: 0.3,        // seconds — slightly tighter than default for clarity
  retriggerGap: 80,    // ms

  // ── Phaser (Grit macro — repurposed as "prism" for glass) ──
  // In glass chain, phaser provides spectral color shifting.
  // No chebyshev/distortion, so Grit = phaser intensity + EQ resonance.
  phaserFreq: 0.2,     // Hz — slow sweep
  phaserOctaves: 3,    // octave range
  phaserBase: 500,     // Hz — base frequency
  phaserQ: 5,          // moderate resonance
  phaserWet: 0.0,      // starts off — Grit macro activates it

  // ── Echo feedback loop filter ──
  // BRIGHT filter — echoes stay clear, not dark.
  echoFilterFreq: 7000, // Hz — high cutoff preserves sparkle in repeats

  // ── Distortion ──
  // Present for engine init but INACTIVE in glass chain.
  distortion: 0.0,
  distortionWet: 0.0,

  // ── Echo feedback safety ──
  // echoSatDrive * delayFeedback = 0.5 * 0.4 = 0.20 — well under 1.0
  echoSatDrive: 0.5,
  echoInputGain: 0.6,  // lower input gain for cleaner signal

  // ── Aspect sonification ──
  aspectConsonantBoost: 0.04, // velocity bump per consonant aspect
  aspectFocalBoost: 0.05,     // velocity bump per conjunction
  aspectBoostCap: 0.12,       // max total velocity lift per sign
  aspectTensionCents: 3,      // detune offset for tense-aspect pairs

  // ── Orbit mode ──
  orbitPeriodMin: 12, // seconds — fastest voice cycle (Moon)
  orbitPeriodMax: 64, // seconds — slowest voice cycle (Saturn)
  orbitDuty: 0.4,    // fraction of the cycle a voice holds before release
};

// ─── Shadow / Eclipse Mode: "Shattered Prism" ───────────────
// Crystal fractures into kaleidoscopic chaos. Phaser intensifies,
// echoes cascade, chorus widens. Maintains brightness — this isn't
// harsh, it's a prism breaking light into shifting spectral fragments.
//
// Safety check: echoSatDrive(0.5) * delayFeedback(0.82) = 0.41 < 1.0 ✓
export const SHADOW = {
  reverbWet: 0.75,           // brighter, wetter hall
  delayFeedback: 0.82,       // cascading reflections (0.5 * 0.82 = 0.41 < 1.0)
  delayWet: 0.7,             // echoes become prominent
  vibratoDepth: 0.35,        // increased shimmer, still not wobbly
  vibratoFreq: 0.6,          // faster shimmer
  chebyWet: 0.0,             // stays clean — glass chain, no saturation
  panLfoFreq: 0.15,          // faster stereo movement
  panLfoAmplitude: 0.5,      // wide stereo field
  oscSpread: 80,             // moderate detuning — prismatic
  detuneRange: 10,           // cents — subtle beating
  rampTime: 12,              // seconds — graceful transition into chaos
};

// ─── Macro Definitions ───────────────────────────────────────
// 6 macro knobs, each 0–1. Radically reimagined for crystalline sound.

export const MACROS = {
  // ── Bloom — "Bell Shape" ──────────────────────────────────
  // At 0: sharp percussive attack (mallets striking crystal)
  // At 0.5: singing bowl (clear ring, sustained)
  // At 1: slow ethereal fade-in (aurora borealis)
  // Higher sustain across the range than other presets — notes always sing.
  bloom: {
    label: "Bloom",
    default: 0.55,          // slightly above center for lush first impression
    params: {
      attack:  ["splitLog", 0.01, 0.5, 5.0],       // 10ms crystal tap → 500ms bowl → 5s aurora
      decay:   ["splitLog", 0.3, 1.2, 6.0],         // quick ring → medium → eternal
      sustain: ["splitLinear", 0.15, 0.45, 0.7],    // quiet but present → singing → full hold
      release: ["splitLog", 0.2, 2.0, 8.0],         // short fade → graceful → infinite tail
    },
  },

  // ── Aether — "Hall Size" ──────────────────────────────────
  // At 0: dry, close-mic'd crystal — intimate, no room
  // At 0.5: bright medium hall — the sweet spot
  // At 1: massive bright cathedral with chorus shimmer
  // Dampening stays BRIGHT across the entire range — never goes dark.
  aether: {
    label: "Aether",
    default: 0.55,          // slightly above center for immediate spaciousness
    params: {
      reverbRoom:     ["splitLinear", 0.2, 0.65, 0.92],   // tight → medium hall → cathedral
      // Dampening: bright → slightly less bright → still bright
      // Even at max aether, dampening stays above 2500Hz — crystal never goes dark.
      reverbDamp:     ["splitLog", 6000, 4000, 2500],      // very bright → bright → warm-bright
      reverbMix:      ["splitLinear", 0.05, 0.4, 0.75],    // 5% dry → 40% hall → 75% cathedral
      dampSweepRate:  ["splitLog", 0.01, 0.06, 0.3],       // near-static → slow → moderate
      dampSweepDepth: ["splitLinear", 0.0, 0.15, 0.6],     // off → subtle → animated
      panDrift:       ["splitLog", 0.01, 0.04, 0.2],       // static → slow → moderate drift
      panWidth:       ["splitLinear", 0.0, 0.15, 0.6],     // mono → subtle → wide stereo
      // Chorus shimmer starts active and grows with aether.
      // Even at m=0, there's a touch of chorus for stereo life.
      aetherShimmer:  ["splitLinear", 0.12, 0.2, 0.5],     // subtle shimmer → moderate → lush
    },
  },

  // ── Echo — "Reflections" ──────────────────────────────────
  // At 0: dry, no echoes
  // At 0.5: bright slapback sparkle
  // At 1: cascading bright echoes off glass walls
  // Short delay times throughout — cap at 500ms. Many reflections, not long delays.
  echo: {
    label: "Echo",
    default: 0.5,
    params: {
      // Delay time stays short — glass reflections, not canyon echoes
      echoTime:       ["splitLog", 0.06, 0.18, 0.45],      // 60ms tap → 180ms slap → 450ms cascade
      // Feedback: gentle ramp, then careful climb for cascading effect
      echoFeedback:   (m) =>
        m <= 0.5
          ? (m / 0.5) * 0.4                                // 0 → 0.4
          : 0.4 + 0.35 * Math.pow((m - 0.5) / 0.5, 1.3),  // 0.4 → 0.75 (convex curve)
      // max 0.75: echoSatDrive(0.5) * 0.75 = 0.375 < 1.0 ✓
      echoMix:        (m) => m,                             // linear identity: dry → full wet
      // Echo filter stays BRIGHT — reflections sparkle, never get muddy
      echoFilterFreq: ["splitLog", 10000, 7000, 5000],      // brilliant → bright → warm-bright
    },
  },

  // ── Drift — "Light Shimmer" ───────────────────────────────
  // Repurposed: not VHS wobble, but light playing on surfaces.
  // Fast and shallow vibrato + chorus interaction.
  // At 0: static, crystalline stillness
  // At 0.5: gentle shimmer like light on water
  // At 1: rich shimmering movement — "light dancing through a prism"
  // NEVER wobbly or seasick. Always fast (0.3-2Hz) and shallow.
  drift: {
    label: "Drift",
    default: 0.5,
    params: {
      wobbleRate:  ["splitLog", 0.1, 0.4, 2.0],        // very slow → fast shimmer → rapid flutter
      wobbleDepth: ["splitLinear", 0.0, 0.15, 0.35],   // none → subtle → moderate (capped low!)
      wobbleMix:   ["splitLinear", 0.0, 0.3, 0.65],    // dry → blended → prominent
    },
  },

  // ── Grit — "Prism" (repurposed for glass chain) ──────────
  // No chebyshev or distortion in the signal path — those nodes
  // aren't wired in glass chain. Instead, Grit controls:
  //   - Phaser intensity: moving spectral notches = "light through a prism"
  //   - At 0: pure, uncolored crystal
  //   - At 0.5+: phaser activates, spectral colors shift
  //   - At 1: aggressive phaser + resonant sweep = "shattered glass"
  //
  // chebyOrder and chebyWet are mapped but have no audible effect
  // in glass chain since chebyshev isn't in the signal path.
  grit: {
    label: "Grit",
    default: 0.3,             // below center — pure crystal by default
    params: {
      // Chebyshev params: mapped for interface compatibility, no audible effect in glass
      gritDrive:    () => 0.0,         // always off — glass chain
      chebyOrder:   () => 1,            // pass-through order, never wired
      // Distortion: also not in glass chain signal path
      satDrive:     () => 0.0,
      satMix:       () => 0.0,
      // Phaser: THIS is where the action is for glass.
      // Dormant below 0.3, then ramps up. The phaser creates spectral
      // interference patterns — like light splitting through a prism.
      phaserFreq:   (m) =>
        m <= 0.3 ? 0.2 : 0.2 + 3.8 * Math.pow((m - 0.3) / 0.7, 1.5),  // 0.2Hz → 4Hz
      phaserOctaves: (m) =>
        m <= 0.3 ? 3 : Math.round(3 + 5 * ((m - 0.3) / 0.7)),           // 3 → 8
      phaserBase:   (m) =>
        m <= 0.3 ? 500 : 500 * Math.pow(150 / 500, (m - 0.3) / 0.7),    // 500Hz → 150Hz (sweep down)
      phaserQ:      (m) =>
        m <= 0.3 ? 5 : 5 + 15 * Math.pow((m - 0.3) / 0.7, 1.2),        // 5 → 20 (increasing resonance)
      phaserMix:    (m) =>
        m <= 0.3 ? 0.0 : Math.min(0.7, 0.7 * Math.pow((m - 0.3) / 0.7, 0.8)),  // off → 0.7
    },
  },

  // ── Tone — "Color Temperature" ────────────────────────────
  // At 0: cool blue — extreme treble boost, bass cut. Ice crystals.
  // At 0.5: balanced crystal — bright and clear, the default character.
  // At 1: warm gold — gentle high rolloff, mid presence. Amber glass.
  // Both ends sound beautiful — just different flavors of luminous.
  tone: {
    label: "Tone",
    default: 0.5,
    params: {
      eqHigh: ["splitLinear", 14, 6, -6],     // +14dB ice → +6dB crystal → -6dB warm
      eqMid:  ["splitLinear", -6, 1, 8],       // scooped → neutral → forward presence
      eqLow:  ["splitLinear", -12, -4, 4],     // very thin → slight scoop → warm body
    },
  },
};

// ─── Listen Presets ──────────────────────────────────────────
// Monitor EQ compensation — same as default, works for any preset.
export const LISTEN_PRESETS = {
  headphones:  { low: -2, mid: 0, high: 1, label: "HP" },
  laptop:      { low: 6, mid: 2, high: 3, label: "Laptop" },
  phone:       { low: 4, mid: 3, high: 2, label: "Phone" },
  loudspeaker: { low: 3, mid: -2, high: 0, label: "Speaker" },
};

// ─── FX Chain Configs ────────────────────────────────────────
// All chains defined for reference. Glass is active.
export const CHAINS = {
  cathedral: {
    order: ["chebyshev", "eq3", "vibrato", "ECHO", "reverb", "chorus", "monitorEQ", "softClip"],
    bypass: {
      distortion: { after: "chebyshev", before: "eq3" },
      phaser: { after: "chorus", before: "monitorEQ" },
    },
  },
  void: {
    order: ["chebyshev", "distortion", "eq3", "vibrato", "reverb", "phaser", "ECHO", "chorus", "monitorEQ", "softClip"],
    bypass: {},
  },
  furnace: {
    order: ["ECHO", "chebyshev", "distortion", "eq3", "vibrato", "reverb", "chorus", "phaser", "monitorEQ", "softClip"],
    bypass: {},
  },
  tape: {
    order: ["vibrato", "chebyshev", "distortion", "eq3", "ECHO", "reverb", "chorus", "phaser", "monitorEQ", "softClip"],
    bypass: {},
  },
  evolve: {
    order: ["vibrato", "ECHO", "reverb", "phaser", "chebyshev", "distortion", "eq3", "chorus", "monitorEQ", "softClip"],
    bypass: {},
  },
  // ── Glass (ACTIVE) ──
  // No saturation — clean voices through EQ, vibrato, delay, reverb.
  // Phaser is inline (not bypassed) so Grit macro can sweep it in.
  // Signal: sum → eq → vibrato → ECHO → reverb → chorus → phaser → monEQ → clip
  glass: {
    order: ["eq3", "vibrato", "ECHO", "reverb", "chorus", "phaser", "monitorEQ", "softClip"],
    bypass: {},
  },
  custom: {
    order: ["chorus", "phaser", "eq3", "vibrato", "chebyshev", "distortion", "ECHO", "monitorEQ", "softClip", "reverb"],
    bypass: {},
  },
};

// Glass chain — pure, no saturation, crystalline.
export const ACTIVE_CHAIN = "glass";
