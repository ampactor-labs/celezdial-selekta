# Celezdial Selekta

Polyphonic ambient synthesizer mapped to the zodiac. 12 voices toggle on a chromatic keyboard (C to B), shaped by a wall of parameter knobs across 8 FX chains you can swap live from the controls veil. Birth charts select the voices, aspects color them, and orbit mode breathes them on planetary periods. Built with React and Tone.js.

## Signal Chain (Zodiac, the active default)

```
12 × PolySynth (per-sign oscType via planetary character + Cousto detune)
  → Panners (4 LFO groups, slow stereo drift)
  → sumBus ─────────────────── polyphonic sum before saturation
      → Highpass (35Hz, -12dB/oct)
      → Vibrato (VHS wow, 0.08Hz)
      → Echo (delay → LPF → tanh sat → feedback, hand-wired)
      → EQ3 (tape shelving)
      → Chebyshev (order 2, even harmonics on summed voices)
      → [Distortion: bypassed]
      → Freeverb (room 0.88, swept damping)
      → Chorus (on by default, stereo width)
      → [Phaser: bypassed]
      → Monitor EQ (listening environment comp)
      → Soft clip (tanh limiter)
      → out
```

Summing before the Chebyshev is the whole point: polynomial waveshaping on a polyphonic mix generates sum and difference tones between partials. Order 2 gives even harmonics only, which reads as octave doubling and warmth. Order 3 creates harsh odd-harmonic intermodulation on dense material, so it's bypassed for the ambient default.

## Voicing Strategy

Dim7-derived octave partitioning keeps any two notes in the same octave from sitting a semitone apart. The chromatic scale's 12 notes are distributed across three octaves in diminished-seventh groups:

| Octave | Notes | Interval pattern |
|--------|-------|-----------------|
| 3 | C, Eb, Gb, A | dim7 (minor thirds) |
| 4 | D, F, Ab, B | dim7 |
| 5 | Db, E, G, Bb | dim7 |

Within any single octave, the closest interval is a minor third (3 semitones), so there are no semitone or whole-tone clashes when adjacent signs sound together. The three dim7 groups interlock to cover all 12 chromatic pitches.

Velocity follows the astrological hierarchy: luminaries (Sun and Moon signs) are loudest, personal-planet signs next, social planets quietest.

| Tier | Ruler | Signs | Velocity |
|------|-------|-------|----------|
| Luminary | Sun | Leo | 0.65 |
| Luminary | Moon | Cancer | 0.60 |
| Personal | Mars | Aries, Scorpio | 0.52, 0.48 |
| Personal | Venus | Taurus, Libra | 0.50, 0.47 |
| Personal | Mercury | Gemini, Virgo | 0.48, 0.45 |
| Social | Jupiter | Sagittarius, Pisces | 0.40, 0.38 |
| Social | Saturn | Capricorn, Aquarius | 0.35, 0.33 |

## Voices

| Sign | Note | Oct | Vel | Cousto ¢ | Osc Type | Pan | Count | Spread ¢ |
|------|------|-----|-----|----------|----------|-----|-------|----------|
| Aquarius ♒︎ | C | 3 | 0.33 | +6 | fmtriangle | A | — | — |
| Pisces ♓︎ | Db | 5 | 0.38 | −6.5 | amtriangle | D | — | — |
| Aries ♈︎ | D | 4 | 0.52 | −12.5 | fatsawtooth | B | 2 | 8 |
| Taurus ♉︎ | Eb | 3 | 0.50 | +5 | fattriangle | C | 2 | 5 |
| Gemini ♊︎ | E | 5 | 0.48 | +16.5 | fmsine | B | — | — |
| Cancer ♋︎ | F | 4 | 0.60 | +11.5 | amsine | D | — | — |
| Leo ♌︎ | Gb | 3 | 0.65 | +19 | fatsine | B | 2 | 5 |
| Virgo ♍︎ | G | 5 | 0.45 | +16.5 | fmsine | A | — | — |
| Libra ♎︎ | Ab | 4 | 0.47 | +5 | fattriangle | C | 2 | 8 |
| Scorpio ♏︎ | A | 3 | 0.48 | −12.5 | fatsawtooth | C | 2 | 5 |
| Sagittarius ♐︎ | Bb | 5 | 0.40 | −6.5 | amtriangle | D | — | — |
| Capricorn ♑︎ | B | 4 | 0.35 | +6 | fmtriangle | A | — | — |

Four pan groups (A through D), each driven by an independent LFO at 0.03Hz. Voices in the same group drift together. Count and Spread apply only to the fat oscillator types (5 signs); the AM and FM types (7 signs) don't use detuned oscillator stacks. Fletcher-Munson compensation flattens perceived loudness across the range (+5dB oct 3, +2dB oct 3, 0dB oct 4, −2dB oct 5). Adaptive voicing adds a `5 × log10(12 / active)` dB boost for sparse voicings (1 voice = +5.4dB, 3 = +3dB, 12 = 0dB).

## Cousto Planetary Tuning

Hans Cousto's *Cosmic Octave* (1978) takes planetary orbital periods and octave-transposes them into audible frequencies. Each sign is microtonally detuned by its traditional ruling planet's deviation from 12-TET.

It's applied at 50% strength (the `detuneCents` column in Voices is half the raw Cousto offset). That's enough color to feel the planetary character without quarter-tone shock on dense voicings.

Signs that share a ruler share the same offset, so they end up "in tune" with each other through planetary resonance:

| Ruler | Raw ¢ | Applied ¢ | Signs |
|-------|-------|-----------|-------|
| Sun | +38 | +19 | Leo |
| Moon | +23 | +11.5 | Cancer |
| Mercury | +33 | +16.5 | Gemini, Virgo |
| Venus | +10 | +5 | Taurus, Libra |
| Mars | −25 | −12.5 | Aries, Scorpio |
| Jupiter | −13 | −6.5 | Pisces, Sagittarius |
| Saturn | +12 | +6 | Aquarius, Capricorn |

Two independent systems coexist: Lionel's chromatic-calendar determines the note class (C through B), and Cousto determines the cents offset within that note. In natal mode, a degree-based detune (`(degree - 15) × 3.33¢`) replaces Cousto.

## Planetary Character

Each sign inherits its ruling planet's sonic personality: an oscillator type and a set of ADSR envelope multipliers. Orbital speed maps to envelope speed. Inner planets (Mars, Mercury) have fast, driven envelopes; outer planets (Jupiter, Saturn) are slow and expansive.

| Planet | Osc Type | ATK | DEC | SUS | REL | Character |
|--------|----------|-----|-----|-----|-----|-----------|
| Sun | fatsine | ×0.8 | ×0.9 | ×1.1 | ×0.9 | Warm center, assertive |
| Moon | amsine | ×1.2 | ×1.1 | ×1.0 | ×1.3 | Tidal AM, emotional sustain |
| Mars | fatsawtooth | ×0.6 | ×0.7 | ×0.9 | ×0.8 | Aggressive harmonics, driven |
| Venus | fattriangle | ×1.3 | ×1.1 | ×1.1 | ×1.1 | Warm rounded, graceful |
| Mercury | fmsine | ×0.7 | ×0.8 | ×0.9 | ×0.8 | Metallic FM precision |
| Jupiter | amtriangle | ×1.4 | ×1.2 | ×1.0 | ×1.4 | Expansive AM warmth |
| Saturn | fmtriangle | ×1.5 | ×1.3 | ×1.0 | ×1.5 | Structured FM complexity |

Envelope knobs set a base value; each sign multiplies by its planet's factor. With the default 2.8s attack, Mars signs attack in about 1.7s and Saturn in about 4.2s. The result is a staggered bloom where the inner-planet voices arrive first.

Three oscillator families:
- **Fat** (5 signs: Leo, Aries, Scorpio, Taurus, Libra): detuned oscillator stacks that support count/spread and the Eclipse spread ramp
- **AM** (3 signs: Cancer, Sagittarius, Pisces): amplitude modulation, bell-like to warm
- **FM** (4 signs: Gemini, Virgo, Capricorn, Aquarius): frequency modulation, metallic to structured

Signs that share a ruler share identical character. Aries and Scorpio both get Mars's aggressive fatsawtooth; Taurus and Libra both get Venus's graceful fattriangle.

## Astrological System

Traditional (pre-modern) planetary rulership: 7 visible planets, no co-rulers (Uranus, Neptune, Pluto). This matches Cousto's original system and makes for cleaner shared-ruler pairs.

| Sign | Ruler | Tier |
|------|-------|------|
| Leo | Sun | Luminary |
| Cancer | Moon | Luminary |
| Aries | Mars | Personal |
| Scorpio | Mars | Personal |
| Taurus | Venus | Personal |
| Libra | Venus | Personal |
| Gemini | Mercury | Personal |
| Virgo | Mercury | Personal |
| Sagittarius | Jupiter | Social |
| Pisces | Jupiter | Social |
| Capricorn | Saturn | Social |
| Aquarius | Saturn | Social |

## FX Chains

Eight pre-wired chains: the same nodes in a different order, for a different character.

| Chain | Order (abbreviated) | Character |
|-------|---------------------|-----------|
| **Zodiac** | vib → echo → eq → cheby → rev → cho | Balanced. Pretty on load, cosmic at extremes |
| Cathedral | cheby → eq → vib → echo → rev → cho | Saturation first, warm and thick |
| Void | cheby → dist → eq → vib → rev → pha → echo → cho | Reverb before delay, infinite receding echoes |
| Furnace | echo → cheby → dist → eq → vib → rev → cho → pha | Clean echoes re-enter the waveshaper and get dirtier |
| Tape | vib → cheby → dist → eq → echo → rev → cho → pha | Pitch drift feeds saturation, time-varying harmonics |
| Evolve | vib → echo → rev → pha → cheby → dist → eq → cho | Space before saturation, new harmonics as tails decay |
| Glass | eq → vib → echo → rev → cho → pha | No saturation at all, crystalline |
| Custom | (blank slate, uncomment and reorder) | Build your own |

## Controls

**Keyboard**: 12 zodiac keys, click to toggle voices on and off. Chromatic layout, C through B. The QWERTY row `awsedftgyhuj` mirrors the keys piano-style (a=C, w=Db, s=D ... j=B) — the hint letter sits on each key.

**Knobs**: drag vertically. Shift-drag for fine control. Double-click to reset. Focused knobs answer arrow keys (shift for fine steps) and the scroll wheel.

| Group | Knobs |
|-------|-------|
| Oscillator | HARM (AM/FM harmonicity), MOD (FM mod index), SPRD (fat detuning ¢), STGR (natal stagger) |
| Envelope | ATK, DEC, SUS, REL (× per-sign planetary multiplier) |
| Vibrato | RATE, DPTH, MIX |
| Pan | RATE, WDTH |
| Echo | TIME, FDBK, MIX, FILT |
| EQ | LOW, MID, HIGH, HI x |
| Chebyshev | ORD, MIX |
| Distortion | DRIV, MIX |
| Reverb | ROOM, DAMP, MIX, MOD, AMT |
| Chorus | RATE, DLY, DPTH, MIX |
| Phaser | RATE, OCT, BASE, Q, MIX |

**Play/Pause**: Play sweeps all chart-active keys with STGR stagger timing (default 0.06s). Pause releases all voices.

**Eclipse**: chaos mode. FX params ramp toward extreme values over 16 seconds (feedback 0.87, reverb wet 0.85, chebyshev wet 0.85, spread 120¢ on fat types only, and so on). Toggle it off to restore.

**[OSC_TYPE]**: cycles the oscillator type, per-sign (planetary defaults) → fatsine → amsine → fattriangle → amtriangle → fmtriangle → fatsawtooth → fmsine → fatsquare → back to per-sign. On per-sign, each sign uses its ruling planet's oscillator. On a uniform type, all 12 signs share one.

**Look Within**: a dot pyramid, always visible. Clicking it opens the Controls veil, where Eclipse, Breathe, the knobs, listen presets, randomize, and snapshot export all live. Discoverable, not advertised.

**Chains**: a pill row in the veil switches between the eight FX chains live. The engine rewires its graph behind a short fade — same nodes, different order, different instrument.

**Listen**: monitor EQ presets for headphones, laptop speakers, phone, or loudspeakers. It auto-detects the device type on load via `matchMedia` (phone vs laptop vs headphones default).

**MIDI**: a pill that cycles through your MIDI outputs (Chrome and friends; it hides where Web MIDI is missing). Chart A's voices go out on channels 1 to 12, one channel per sign, with the natal detune riding each channel's pitch bend. Plug in hardware and the chart plays your rig.

**Randomize**: throws the knobs.

**Record**: taps the chain tail — the exact signal the speakers get — and downloads a `.webm` when you stop.

**Perform**: fullscreen, keyboard and emanation only. Inputs, knobs, and footer step aside; ✕ or Esc exits. Made for projectors.

**Snapshot**: Save downloads a `.json` file with the full sound state (all knob values, both banks' active signs, chain, osc type, listen preset, eclipse, orbit, and both charts' birth inputs). Copy puts the same JSON on the clipboard, Load restores one. It's enough to recreate the sound in another Tone.js project.

**Link**: copies a URL carrying that same state in the fragment. Fragments never leave the browser, so birth data stays off the network. Opening a link restores everything silently; Play is the first sound. A QR code of a link turns a room of phones into the instrument.

## Natal Chart

Enter birth data for two people, Chart A and Chart B. Each chart is computed as a tropical whole-sign horoscope via `circular-natal-horoscope-js`. Every celestial body (Sun, Moon, Mercury through Pluto, Chiron) activates the voice of its zodiac sign. If you give a birth time, the Ascendant activates its sign too.

**Dual chart comparison**: both charts are active at once. Keys fire whichever charts own that sign. If only Chart A has Aries, one voice sounds. If both charts have Aries, both voices sound together, and you hear the harmonic relationship between two different tunings of the same sign. Shared keys (signs present in both charts) get a breathing amber-and-teal glow that marks the resonance points between the two charts.

**Play/Pause**: Play sweeps all chart-active keys chromatically (C to B) with stagger timing set by the STGR knob (default 0.06s). Pause releases all voices. Manual key clicking always works on its own.

**Info panel**: shows the shared signs first (with both charts' planets listed), then the signs unique to each chart. The context line reads in plain language: "Two birth charts compared. Shared signs play both voices together."

Each body's ecliptic degree within its sign (0 to 30°) applies a microtonal detune: `(degree - 15) * 3.33¢`. A planet at the start of a sign detunes −50¢, mid-sign stays centered, end of sign +50¢. Two people with Sun in Aries hear different tunings depending on where in Aries their Sun sits. When both voices sound together, that's the interval you hear.

Partial data is fine:

- **Date only**: valid planetary positions, no Ascendant (that needs a time)
- **Date and time**: planets plus Ascendant (accuracy improves once you add a location)
- **All four fields**: fully accurate positions

Manual key exploration is always available. Toggling keys doesn't interfere with the chart voices.

## Transits

Each chart header has a **now** button that fills the current date and time — the sky overhead as a chart. Birth chart in A, now in B, and the comparison machinery does the rest: shared signs glow, cross-chart aspects list and sound. Planetary positions barely depend on location, so there's no geolocation prompt; add a city if you want the Ascendant. The sky moves, so tomorrow's drone is different.

## Aspects

The chart's angular relationships play. Within each chart the library computes the majors — conjunction ☌, opposition ☍, trine △, square □, sextile ⚹. Across two charts the app computes synastry aspects from ecliptic longitudes directly, with tighter orbs (6° conjunction and opposition, 5° trine and square, 4° sextile). Both kinds appear in the info panel.

They also change the sound:

- Trines and sextiles lift the involved signs' velocities (+3% each, capped at +10%)
- Conjunctions focus them (+4%)
- Squares and oppositions detune: when both voices of a tense pair sound, the later arrival shifts 4¢ off its natal tuning, and the beating carries the tension through the Chebyshev intermodulation

The numbers live in `tuning.js` under the `aspect*` keys and vary per preset — Harmonic Furnace pushes 7¢ of tension, Glass Meridian just 3¢.

## Orbit

Orbit stops sustaining and breathes. Each chart-active voice swells and releases on a cycle derived from its ruling planet's orbital period, log-mapped into human time: Moon-ruled Cancer cycles every 16 seconds, Saturn-ruled Capricorn and Aquarius every 88 (`orbitPeriodMin`/`orbitPeriodMax`). Phases spread on the golden ratio so the voices never line up, and the whole thing phases like a slow ensemble. It's the Cousto move applied to rhythm instead of pitch. Leave it on.

## Setup

```bash
npm install
npm run dev
```

## Tuning

All the sound-shaping numbers live in `src/tuning.js`: TUNING, OSC_TYPES, SHADOW, KNOB_DEFS, KNOB_GROUPS, LISTEN_PRESETS, CHAINS, ACTIVE_CHAIN, ZODIAC_NOTES, OCTAVE_GAIN, COUSTO_DETUNE, SIGN_RULERS, PLANETARY_CHARACTER, ASPECTS, PLANET_ORBIT_DAYS. Change a value, hear the difference. The alternative tuning profiles in `src/presets/` (deep-space-oracle, glass-meridian, tape-seance, harmonic-furnace, zodiac) are drop-in replacements for tuning.js.

The code splits along its seams: the audio graph in `src/engine.js`, chart math in `src/astro.js`, sign data in `src/signs.js`, snapshot and share-link codec in `src/snapshot.js`, MIDI out in `src/midi.js`. The React component and the visual system stay in `src/App.jsx`.
