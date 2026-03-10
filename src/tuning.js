// ═══════════════════════════════════════════════════════════════
// TUNING — All sound-shaping numbers in one place.
// Open this file, change numbers, save, hot-reload hears the diff.
//
// Exports:
//   TUNING              FX parameter defaults
//   SHADOW              Eclipse mode chaos targets
//   KNOB_DEFS           Per-knob metadata (label, group, min, max, scale, unit)
//   KNOB_GROUPS         Group ordering for UI layout
//   LISTEN_PRESETS      Monitor EQ presets for different playback devices
//   CHAINS              FX chain orderings (declarative node arrays)
//   ACTIVE_CHAIN        Which chain config to wire on engine init
//   PLANETARY_CHARACTER Per-planet oscillator type + ADSR multipliers
//   SIGN_RULERS         Sign → ruling planet name
//
// ─── HOW CHAINS WORK ─────────────────────────────────────────
//
// order: Array of node names in signal flow order.
//   "ECHO" is a sentinel — wireChain expands it to:
//     prev → echoCrossfade.a (dry)
//     prev → echoInputGain → echoDelay → echoCrossfade.b (wet)
//   All other names are .connect()'d in sequence.
//
// bypass: Nodes that start disconnected (wet=0) for CPU savings.
//   { nodeName: { after: "prevNode", before: "nextNode" } }
//   wireChain inserts them dynamically when wet > 0.
//   Nodes listed in bypass must NOT appear in order.
//
// Available node names (must match createEngine variable names):
//   chebyshev    — polynomial waveshaper (harmonic generation)
//   distortion   — waveshaping saturator (stacks with chebyshev)
//   eq3          — 3-band "tape" EQ
//   vibrato      — slow LFO pitch mod (VHS wow/flutter)
//   ECHO         — crossfade delay loop (sentinel, not a real node)
//   reverb       — Freeverb (Schroeder comb-filter resonances)
//   chorus       — stereo chorus shimmer
//   phaser       — sweeping allpass comb filters
//   monitorEQ    — output EQ for listening environment
//   softClip     — tanh limiter (always last before destination)
//
// ═══════════════════════════════════════════════════════════════

// ─── FX Parameter Defaults ───────────────────────────────────
// Default FX parameter values. These initialize the audio engine.
// KNOB_DEFS.default references these — single source of truth.
export const TUNING = {
  sampleRate: 44100,

  // ── Envelope (Bloom macro) ──
  // ADSR shape for all PolySynth voices.
  // With 0.9s stagger, 8 voices enter over ~7s. Each voice
  // blooms individually (2.8s attack) before the next begins.
  attack: 2.8, // seconds — slow bloom, each voice breathes in
  decay: 4.0, // seconds — long settle into sustain
  sustain: 0.5, // 0–1 level — voices hover, stay present
  release: 7.0, // seconds — long tail dissolves into reverb

  // ── Chebyshev saturation (Grit macro) ──
  // Polynomial waveshaper on the summed polyphonic signal.
  // Order 2 = even harmonics (octave doubling = warmth).
  // Order 3 creates harsh odd-harmonic intermodulation on
  // dense polyphonic material — avoided for ambient default.
  chebyOrder: 2, // harmonic order — even harmonics only
  chebyWet: 0.25, // 0–1 — gentle warmth, not saturation

  // ── Tape EQ (Tone macro) ──
  // 3-band EQ simulating tape head frequency response.
  // Shapes the saturated signal before time-domain effects.
  eqHigh: -5, // dB — silk rolloff, tame cheby + comb brightness
  eqMid: 1, // dB — slight presence, voices speak without pushing
  eqLow: 2, // dB — reduced, dense voicing already fills low end
  eqHighFreq: 4500, // Hz — high band crossover frequency

  // ── VHS wow / vibrato (Drift macro) ──
  // Slow LFO pitch modulation on the full mix.
  // Below conscious perception — felt as "alive", not "wobble".
  vibratoFreq: 0.08, // Hz — ~12.5s cycle, imperceptible
  vibratoDepth: 0.15, // 0–1 — subtle pitch wandering
  vibratoWet: 0.3, // 0–1 — ghost-haunts the sound, never dominates

  // ── Echo / delay cascade (Echo macro) ──
  // Hand-wired delay with feedback path: delay → filter → tanh sat → gain → delay.
  // Each repeat gets progressively darker and warmer (tape delay character).
  delayTime: 0.85, // seconds — spacious, echoes don't crowd
  delayFeedback: 0.35, // 0–1 — 2-3 clean repeats, less buildup
  delayWet: 0.22, // 0–1 — echo adds depth without competing

  // ── Algorithmic reverb (Aether macro) ──
  // Freeverb — parallel comb filters + series allpass.
  // Lower dampening = darker tail, warm cloud not metallic hall.
  reverbRoom: 0.88, // 0–1 — large hall, slightly more defined
  reverbDamp: 1200, // Hz — darker tail, less comb-filter shimmer
  reverbWet: 0.45, // 0–1 — reverb IS the space for intimate ambient

  // ── Damp sweep (Aether macro) ──
  // Sinusoidal LFO modulating reverb dampening frequency.
  // Sweeps comb filter cutoffs for evolving resonance morphing.
  dampSweepRate: 0.04, // Hz — ~25s cycle, imperceptible
  dampSweepDepth: 0.15, // 0–1 — reverb character breathes gently

  // ── Per-voice panning LFOs (Aether macro) ──
  // One LFO per pan group (A/B/C/D), drifts stereo position.
  panLfoFreq: 0.03, // Hz — ~33s cycle, glacial drift
  panLfoAmplitude: 0.28, // 0–1 — wider field, voices inhabit the space

  // ── Monitor EQ crossover frequencies ──
  // Fixed crossover points for the output EQ (listen presets).
  monitorLowFreq: 400, // Hz — low/mid crossover
  monitorHighFreq: 2500, // Hz — mid/high crossover

  // ── Oscillator internals ──
  harmonicity: 1, // AM/FM modulator:carrier ratio — integer = harmonic, non-integer = bell/metallic
  modulationIndex: 2, // FM modulation depth — low = subtle, high = aggressive spectrum
  oscSpread: 8, // cents — fat oscillator detuning width (unison thickness)

  // ── Stagger / retrigger ──
  stagger: 0.06, // seconds — delay between voice entries in natal chord (short ripple)
  retriggerGap: 80, // ms — minimum gap before a voice can retrigger

  // ── Phaser (Grit macro, dormant below 0.5) ──
  // Sweeping allpass filters create moving comb-filter interference.
  phaserFreq: 0.3, // Hz — sweep rate
  phaserOctaves: 3, // octave range of sweep
  phaserBase: 350, // Hz — base frequency of sweep
  phaserQ: 8, // resonance / feedback amount
  phaserWet: 0.0, // 0–1 — starts bypassed

  // ── Echo feedback loop filter ──
  // Lowpass in the feedback path — darkens each repeat.
  echoFilterFreq: 2800, // Hz — darker repeats, more tape-like

  // ── Distortion (Grit macro, dormant below 0.5) ──
  // Waveshaping saturator that stacks with Chebyshev.
  distortion: 0.35, // 0–1 — drive amount
  distortionWet: 0.0, // 0–1 — starts bypassed

  // ── Chorus (on by default for stereo width) ──
  chorusFreq: 0.3, // Hz — slow shimmer, not audible as modulation
  chorusDelay: 18, // ms — wider spread for stereo width
  chorusDepth: 0.35, // 0–1 — gentle detuning
  chorusWet: 0.18, // 0–1 — subtle width + micro-detuning

  // ── Echo feedback safety ──
  // The echo loop has: delay → filter → tanh(v * drive) → gain(feedback) → delay
  // Loop gain = feedback * drive. MUST be < 1 or small signals amplify forever.
  // At defaults: 0.35 * 0.6 = 0.21. Safe.
  echoSatDrive: 0.6, // tanh drive factor — keep <= 1.0
  echoInputGain: 0.7, // pre-delay attenuator — safety margin for hot polyphonic sum

  // ── Highpass filter ──
  highpassFreq: 35, // Hz — cleans sub rumble from dense voicing
  highpassRolloff: -12, // dB/octave — gentle slope

  // ── Microtonal system (Lionel's chromatic-calendar) ──
  centsPerDegree: 100 / 30,  // 3.33 — Lionel's system: 100 cents per 30° sign
};

// ─── Oscillator Types ────────────────────────────────────────
// Cycled by Breathe. Fat variants support count/spread (Eclipse ramp).
// AM/FM variants create amplitude/frequency modulation between carrier
// and modulator — different harmonic character.
export const OSC_TYPES = [
  "fatsine",       // pure + detuning — warm, intimate, minimal intermod
  "amsine",        // bell-like AM — ethereal, clean
  "fattriangle",   // warm + detuning — slightly richer than sine
  "amtriangle",    // warm AM character
  "fmtriangle",    // warm FM undertones — more complex
  "fatsawtooth",   // rich harmonics — more aggressive
  "fmsine",        // metallic DX7-style FM
  "fatsquare",     // hollow + spread — most aggressive
];

// ─── Shadow / Eclipse Mode Chaos Targets ─────────────────────
// When Eclipse activates, FX params ramp toward these values over
// rampTime seconds. When Eclipse deactivates, macro-derived values
// are restored. These are "how far into chaos" each param goes.
export const SHADOW = {
  reverbWet: 0.85, // wetter reverb (more contrast from 0.45 base)
  delayFeedback: 0.87, // near-infinite echoes (still < 1.0!)
  delayWet: 0.86, // almost all wet signal
  vibratoDepth: 0.72, // heavy pitch drift (dramatic from 0.15 base)
  vibratoFreq: 0.06, // very slow wobble
  chebyWet: 0.85, // heavy saturation (not full — less harsh on dense voicing)
  panLfoFreq: 0.18, // faster pan drift
  panLfoAmplitude: 0.55, // wide stereo movement
  oscSpread: 120, // max oscillator detuning
  detuneRange: 15, // random detune variance (cents)
  rampTime: 16, // seconds to reach chaos targets
};


// ─── Knob Definitions ────────────────────────────────────────
// 39 direct-control knobs, one per audio parameter.
// Each knob maps directly to a single Tone.js param — no macros.
// scale: "linear" | "log" | "step"
// unit: "s" | "ms" | "dB" | "Hz" | "%" | ""
// default: references TUNING.x — single source of truth.
export const KNOB_DEFS = {
  // ── Oscillator ──
  harmonicity:     { label: "HARM", group: "oscillator",  min: 0.25,  max: 8,     default: TUNING.harmonicity,     scale: "log",    unit: "" },
  modulationIndex: { label: "MOD",  group: "oscillator",  min: 0.1,   max: 20,    default: TUNING.modulationIndex, scale: "log",    unit: "" },
  oscSpread:       { label: "SPRD", group: "oscillator",  min: 0,     max: 200,   default: TUNING.oscSpread,       scale: "linear", unit: "" },
  stagger:         { label: "STGR", group: "oscillator",  min: 0,     max: 3,     default: TUNING.stagger,         scale: "linear", unit: "s" },
  // ── Envelope ──
  attack:          { label: "ATK",  group: "envelope",   min: 0.01,  max: 10,    default: TUNING.attack,          scale: "log",    unit: "s" },
  decay:           { label: "DEC",  group: "envelope",   min: 0.1,   max: 10,    default: TUNING.decay,           scale: "log",    unit: "s" },
  sustain:         { label: "SUS",  group: "envelope",   min: 0,     max: 1,     default: TUNING.sustain,         scale: "linear", unit: "%" },
  release:         { label: "REL",  group: "envelope",   min: 0.1,   max: 14,    default: TUNING.release,         scale: "log",    unit: "s" },
  // ── EQ ──
  eqLow:           { label: "LOW",  group: "eq",         min: -20,   max: 20,    default: TUNING.eqLow,           scale: "linear", unit: "dB" },
  eqMid:           { label: "MID",  group: "eq",         min: -20,   max: 20,    default: TUNING.eqMid,           scale: "linear", unit: "dB" },
  eqHigh:          { label: "HIGH", group: "eq",         min: -20,   max: 20,    default: TUNING.eqHigh,          scale: "linear", unit: "dB" },
  eqHighFreq:      { label: "HI x", group: "eq",         min: 1000,  max: 8000,  default: TUNING.eqHighFreq,      scale: "log",    unit: "Hz" },
  // ── Chebyshev ──
  chebyOrder:      { label: "ORD",  group: "chebyshev",  min: 1,     max: 11,    default: TUNING.chebyOrder,      scale: "step",   unit: "" },
  chebyWet:        { label: "MIX",  group: "chebyshev",  min: 0,     max: 1,     default: TUNING.chebyWet,        scale: "linear", unit: "%" },
  // ── Distortion ──
  distortion:      { label: "DRIV", group: "distortion", min: 0,     max: 1,     default: TUNING.distortion,      scale: "linear", unit: "%" },
  distortionWet:   { label: "MIX",  group: "distortion", min: 0,     max: 1,     default: TUNING.distortionWet,   scale: "linear", unit: "%" },
  // ── Vibrato ──
  vibratoFreq:     { label: "RATE", group: "vibrato",    min: 0.01,  max: 5,     default: TUNING.vibratoFreq,     scale: "log",    unit: "Hz" },
  vibratoDepth:    { label: "DPTH", group: "vibrato",    min: 0,     max: 1,     default: TUNING.vibratoDepth,    scale: "linear", unit: "%" },
  vibratoWet:      { label: "MIX",  group: "vibrato",    min: 0,     max: 1,     default: TUNING.vibratoWet,      scale: "linear", unit: "%" },
  // ── Echo ──
  delayTime:       { label: "TIME", group: "echo",       min: 0.05,  max: 2,     default: TUNING.delayTime,       scale: "log",    unit: "s" },
  delayFeedback:   { label: "FDBK", group: "echo",       min: 0,     max: 0.95,  default: TUNING.delayFeedback,   scale: "linear", unit: "%" },
  delayWet:        { label: "MIX",  group: "echo",       min: 0,     max: 1,     default: TUNING.delayWet,        scale: "linear", unit: "%" },
  echoFilterFreq:  { label: "FILT", group: "echo",       min: 500,   max: 8000,  default: TUNING.echoFilterFreq,  scale: "log",    unit: "Hz" },
  // ── Reverb ──
  reverbRoom:      { label: "ROOM", group: "reverb",     min: 0,     max: 1,     default: TUNING.reverbRoom,      scale: "linear", unit: "%" },
  reverbDamp:      { label: "DAMP", group: "reverb",     min: 200,   max: 8000,  default: TUNING.reverbDamp,      scale: "log",    unit: "Hz" },
  reverbWet:       { label: "MIX",  group: "reverb",     min: 0,     max: 1,     default: TUNING.reverbWet,       scale: "linear", unit: "%" },
  dampSweepRate:   { label: "MOD",  group: "reverb",     min: 0.01,  max: 2,     default: TUNING.dampSweepRate,   scale: "log",    unit: "Hz" },
  dampSweepDepth:  { label: "AMT",  group: "reverb",     min: 0,     max: 1,     default: TUNING.dampSweepDepth,  scale: "linear", unit: "%" },
  // ── Chorus ──
  chorusFreq:      { label: "RATE", group: "chorus",     min: 0.1,   max: 10,    default: TUNING.chorusFreq,      scale: "log",    unit: "Hz" },
  chorusDelay:     { label: "DLY",  group: "chorus",     min: 1,     max: 30,    default: TUNING.chorusDelay,     scale: "linear", unit: "ms" },
  chorusDepth:     { label: "DPTH", group: "chorus",     min: 0,     max: 1,     default: TUNING.chorusDepth,     scale: "linear", unit: "%" },
  chorusWet:       { label: "MIX",  group: "chorus",     min: 0,     max: 1,     default: TUNING.chorusWet,       scale: "linear", unit: "%" },
  // ── Phaser ──
  phaserFreq:      { label: "RATE", group: "phaser",     min: 0.05,  max: 10,    default: TUNING.phaserFreq,      scale: "log",    unit: "Hz" },
  phaserOctaves:   { label: "OCT",  group: "phaser",     min: 1,     max: 8,     default: TUNING.phaserOctaves,   scale: "step",   unit: "" },
  phaserBase:      { label: "BASE", group: "phaser",     min: 50,    max: 2000,  default: TUNING.phaserBase,      scale: "log",    unit: "Hz" },
  phaserQ:         { label: "Q",    group: "phaser",     min: 0.5,   max: 20,    default: TUNING.phaserQ,         scale: "log",    unit: "" },
  phaserWet:       { label: "MIX",  group: "phaser",     min: 0,     max: 1,     default: TUNING.phaserWet,       scale: "linear", unit: "%" },
  // ── Pan ──
  panLfoFreq:      { label: "RATE", group: "pan",        min: 0.01,  max: 2,     default: TUNING.panLfoFreq,      scale: "log",    unit: "Hz" },
  panLfoAmplitude: { label: "WDTH", group: "pan",        min: 0,     max: 1,     default: TUNING.panLfoAmplitude, scale: "linear", unit: "%" },
};

// ─── Knob Group Ordering ─────────────────────────────────────
// Zodiac chain signal flow: envelope → vibrato → ECHO → eq3 → cheby → [dist] → reverb → chorus → [phaser]
// Pan is per-voice pre-chain, pairs naturally with vibrato.
// Groups sharing a row number render side-by-side.
export const KNOB_GROUPS = [
  { key: "oscillator", label: "Oscillator" },
  { key: "envelope",   label: "Envelope" },
  { key: "vibrato",    label: "Vibrato",    row: 1 },
  { key: "pan",        label: "Pan",        row: 1 },
  { key: "echo",       label: "Echo" },
  { key: "eq",         label: "EQ" },
  { key: "chebyshev",  label: "Chebyshev",  row: 2 },
  { key: "distortion", label: "Distortion", row: 2 },
  { key: "reverb",     label: "Reverb" },
  { key: "chorus",     label: "Chorus" },
  { key: "phaser",     label: "Phaser" },
];

// ─── Listen Presets ──────────────────────────────────────────
// Monitor EQ compensation for different playback devices.
// Values are dB gain for low/mid/high bands.
// Crossover frequencies set in TUNING (monitorLowFreq, monitorHighFreq).
export const LISTEN_PRESETS = {
  headphones: { low: -2, mid: 0, high: 1, label: "🎧 HP" },
  laptop: { low: 6, mid: 2, high: 3, label: "💻 Laptop" },
  phone: { low: 4, mid: 3, high: 2, label: "📱 Phone" },
  loudspeaker: { low: 3, mid: -2, high: 0, label: "🔊 Big System" },
};

// ─── FX Chain Configs ────────────────────────────────────────
// Each config defines a different FX ordering, which dramatically
// changes sonic character. All configs use the same FX nodes —
// only the wiring differs.
//
// order: node names in signal flow. sumBus connects to first,
//        last connects to destination. "ECHO" expands to crossfade.
//
// bypass: nodes starting at wet=0, dynamically inserted when
//         their mix knob goes above 0. Saves CPU when inactive.
//         { nodeName: { after: "prevNode", before: "nextNode" } }
//         Nodes in bypass must NOT appear in order.
//
// To switch chains: change ACTIVE_CHAIN below, save, refresh.

export const CHAINS = {
  // ── Cathedral (default) ──
  // Saturation first — Chebyshev harmonics color everything downstream.
  // Distortion + phaser start bypassed (wet=0), activate via Grit macro.
  // Signal: sum → cheby → [dist] → eq → vibrato → ECHO → reverb → [chorus] → [phaser] → monEQ → clip
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

  // ── Void ──
  // Reverb before delay — delay repeats the already-reverbed signal,
  // creating infinite receding echoes. More diffuse, less defined.
  // Signal: sum → cheby → dist → eq → vibrato → reverb → phaser → ECHO → chorus → monEQ → clip
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

  // ── Furnace ──
  // Delay before saturation — clean echoes get waveshaped together
  // with the dry signal. Progressively dirtier repeats.
  // Signal: sum → ECHO → cheby → dist → eq → vibrato → reverb → chorus → phaser → monEQ → clip
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

  // ── Tape ──
  // Vibrato (wow/flutter) applied first — pitch drift feeds into
  // saturation, creating time-varying harmonic content.
  // Signal: sum → vibrato → cheby → dist → eq → ECHO → reverb → chorus → phaser → monEQ → clip
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

  // ── Evolve ──
  // Space effects BEFORE saturation — reverb/delay tails feed into
  // Chebyshev, generating new harmonics as they decay. Spectral
  // content evolves over time. Maximum harmonic density.
  // Signal: sum → vibrato → ECHO → reverb → phaser → cheby → dist → eq → chorus → monEQ → clip
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

  // ── Glass ──
  // No saturation — Chebyshev + Distortion skipped entirely.
  // Clean voices through EQ, vibrato, delay, reverb. Fragile, pure.
  // Signal: sum → eq → vibrato → ECHO → reverb → chorus → phaser → monEQ → clip
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

  // ── Zodiac ──
  // The "ultimate" chain — tape + furnace + cathedral fused.
  // Vibrato first (time-varying harmonics), echo before saturation
  // (harmonic accumulation per repeat), EQ before saturation (Tone
  // macro becomes harmonic color selector), clean reverb after
  // saturation (shimmer without mud), post-reverb modulation.
  // Signal: sum → vibrato → ECHO → eq → cheby → [dist] → reverb → chorus → [phaser] → monEQ → clip
  zodiac: {
    order: [
      "vibrato",
      "ECHO",
      "eq3",
      "chebyshev",
      "reverb",
      "chorus",
      "monitorEQ",
      "softClip",
    ],
    bypass: {
      distortion: { after: "chebyshev", before: "reverb" },
      phaser: { after: "chorus", before: "monitorEQ" },
    },
  },

  // ── Custom ──
  // Blank slate — all available nodes listed, all commented out.
  // Uncomment and reorder to build your own chain from scratch.
  // Rules:
  //   - "ECHO" must appear exactly once (crossfade split point)
  //   - "softClip" should be last (final limiter)
  //   - "monitorEQ" should be second-to-last (listen compensation)
  //   - Nodes in bypass{} must NOT be in order[]
  //   - Any node can be omitted entirely (it just won't be wired)
  custom: {
    order: [
      // --- modulation ---
      "chorus", // stereo chorus shimmer
      "phaser", // sweeping allpass comb filters

      // --- tone shaping ---
      "eq3", // 3-band EQ — spectral tilt
      "vibrato", // LFO pitch mod — wow/flutter

      // --- saturation stage ---
      "chebyshev", // polynomial waveshaper — harmonic generation
      "distortion", // additional waveshaping saturator

      // --- time / space ---
      "ECHO", // delay with filtered feedback (REQUIRED — exactly once)

      // --- output ---
      "monitorEQ", // listen EQ compensation
      "softClip", // tanh limiter (keep last)
      "reverb", // Freeverb — comb-filter resonances
    ],
    bypass: {
      // Uncomment to make a node bypassable (starts disconnected, inserts when wet>0):
      // distortion: { after: "chebyshev", before: "eq3" },
      // phaser: { after: "chorus", before: "monitorEQ" },
    },
  },
};

// Which chain to wire on engine init.
// Change this string, save, refresh — instant new character.
export const ACTIVE_CHAIN = "zodiac";

// ─── Zodiac Note Mapping (Lionel's chromatic-calendar) ───────
// Each sign maps to its chromatic pitch. One sign = 30° = 100 cents.
// Aries = Spring Equinox = D (middle of chromatic scale).
export const ZODIAC_NOTES = {
  aquarius:    "C",
  pisces:      "Db",
  aries:       "D",
  taurus:      "Eb",
  gemini:      "E",
  cancer:      "F",
  leo:         "Gb",
  virgo:       "G",
  libra:       "Ab",
  scorpio:     "A",
  sagittarius: "Bb",
  capricorn:   "B",
};

// ─── Fletcher-Munson Loudness Compensation ─────────────────
// Per-octave volume offset (dB) applied to synth gain.
// Flattens perceived loudness across the 4-octave range at moderate
// listening levels (~70 phon). Octave 4 is the reference (0 dB) —
// human hearing is most sensitive in the 1–4 kHz range.
export const OCTAVE_GAIN = { 2: 5, 3: 2, 4: 0, 5: -2 };

// ─── Cousto Planetary Tuning ───────────────────────────────
// Hans Cousto's "Cosmic Octave" — audible frequencies derived from
// planetary orbital periods, octave-transposed into hearing range.
// Each sign is detuned by its traditional ruling planet's deviation
// from 12-TET. cents = 1200 × log2(f_cousto / f_nearest_ET).
//
// Signs sharing a ruler share the same offset — pairs that are
// "in tune" with each other through planetary resonance.
export const COUSTO_DETUNE = {
  Aquarius:     12,  // Saturn    — 147.85 Hz vs D3 146.83
  Pisces:      -13,  // Jupiter   — 183.58 Hz vs F#3 185.00
  Aries:       -25,  // Mars      — 144.72 Hz vs D3 146.83
  Taurus:       10,  // Venus     — 221.23 Hz vs A3 220.00
  Gemini:       33,  // Mercury   — 141.27 Hz vs C#3 138.59
  Cancer:       23,  // Moon      — 210.42 Hz vs G#3 207.65
  Leo:          38,  // Sun       — 126.22 Hz vs B2 123.47
  Virgo:        33,  // Mercury   — (shared ruler with Gemini)
  Libra:        10,  // Venus     — (shared ruler with Taurus)
  Scorpio:     -25,  // Mars      — (shared ruler with Aries)
  Sagittarius: -13,  // Jupiter   — (shared ruler with Pisces)
  Capricorn:    12,  // Saturn    — (shared ruler with Aquarius)
};

// ─── Sign Rulers ─────────────────────────────────────────────
// Sign → traditional ruling planet. Makes the implicit Cousto ruler
// comments machine-readable. Shared-ruler pairs inherit identical
// planetary character automatically.
export const SIGN_RULERS = {
  Aries:       "Mars",
  Taurus:      "Venus",
  Gemini:      "Mercury",
  Cancer:      "Moon",
  Leo:         "Sun",
  Virgo:       "Mercury",
  Libra:       "Venus",
  Scorpio:     "Mars",
  Sagittarius: "Jupiter",
  Capricorn:   "Saturn",
  Aquarius:    "Saturn",
  Pisces:      "Jupiter",
};

// ─── Planetary Character ─────────────────────────────────────
// Keyed by ruler planet. Each planet defines an oscillator type and
// ADSR envelope multipliers. Orbital speed ↔ envelope speed: inner
// planets (Mars, Mercury) have fast envelopes, outer (Jupiter, Saturn)
// are slow and expansive.
//
// Result: 5 fat-type signs, 3 AM signs, 4 FM signs.
// Fat types use oscCount/oscSpread; AM/FM oscillators don't.
// ─── Chart Comparison Colors ──────────────────────────────────
// Chart A = amber/gold, Chart B = teal/cyan.
// Both contrast well against #0c0c0c background.
export const CHART_A_COLOR = "#d4a03c";
export const CHART_B_COLOR = "#3ca8d4";

// ─── Celestial Body Glyphs ───────────────────────────────────
// Unicode symbols for planetary bodies displayed on keyboard indicators.
export const BODY_GLYPHS = {
  Sun: "\u2609",       // ☉
  Moon: "\u263D",      // ☽
  Mercury: "\u263F",   // ☿
  Venus: "\u2640",     // ♀
  Mars: "\u2642",      // ♂
  Jupiter: "\u2643",   // ♃
  Saturn: "\u2644",    // ♄
  Uranus: "\u2645",    // ♅
  Neptune: "\u2646",   // ♆
  Pluto: "\u2647",     // ♇
  Chiron: "\u26B7",    // ⚷
  Ascendant: "AC",
};

export const PLANETARY_CHARACTER = {
  Sun:     { oscType: "fatsine",      attackMul: 0.8, decayMul: 0.9, sustainMul: 1.1, releaseMul: 0.9 },
  Moon:    { oscType: "amsine",       attackMul: 1.2, decayMul: 1.1, sustainMul: 1.0, releaseMul: 1.3 },
  Mars:    { oscType: "fatsawtooth",  attackMul: 0.6, decayMul: 0.7, sustainMul: 0.9, releaseMul: 0.8 },
  Venus:   { oscType: "fattriangle",  attackMul: 1.3, decayMul: 1.1, sustainMul: 1.1, releaseMul: 1.1 },
  Mercury: { oscType: "fmsine",       attackMul: 0.7, decayMul: 0.8, sustainMul: 0.9, releaseMul: 0.8 },
  Jupiter: { oscType: "amtriangle",   attackMul: 1.4, decayMul: 1.2, sustainMul: 1.0, releaseMul: 1.4 },
  Saturn:  { oscType: "fmtriangle",   attackMul: 1.5, decayMul: 1.3, sustainMul: 1.0, releaseMul: 1.5 },
};
