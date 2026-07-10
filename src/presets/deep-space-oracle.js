// ═══════════════════════════════════════════════════════════════
// DEEP SPACE ORACLE — "Hearing the Universe Breathe"
// ═══════════════════════════════════════════════════════════════
//
// Sonic personality: Extremely slow, massive, dark. Standing inside
// a nebula. Sub-bass drones with rich Chebyshev harmonics that evolve
// over time. Ancient and vast. On load, the cosmos hums.
//
// Chain: EVOLVE — space effects BEFORE saturation. Reverb and delay
// tails feed into Chebyshev waveshaper, generating new harmonics as
// they decay. Spectral content mutates over time. The room plays itself.
//
// Signal flow:
//   sum → vibrato → ECHO → reverb → phaser → chebyshev → distortion
//       → eq → chorus → monitorEQ → softClip
//
// ═══════════════════════════════════════════════════════════════

// ─── FX Parameter Defaults ───────────────────────────────────
// Values at m=0.5. The center of the sound — the cosmos at rest.
export const TUNING = {
  sampleRate: 16000,

  // ── Envelope (Bloom macro) ──
  // Glacial. Notes emerge from silence like stars condensing.
  // 6s attack means you won't hear the note for several seconds —
  // the anticipation IS the experience.
  attack: 6, // seconds — extremely slow onset
  decay: 4, // seconds — long fade into sustain
  sustain: 0.25, // low — voices whisper, never shout
  release: 8, // seconds — notes linger like light from dead stars

  // ── Chebyshev saturation (Grit macro) ──
  // High order = rich harmonic series. In the evolve chain, this sits
  // AFTER reverb/delay — so it's waveshaping the entire space, not
  // just the dry voices. Reverb resonances become new harmonics.
  chebyOrder: 5, // order 5 = fundamental + 5th harmonic overtone series
  chebyWet: 0.8, // mostly saturated — the harmonics ARE the sound

  // ── Tape EQ (Tone macro) ──
  // Dark. Sub-bass-forward. High frequencies rolled off hard —
  // space is dark, light doesn't travel here.
  eqHigh: -18, // dB — aggressive high rolloff
  eqMid: 0, // dB — neutral mid (let Chebyshev harmonics define it)
  eqLow: 8, // dB — sub-bass emphasis, feel it in your chest
  eqHighFreq: 2200, // Hz — low crossover, darkness starts early

  // ── Vibrato / tidal drift (Drift macro) ──
  // Subsonic. Not wobble — ocean currents, tidal forces.
  // 0.04Hz = 25 second cycle. You feel this, not hear it.
  vibratoFreq: 0.04, // Hz — subsonic tidal period
  vibratoDepth: 0.15, // subtle — planets don't jitter
  vibratoWet: 0.6, // mostly wet — the drift is always present

  // ── Echo / delay cascade (Echo macro) ──
  // Long delay, dark filter. Echoes dissolve into reverb, then the
  // combined reverb+echo tail feeds into Chebyshev (evolve chain).
  // Each repeat spawns new harmonics.
  delayTime: 1.4, // seconds — long gap between repeats
  delayFeedback: 0.55, // moderate — enough repeats to build density
  delayWet: 0.45, // balanced — dry note + dissolved echoes

  // ── Algorithmic reverb (Aether macro) ──
  // Near-infinite. Very dark dampening — only sub frequencies survive.
  // This is not "a room" — this is the resonant frequency of a void.
  reverbRoom: 0.97, // nearly infinite decay
  reverbDamp: 700, // Hz — extremely dark, sub-bass resonances only
  reverbWet: 0.7, // mostly reverb — the space IS the instrument

  // ── Damp sweep (Aether macro) ──
  // Slow sweep of the reverb dampening creates evolving resonances.
  // At this speed, the tonal color shifts over ~30 seconds.
  dampSweepRate: 0.035, // Hz — very slow evolution
  dampSweepDepth: 0.3, // moderate depth — audible tonal shifts

  // ── Per-voice panning LFOs (Aether macro) ──
  // Very slow drift across the stereo field. Voices wander like
  // celestial objects in a slow orbit.
  panLfoFreq: 0.02, // Hz — 50 second drift cycle
  panLfoAmplitude: 0.3, // wide drift — voices spread across the void

  // ── Monitor EQ crossover frequencies ──
  monitorLowFreq: 400,
  monitorHighFreq: 2500,

  // ── Stagger / retrigger ──
  // Wide stagger — voices enter one at a time, building slowly.
  stagger: 0.7, // seconds — voices bloom sequentially
  retriggerGap: 120, // ms — slow retriggering

  // ── Phaser (Grit macro) ──
  // In the evolve chain, phaser sits between reverb and Chebyshev.
  // Sweeping allpass creates spectral interference patterns that
  // Chebyshev then harmonically enriches. Spectral shimmer engine.
  phaserFreq: 0.08, // Hz — very slow sweep
  phaserOctaves: 5, // wide range — sweeps across the spectrum
  phaserBase: 200, // Hz — low base, catches sub-bass content
  phaserQ: 8, // resonant — pronounced comb-filter peaks
  phaserWet: 0.15, // subtle at rest — Grit macro activates it

  // ── Echo feedback loop filter ──
  // Very dark. Each echo repeat loses most of its high content.
  // Echoes become progressively more subterranean.
  echoFilterFreq: 1200, // Hz — dark feedback path

  // ── Distortion (Grit macro) ──
  // Secondary saturation stage after Chebyshev. In evolve chain,
  // this stacks on top of already-waveshaped reverb tails.
  distortion: 0.3, // moderate drive
  distortionWet: 0.05, // nearly off at rest — Grit macro awakens it

  // ── Echo feedback safety ──
  // echoSatDrive * delayFeedback = 0.45 * 0.55 = 0.2475 — safe
  echoSatDrive: 0.45, // gentle saturation in echo loop
  echoInputGain: 0.5, // attenuated — the sum can get dense with long release

  // ── Aspect sonification ──
  aspectConsonantBoost: 0.03, // velocity bump per consonant aspect
  aspectFocalBoost: 0.04,     // velocity bump per conjunction
  aspectBoostCap: 0.1,       // max total velocity lift per sign
  aspectTensionCents: 5,      // detune offset for tense-aspect pairs

  // ── Orbit mode ──
  orbitPeriodMin: 20, // seconds — fastest voice cycle (Moon)
  orbitPeriodMax: 110, // seconds — slowest voice cycle (Saturn)
  orbitDuty: 0.5,    // fraction of the cycle a voice holds before release
};

// ─── Shadow / Eclipse Mode — Cosmic Horror ──────────────────
// Eclipse: the universe stops breathing and starts screaming.
// Near-infinite everything. Subsonic vibrato. Alien transmission.
// echoSatDrive (0.45) * delayFeedback (0.92) = 0.414 — safe
export const SHADOW = {
  reverbWet: 0.95, // almost entirely reverb
  delayFeedback: 0.92, // near-infinite cascading echoes
  delayWet: 0.9, // overwhelmingly wet
  vibratoDepth: 0.6, // deep subsonic pitch drift
  vibratoFreq: 0.015, // ~67 second cycle — glacial alien modulation
  chebyWet: 1.0, // full saturation of entire space
  panLfoFreq: 0.08, // faster wandering — disorienting
  panLfoAmplitude: 0.8, // extreme stereo — voices come from everywhere
  oscSpread: 180, // maximum detuning — dissonant cloud
  detuneRange: 25, // extreme random detune
  rampTime: 24, // seconds — slow descent into horror
};

// ─── Macro Definitions ───────────────────────────────────────
// 6 macros, each 0-1. Designed for maximum sonic range.
// At m=0.5, each param equals its TUNING default.

export const MACROS = {
  // ── Bloom — "Stellar Ignition" ──
  // At 0: quick bright pings — short attack, brief decay. A spark.
  // At 0.5: glacial cosmic bloom — notes take 6s to appear.
  // At 1: 12s attack, notes never die. Heat death of the universe.
  // The full range zooms from a spark to a supernova.
  bloom: {
    label: "Bloom",
    default: 0.6, // slightly above center — lean toward the infinite
    params: {
      attack: ["splitLog", 0.02, 6.0, 12.0], // 20ms spark → 6s bloom → 12s emergence
      decay: ["splitLog", 0.2, 4.0, 12.0], // 200ms → 4s → 12s sustain tail
      sustain: ["splitLinear", 0.0, 0.25, 0.7], // silent → whisper → sustained drone
      release: ["splitLog", 0.3, 8.0, 20.0], // 300ms → 8s → 20s — light from dead stars
    },
  },

  // ── Aether — "Cosmic Scale" ──
  // THE primary control. This defines the size of the universe.
  // At 0: intimate whisper — small room, dry, narrow stereo.
  // At 0.5: standing in a nebula — vast, dark, wide.
  // At 1: infinite void — everything dissolves into resonance.
  // dampSweep gets more active at high values for evolving resonances.
  aether: {
    label: "Aether",
    default: 0.55, // slightly above center — start vast
    params: {
      reverbRoom: ["splitLinear", 0.5, 0.97, 1.0], // medium → near-infinite → infinite
      reverbDamp: ["splitLog", 3000, 700, 300], // warm → dark → abyss
      reverbMix: ["splitLinear", 0.15, 0.7, 0.95], // 15% → 70% → 95% wet
      dampSweepRate: ["splitLog", 0.005, 0.035, 0.2], // near-static → slow → evolving
      dampSweepDepth: ["splitLinear", 0.0, 0.3, 0.9], // off → moderate → extreme morphing
      panDrift: ["splitLog", 0.005, 0.02, 0.15], // frozen → slow orbit → wandering
      panWidth: ["splitLinear", 0.05, 0.3, 0.9], // near-mono → wide → immersive
      aetherShimmer: ["dormantLinear", 0.0, 0.4], // subtle chorus, only at high Aether
    },
  },

  // ── Echo — "Time Dilation" ──
  // At 0: no echo. Clean void.
  // At 0.5: long dark echoes dissolving into reverb.
  // At 1: cascading near-infinite repeats feeding the evolve chain.
  // Feedback curve is aggressive but always safe with echoSatDrive=0.45.
  echo: {
    label: "Echo",
    default: 0.45, // slightly below center — let space breathe
    params: {
      echoTime: ["splitLog", 0.3, 1.4, 3.0], // 300ms → 1.4s → 3s between repeats
      echoFeedback: (m) =>
        // Aggressive curve: ramps to 0.55 at midpoint, then accelerates
        // toward 0.92 at max. With echoSatDrive=0.45, max product = 0.414.
        m <= 0.5
          ? (m / 0.5) * 0.55
          : 0.55 + 0.37 * Math.pow((m - 0.5) / 0.5, 0.8),
      echoMix: (m) =>
        // Slightly exponential: silent at 0, ramps gently then opens up
        Math.pow(m, 0.8),
      echoFilterFreq: ["splitLog", 4000, 1200, 500], // warm → dark → subterranean
    },
  },

  // ── Drift — "Orbital Wobble" ──
  // NEVER fast. This is planets orbiting, not tape flutter.
  // At 0: static. No modulation.
  // At 0.5: subtle tidal drift — 25 second pitch cycle.
  // At 1: deep subsonic wobble (0.015Hz = 67 second cycle).
  // Rate actually DECREASES with the knob — deeper = slower.
  drift: {
    label: "Drift",
    default: 0.5,
    params: {
      // Rate inverted: higher Drift = SLOWER vibrato. More cosmic.
      wobbleRate: (m) =>
        m <= 0.5
          ? 0.01 + (m / 0.5) * 0.03 // 0.01Hz → 0.04Hz (nearly static → tidal)
          : 0.04 - 0.025 * ((m - 0.5) / 0.5), // 0.04Hz → 0.015Hz (tidal → glacial)
      wobbleDepth: ["splitLinear", 0.0, 0.15, 0.55], // none → subtle → deep pitch drift
      wobbleMix: ["splitLinear", 0.0, 0.6, 1.0], // dry → present → full modulation
    },
  },

  // ── Grit — "Harmonic Density" ──
  // In the evolve chain, saturation sits AFTER reverb/delay.
  // This controls how much the space tails get harmonically enriched.
  // At 0: barely any saturation — clean reverb tails.
  // At 0.5: warm Chebyshev harmonics from the space.
  // At 1: thick overtone cascade with phaser interference
  //        creating shifting spectral patterns.
  grit: {
    label: "Grit",
    default: 0.5,
    params: {
      // Chebyshev wet: ramps from barely there to full saturation
      gritDrive: (m) => (m <= 0.5 ? (m / 0.5) * 0.8 : 0.8 + 0.2 * ((m - 0.5) / 0.5)),
      // Chebyshev order: stepped, favoring higher orders for this preset
      chebyOrder: (m) =>
        m < 0.15
          ? 1 // clean
          : m < 0.35
            ? 3 // warm
            : m < 0.55
              ? 5 // rich (default region)
              : m < 0.7
                ? 7 // dense
                : m < 0.85
                  ? 9 // complex
                  : 11, // extreme harmonic generation
      // Distortion: dormant below 0.5, activates to stack with Chebyshev
      satDrive: ["splitLinear", 0.0, 0.3, 0.9], // none → gentle → heavy
      satMix: ["dormantLinear", 0.0, 0.8], // off until 0.5, then ramps
      // Phaser: evolve chain places it between reverb and Chebyshev,
      // so it creates spectral interference that Chebyshev then enriches
      phaserFreq: (m) =>
        m <= 0.5 ? 0.08 : 0.08 * Math.pow(2.0 / 0.08, (m - 0.5) / 0.5),
      phaserOctaves: (m) =>
        m <= 0.5 ? 5 : Math.round(5 + 3 * ((m - 0.5) / 0.5)),
      phaserBase: (m) =>
        m <= 0.5 ? 200 : 200 * Math.pow(80 / 200, (m - 0.5) / 0.5),
      phaserQ: () => 8, // constant — resonant throughout
      phaserMix: ["dormantLinear", 0.0, 0.5], // off until Grit > 0.5
    },
  },

  // ── Tone — "Spectrum" ──
  // Extreme range. Reimagined for deep space.
  // At 0: high-frequency sparkle — stellar twinkle, thin and bright.
  // At 0.5: dark warmth — the default space character.
  // At 1: all sub-bass — deep space rumble, only the lowest frequencies survive.
  tone: {
    label: "Tone",
    default: 0.55, // lean dark — this is deep space, not daylight
    params: {
      eqHigh: ["splitLinear", 6, -18, -30], // +6dB twinkle → -18dB dark → -30dB void
      eqMid: ["splitLinear", -8, 0, 8], // scooped → neutral → forward
      eqLow: ["splitLinear", -6, 8, 18], // thin → sub-heavy → seismic
    },
  },
};

// ─── Listen Presets ──────────────────────────────────────────
// Same monitor EQ compensation as the default tuning.
export const LISTEN_PRESETS = {
  headphones: { low: -2, mid: 0, high: 1, label: "HP" },
  laptop: { low: 6, mid: 2, high: 3, label: "Laptop" },
  phone: { low: 4, mid: 3, high: 2, label: "Phone" },
  loudspeaker: { low: 3, mid: -2, high: 0, label: "Speaker" },
};

// ─── FX Chain Configs ────────────────────────────────────────
// All 6 chains preserved. ACTIVE_CHAIN selects evolve.
export const CHAINS = {
  cathedral: {
    order: [
      "chebyshev",
      "eq3",
      "vibrato",
      "ECHO",
      "reverb",
      "chorus",
      "monitorEQ",
      "softClip",
    ],
    bypass: {
      distortion: { after: "chebyshev", before: "eq3" },
      phaser: { after: "chorus", before: "monitorEQ" },
    },
  },
  void: {
    order: [
      "chebyshev",
      "distortion",
      "eq3",
      "vibrato",
      "reverb",
      "phaser",
      "ECHO",
      "chorus",
      "monitorEQ",
      "softClip",
    ],
    bypass: {},
  },
  furnace: {
    order: [
      "ECHO",
      "chebyshev",
      "distortion",
      "eq3",
      "vibrato",
      "reverb",
      "chorus",
      "phaser",
      "monitorEQ",
      "softClip",
    ],
    bypass: {},
  },
  tape: {
    order: [
      "vibrato",
      "chebyshev",
      "distortion",
      "eq3",
      "ECHO",
      "reverb",
      "chorus",
      "phaser",
      "monitorEQ",
      "softClip",
    ],
    bypass: {},
  },
  evolve: {
    order: [
      "vibrato",
      "ECHO",
      "reverb",
      "phaser",
      "chebyshev",
      "distortion",
      "eq3",
      "chorus",
      "monitorEQ",
      "softClip",
    ],
    bypass: {},
  },
  glass: {
    order: [
      "eq3",
      "vibrato",
      "ECHO",
      "reverb",
      "chorus",
      "phaser",
      "monitorEQ",
      "softClip",
    ],
    bypass: {},
  },
  custom: {
    order: [
      "chorus",
      "phaser",
      "eq3",
      "vibrato",
      "chebyshev",
      "distortion",
      "ECHO",
      "monitorEQ",
      "softClip",
      "reverb",
    ],
    bypass: {},
  },
};

// Evolve chain: space before saturation. The room generates the harmonics.
export const ACTIVE_CHAIN = "evolve";
