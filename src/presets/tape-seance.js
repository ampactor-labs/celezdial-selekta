// ═══════════════════════════════════════════════════════════════
// TAPE SEANCE — "A cassette recording of a ritual, played back
//                on a warped deck"
//
// Thick, degraded, haunted. The sound of magnetic tape remembering
// something it shouldn't. Heavy VHS wow, dark tape EQ, long smeary
// feedback delay, warm Chebyshev saturation. Unsettling beauty.
//
// Chain: tape — vibrato FIRST. Pitch drift feeds into Chebyshev,
// creating time-varying harmonic content because the frequency
// shifts cause the waveshaper to generate different intermodulation
// products each moment. The tape degradation IS the character.
//
// Exports: TUNING, SHADOW, MACROS, LISTEN_PRESETS, CHAINS, ACTIVE_CHAIN
// ═══════════════════════════════════════════════════════════════

// ─── FX Parameter Defaults ───────────────────────────────────
// m=0.5 center points, tuned for immediate tape character on load.
// Drift default is 0.6 so the warble is present from first listen.
export const TUNING = {
  sampleRate: 16000,

  // ── Envelope (Bloom macro) ──
  // Murky emergence — notes don't start clean, they fade in through hiss.
  // Medium attack lets notes materialize slowly. Long decay/release
  // creates a smeared sustain tail. Higher sustain than default because
  // tape compression squashes dynamics — everything is "always on."
  attack: 1.5,       // seconds — slow materialization
  decay: 2.0,        // seconds — long smeared tail
  sustain: 0.55,     // 0–1 — tape compression holds level up
  release: 3.0,      // seconds — notes linger in the oxide

  // ── Chebyshev saturation (Grit macro) ──
  // Order 4 — warm even harmonics dominate. Full wet because every
  // signal path on a cassette deck passes through magnetic saturation.
  // Combined with vibrato-first chain, the pitch drift creates
  // continuously shifting harmonic content.
  chebyOrder: 4,     // harmonic order — warm, not harsh
  chebyWet: 1.0,     // full wet — everything is saturated on tape

  // ── Tape EQ (Tone macro) ──
  // Aggressive high rolloff simulates cassette frequency response.
  // Everything above 3kHz is attenuated like it's been dubbed too many
  // times. Boosted lows and mids give that thick "recorded through a
  // blanket" quality.
  eqHigh: -18,       // dB — aggressive tape rolloff
  eqMid: 5,          // dB — thick mid presence
  eqLow: 5,          // dB — warm low end
  eqHighFreq: 2800,  // Hz — low crossover emphasizes the rolloff

  // ── VHS wow / vibrato (Drift macro) ──
  // THE signature effect. Slow deep pitch modulation — audible warble
  // like a dying Walkman motor. At default 0.6 Drift, this creates
  // obvious pitch instability. Rate is subsonic so the warble feels
  // tidal, not mechanical.
  vibratoFreq: 0.15, // Hz — ~7 second cycle, slow cassette wow
  vibratoDepth: 0.50, // high depth — pitch should audibly drift
  vibratoWet: 1.0,   // full wet — no dry path, everything warbles

  // ── Echo / delay cascade (Echo macro) ──
  // Smeary dark delay — each repeat more degraded than the last.
  // Long delay time + high feedback + dark filter = tape loop machine.
  // The lowpass in the feedback path removes more highs on each repeat,
  // simulating generation loss with every pass through the heads.
  delayTime: 1.0,    // seconds — long, smeary repeats
  delayFeedback: 0.75, // high feedback — many degrading repeats
  delayWet: 0.4,     // moderate wet — echo present but not dominant

  // ── Algorithmic reverb (Aether macro) ──
  // Large room but extremely dark — the reverb sounds like it's
  // underwater. Dampening at 500Hz means almost no high-frequency
  // content survives the reverb tail. Submerged, murky, distant.
  reverbRoom: 0.92,  // near-infinite room — vast murky space
  reverbDamp: 500,   // Hz — extremely dark, underwater quality
  reverbWet: 0.55,   // moderate-high wet — the murk is present

  // ── Damp sweep (Aether macro) ──
  // Slow modulation of reverb darkness. The submerged quality
  // breathes and shifts.
  dampSweepRate: 0.06,  // Hz — glacial sweep
  dampSweepDepth: 0.25, // moderate depth — subtle shifting

  // ── Per-voice panning LFOs (Aether macro) ──
  // Disorienting slow pan drift — sounds move in the murk.
  panLfoFreq: 0.04,     // Hz — very slow, disorienting
  panLfoAmplitude: 0.18, // moderate width — things shift in the dark

  // ── Monitor EQ crossover frequencies ──
  monitorLowFreq: 400,
  monitorHighFreq: 2500,

  // ── Stagger / retrigger ──
  stagger: 0.55,     // longer stagger — voices emerge at different times
  retriggerGap: 100,  // ms — slightly slower retrigger

  // ── Phaser (Grit macro, dormant below 0.5) ──
  // When activated, adds dirty tape-head interference pattern.
  // Slow sweep, wide range — like azimuth drift on worn heads.
  phaserFreq: 0.2,
  phaserOctaves: 5,
  phaserBase: 350,
  phaserQ: 8,
  phaserWet: 0.1,

  // ── Echo feedback loop filter ──
  // Very dark — each repeat loses more highs. Generation loss.
  echoFilterFreq: 1500, // Hz — dark, each repeat more muffled

  // ── Distortion (Grit macro, dormant below 0.5) ──
  // Overdriven tape input — the red meters of a cassette deck
  // pushed past 0 VU.
  distortion: 0.5,
  distortionWet: 0.1,

  // ── Echo feedback safety ──
  // echoSatDrive * delayFeedback = 0.8 * 0.75 = 0.60 < 1.0 ✓
  echoSatDrive: 0.8,    // warm saturation in the feedback loop
  echoInputGain: 0.65,  // attenuate hot polyphonic sum

  // ── Aspect sonification ──
  aspectConsonantBoost: 0.03, // velocity bump per consonant aspect
  aspectFocalBoost: 0.04,     // velocity bump per conjunction
  aspectBoostCap: 0.1,       // max total velocity lift per sign
  aspectTensionCents: 6,      // detune offset for tense-aspect pairs

  // ── Orbit mode ──
  orbitPeriodMin: 18, // seconds — fastest voice cycle (Moon)
  orbitPeriodMax: 96, // seconds — slowest voice cycle (Saturn)
  orbitDuty: 0.45,    // fraction of the cycle a voice holds before release
};

// ─── Shadow / Eclipse Mode — "Tape Meltdown" ────────────────
// The motor is failing. The heads are dirty. The oxide is flaking.
// Everything goes dark, smeary, and unstable. Like the tape is
// literally melting on the playhead. Genuinely eerie.
//
// Safety: echoSatDrive(0.8) * delayFeedback(0.92) = 0.736 < 1.0 ✓
export const SHADOW = {
  reverbWet: 0.9,        // submerged in reverb
  delayFeedback: 0.92,   // near-infinite degrading echoes
  delayWet: 0.9,         // almost all echo
  vibratoDepth: 0.95,    // extreme pitch instability — motor dying
  vibratoFreq: 0.03,     // subsonic — 33 second cycle, tidal pitch heave
  chebyWet: 1.0,         // full saturation (already there)
  panLfoFreq: 0.25,      // faster disorienting pan drift
  panLfoAmplitude: 0.7,  // wide stereo movement — sounds wander
  oscSpread: 140,        // maximum detuning — everything out of tune
  detuneRange: 20,       // extreme random detune — oxide degradation
  rampTime: 20,          // slow descent into meltdown — 20 seconds
};

// ─── Macro Definitions ───────────────────────────────────────
// 6 macro knobs reimagined for degraded tape. Each knob has a
// tape-specific meaning, not just generic FX control.

export const MACROS = {
  // ── Bloom → "Generation Loss" ──
  // At 0: crisp first-generation recording. Short attack, tight envelope.
  // At 0.5: standard cassette dub. Medium attack, some smear.
  // At 1: 10th-generation dub. Everything soft, blurred, compressed.
  // Sustain goes UP because tape compression squashes dynamics —
  // the more generations, the more everything is "always on."
  bloom: {
    label: "Bloom",
    default: 0.5,
    params: {
      attack:  ["splitLog", 0.05, 1.5, 6.0],     // crisp hit → slow fade-in → glacial emergence
      decay:   ["splitLog", 0.3, 2.0, 7.0],       // tight → smeared → endless
      sustain: ["splitLinear", 0.1, 0.55, 0.85],   // quiet → compressed → always-on (tape compression)
      release: ["splitLog", 0.2, 3.0, 9.0],        // short → lingering → infinite oxide memory
    },
  },

  // ── Aether → "Submersion Depth" ──
  // At 0: slightly muffled room. You can still hear the cassette deck.
  // At 0.5: underwater. Dark reverb, dampening chokes all highs.
  // At 1: completely submerged. Extreme dark reverb, like sound
  //        traveling through deep water. Pan drift adds disorientation.
  aether: {
    label: "Aether",
    default: 0.5,
    params: {
      reverbRoom:     ["splitLinear", 0.5, 0.92, 1.0],     // medium → vast → infinite murk
      reverbDamp:     ["splitLog", 2000, 500, 300],         // muffled → underwater → abyssal
      reverbMix:      ["splitLinear", 0.15, 0.55, 0.9],    // present → submerged → drowned
      dampSweepRate:  ["splitLog", 0.02, 0.06, 0.3],       // near-static → breathing → surging
      dampSweepDepth: ["splitLinear", 0.05, 0.25, 0.8],    // subtle → moderate → extreme modulation
      panDrift:       ["splitLog", 0.01, 0.04, 0.3],       // stable → disorienting → vertigo
      panWidth:       ["splitLinear", 0.05, 0.18, 0.8],    // narrow → shifting → full disorientation
      aetherShimmer:  ["dormantLinear", 0.0, 0.4],         // off until 0.5 — chorus adds warped doubling
    },
  },

  // ── Echo → "Tape Loop" ──
  // At 0: clean, no echo. Fresh tape.
  // At 0.5: smeary dark delay. Tape loop machine with generation loss.
  // At 1: long repeats, high feedback, very dark filter. Each repeat
  //        is another generation of dubbing — more degraded, more muffled,
  //        more ghostly. The echo IS the tape machine metaphor.
  echo: {
    label: "Echo",
    default: 0.5,
    params: {
      echoTime:       ["splitLog", 0.15, 1.0, 2.0],      // short slap → long smear → cavernous
      echoFeedback: (m) =>
        // Ramps to 0.75 at midpoint, then gently climbs toward 0.88.
        // High feedback = more repeats = more generation loss.
        // Safety: max 0.88 * echoSatDrive(0.8) = 0.704 < 1.0
        m <= 0.5
          ? (m / 0.5) * 0.75
          : 0.75 + 0.13 * ((m - 0.5) / 0.5),
      echoMix:        (m) => m,                            // linear identity
      echoFilterFreq: ["splitLog", 4000, 1500, 800],       // muffled → dark → nearly subsonic repeats
    },
  },

  // ── Drift → "Tape Speed Stability" ──
  // THE signature control for this preset. Default at 0.6 so the
  // tape character is immediately apparent.
  // At 0: stable deck. Minimal wow, almost clean playback.
  // At 0.3: worn-out Walkman. Noticeable pitch drift.
  // At 0.5: bad tape transport. Obvious warble.
  // At 0.8: the motor is struggling. Deep subsonic pitch heave.
  // At 1: the motor is dying. Extreme depth, very slow rate (0.04Hz
  //        = 25 second cycle). People should go "what IS happening?"
  drift: {
    label: "Drift",
    default: 0.6,
    params: {
      wobbleRate:  ["splitLog", 0.4, 0.15, 0.04],        // fast shimmer → tape wow → dying motor
      wobbleDepth: ["splitLinear", 0.05, 0.50, 1.0],     // hint → obvious warble → extreme pitch heave
      wobbleMix:   ["splitLinear", 0.15, 1.0, 1.0],      // mostly wet → full wet → full wet
    },
  },

  // ── Grit → "Tape Saturation" ──
  // At 0: clean recording level. Low Chebyshev, no extras.
  // At 0.3: warm tape saturation kicks in — the sweet spot where
  //         cassette recordings get that pleasing warmth.
  // At 0.5: Chebyshev order 4, full saturation. Classic tape sound.
  // At 0.7: distortion activates — overdriven input levels.
  // At 1: maximum overload + phaser. Nasty degraded crunch of tape
  //        pushed way past its limits. Oxide is screaming.
  grit: {
    label: "Grit",
    default: 0.5,
    params: {
      // Chebyshev wet ramps to full early — everything goes through
      // magnetic saturation on a cassette deck.
      gritDrive:   (m) => (m <= 0.3 ? m / 0.3 : 1.0),    // full saturation by 0.3
      chebyOrder:  (m) =>                                   // lower orders for warmth
        m < 0.2 ? 1 :
        m < 0.4 ? 3 :
        m < 0.6 ? 4 :
        m < 0.8 ? 5 : 7,
      satDrive:    ["splitLinear", 0.0, 0.5, 1.0],         // none → warm → overdriven
      // Distortion activates earlier (0.3) — tape saturation is always lurking
      satMix:      (m) => (m <= 0.3 ? 0.0 : Math.min(1.0, (m - 0.3) / 0.5)),
      phaserFreq:  (m) =>                                   // dormant + log ramp — dirty head interference
        m <= 0.5 ? 0.2 : 0.2 * Math.pow(6.0 / 0.2, (m - 0.5) / 0.5),
      phaserOctaves: (m) =>                                 // dormant + stepped
        m <= 0.5 ? 5 : Math.round(5 + 3 * ((m - 0.5) / 0.5)),
      phaserBase:  (m) =>                                   // dormant + log sweep down
        m <= 0.5 ? 350 : 350 * Math.pow(80 / 350, (m - 0.5) / 0.5),
      phaserQ:     () => 8,                                 // constant — resonant but not piercing
      phaserMix:   ["dormantLinear", 0.0, 0.7],             // off until 0.5, then ramps to dirty phaser
    },
  },

  // ── Tone → "Tape Age" ──
  // At 0: relatively fresh tape. Some brightness preserved.
  //        Not crystal clear — this is still cassette — but listenable.
  // At 0.5: standard cassette warmth. Classic dub character.
  //          Highs rolled off, mids warm, lows full.
  // At 1: ancient degraded tape. Extreme high rolloff (-24dB+).
  //        Everything is mud and warmth. Like a recording that's been
  //        sitting in a hot car for 30 years. Both ends are usable.
  tone: {
    label: "Tone",
    default: 0.5,
    params: {
      eqHigh: ["splitLinear", -6, -18, -26],   // muffled → dark → ancient mud
      eqMid:  ["splitLinear", 0, 5, 10],        // flat → warm → thick mid wall
      eqLow:  ["splitLinear", 0, 5, 10],        // flat → full → booming warmth
    },
  },
};

// ─── Listen Presets ──────────────────────────────────────────
export const LISTEN_PRESETS = {
  headphones: { low: -2, mid: 0, high: 1, label: "HP" },
  laptop:     { low: 6, mid: 2, high: 3, label: "Laptop" },
  phone:      { low: 4, mid: 3, high: 2, label: "Phone" },
  loudspeaker: { low: 3, mid: -2, high: 0, label: "Speaker" },
};

// ─── FX Chain Configs ────────────────────────────────────────
// All 6 chains preserved. ACTIVE_CHAIN set to "tape" — vibrato
// first, then saturation. Pitch drift creates time-varying harmonics.

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

  furnace: {
    order: [
      "ECHO", "chebyshev", "distortion", "eq3",
      "vibrato", "reverb", "chorus", "phaser",
      "monitorEQ", "softClip",
    ],
    bypass: {},
  },

  // ── Tape (ACTIVE) ──
  // Vibrato first — pitch drift feeds into Chebyshev waveshaper.
  // The continuously shifting pitch causes the polynomial to generate
  // different intermodulation products each moment. The wow IS the
  // harmonic engine.
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

export const ACTIVE_CHAIN = "tape";
