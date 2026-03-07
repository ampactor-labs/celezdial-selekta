# Celezdial Selekta

Polyphonic ambient synthesizer mapped to the zodiac. 12 voices toggle on a chromatic keyboard (C–B), shaped by 39 parameter knobs across 8 swappable FX chains (no GUI for swapping around chains yet). Built with React and Tone.js.

## Signal Chain (Zodiac — active default)

```
12 × PolySynth (per-sign oscType via planetary character + Cousto detune)
  → Panners (4 LFO groups, slow stereo drift)
  → sumBus ─────────────────── polyphonic sum before saturation
      → Highpass (35Hz, -12dB/oct)
      → Vibrato (VHS wow, 0.08Hz)
      → Echo (delay → LPF → tanh sat → feedback, hand-wired)
      → EQ3 (tape shelving)
      → Chebyshev (order 2, even harmonics on summed voices)
      → [Distortion — bypassed]
      → Freeverb (room 0.88, swept damping)
      → Chorus (on by default, stereo width)
      → [Phaser — bypassed]
      → Monitor EQ (listening environment comp)
      → Soft clip (tanh limiter)
      → out
```

Summing before Chebyshev is the point — polynomial waveshaping on a polyphonic mix generates sum/difference tones between partials. Order 2 = even harmonics only (octave doubling = warmth). Order 3 creates harsh odd-harmonic intermodulation on dense polyphonic material — avoided for the ambient default.

## Voicing Strategy

Dim7-derived octave partitioning prevents semitone adjacencies within any octave. The chromatic scale's 12 notes are distributed across three octaves in diminished-seventh groups:

| Octave | Notes | Interval pattern |
|--------|-------|-----------------|
| 3 | C, Eb, Gb, A | dim7 (minor thirds) |
| 4 | D, F, Ab, B | dim7 |
| 5 | Db, E, G, Bb | dim7 |

Within any single octave, the closest interval is a minor third (3 semitones). No semitone or whole-tone clashes when adjacent signs sound together. The three dim7 groups interlock to cover all 12 chromatic pitches.

Velocity follows astrological hierarchy — luminaries (Sun/Moon signs) are loudest, personal planet signs next, social planets quietest:

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

Four pan groups (A–D) each driven by an independent LFO at 0.03Hz. Voices in the same group drift together. Count/Spread apply only to fat oscillator types (5 signs); AM/FM types (7 signs) don't use detuned oscillator stacks. Fletcher-Munson compensation flattens perceived loudness across the range (+5dB oct 3, +2dB oct 3, 0dB oct 4, −2dB oct 5). Adaptive voicing adds `5 × log10(12 / active)` dB boost for sparse voicings (1 voice = +5.4dB, 3 = +3dB, 12 = 0dB).

## Cousto Planetary Tuning

Hans Cousto's *Cosmic Octave* (1978) — planetary orbital periods octave-transposed into audible frequencies. Each sign is microtonally detuned by its traditional ruling planet's deviation from 12-TET.

Applied at 50% strength (the `detuneCents` column in Voices is half the raw Cousto offset). Enough color to feel the planetary character without quarter-tone shock on dense voicings.

Signs sharing a ruler share the same offset — pairs that are "in tune" with each other through planetary resonance:

| Ruler | Raw ¢ | Applied ¢ | Signs |
|-------|-------|-----------|-------|
| Sun | +38 | +19 | Leo |
| Moon | +23 | +11.5 | Cancer |
| Mercury | +33 | +16.5 | Gemini, Virgo |
| Venus | +10 | +5 | Taurus, Libra |
| Mars | −25 | −12.5 | Aries, Scorpio |
| Jupiter | −13 | −6.5 | Pisces, Sagittarius |
| Saturn | +12 | +6 | Aquarius, Capricorn |

Two independent systems coexist: Lionel's chromatic-calendar determines the note class (C through B), Cousto determines the cents offset within that note. In natal mode, degree-based detune (`(degree - 15) × 3.33¢`) replaces Cousto.

## Planetary Character

Each sign inherits its ruling planet's sonic personality — oscillator type and ADSR envelope multipliers. Orbital speed maps to envelope speed: inner planets (Mars, Mercury) have fast, driven envelopes; outer planets (Jupiter, Saturn) are slow and expansive.

| Planet | Osc Type | ATK | DEC | SUS | REL | Character |
|--------|----------|-----|-----|-----|-----|-----------|
| Sun | fatsine | ×0.8 | ×0.9 | ×1.1 | ×0.9 | Warm center, assertive |
| Moon | amsine | ×1.2 | ×1.1 | ×1.0 | ×1.3 | Tidal AM, emotional sustain |
| Mars | fatsawtooth | ×0.6 | ×0.7 | ×0.9 | ×0.8 | Aggressive harmonics, driven |
| Venus | fattriangle | ×1.3 | ×1.1 | ×1.1 | ×1.1 | Warm rounded, graceful |
| Mercury | fmsine | ×0.7 | ×0.8 | ×0.9 | ×0.8 | Metallic FM precision |
| Jupiter | amtriangle | ×1.4 | ×1.2 | ×1.0 | ×1.4 | Expansive AM warmth |
| Saturn | fmtriangle | ×1.5 | ×1.3 | ×1.0 | ×1.5 | Structured FM complexity |

Envelope knobs set a base value; each sign multiplies by its planet's factor. With default 2.8s attack: Mars signs attack in ~1.7s, Saturn in ~4.2s. Creates staggered bloom where inner-planet voices arrive first.

Three oscillator families:
- **Fat** (5 signs: Leo, Aries, Scorpio, Taurus, Libra) — detuned oscillator stacks, support count/spread and Eclipse spread ramp
- **AM** (3 signs: Cancer, Sagittarius, Pisces) — amplitude modulation, bell-like to warm
- **FM** (4 signs: Gemini, Virgo, Capricorn, Aquarius) — frequency modulation, metallic to structured

Signs sharing a ruler share identical character — Aries and Scorpio both get Mars's aggressive fatsawtooth, Taurus and Libra both get Venus's graceful fattriangle.

## Astrological System

Traditional (pre-modern) planetary rulership — 7 visible planets, no co-rulers (Uranus, Neptune, Pluto). This matches Cousto's original system and creates cleaner shared-ruler pairs that produce harmonic groupings.

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

Eight pre-wired chains — same nodes, different order, different character:

| Chain | Order (abbreviated) | Character |
|-------|---------------------|-----------|
| **Zodiac** | vib → echo → eq → cheby → rev → cho | Balanced. Beautiful on load, cosmic at extremes |
| Cathedral | cheby → eq → vib → echo → rev → cho | Saturation first — warm, thick |
| Void | cheby → dist → eq → vib → rev → pha → echo → cho | Reverb before delay — infinite receding echoes |
| Furnace | echo → cheby → dist → eq → vib → rev → cho → pha | Clean echoes re-enter waveshaper — progressively dirtier |
| Tape | vib → cheby → dist → eq → echo → rev → cho → pha | Pitch drift feeds saturation — time-varying harmonics |
| Evolve | vib → echo → rev → pha → cheby → dist → eq → cho | Space before saturation — new harmonics as tails decay |
| Glass | eq → vib → echo → rev → cho → pha | No saturation at all — crystalline |
| Custom | (blank slate — uncomment and reorder) | Build your own |

## Controls

**Keyboard** — 12 zodiac keys, click to toggle voices on/off. Chromatic layout C through B.

**39 Knobs** — Drag vertically. Shift+drag for fine. Double-click to reset.

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

**Eclipse** — Chaos mode. FX params ramp toward extreme values over 16 seconds (feedback 0.87, reverb wet 0.85, chebyshev wet 0.85, spread 120¢ on fat types only, etc.). Toggle off to restore.

**[OSC_TYPE]** — Cycles oscillator type: per-sign (planetary defaults) → fatsine → amsine → fattriangle → amtriangle → fmtriangle → fatsawtooth → fmsine → fatsquare → per-sign → ... On per-sign, each sign uses its ruling planet's oscillator. On uniform types, all 12 signs share one type.

**Look Within** — Dot pyramid, always visible. Clicking opens the Controls veil — Eclipse, Breathe, knobs, listen presets, randomize, and snapshot export are all revealed inside. Discoverable, not advertised.

**Listen** — Monitor EQ presets for headphones, laptop speakers, phone, or loudspeakers. Auto-detects device type on load via `matchMedia` (phone vs laptop vs headphones default).

**Randomize** — Throws the knobs.

**Snapshot** — Save downloads a `.json` file capturing the full sound state (all 39 knob values, active signs, chain, osc type, listen preset, eclipse state). Copy puts the same JSON on the clipboard. Enough to recreate the sound in another Tone.js project.

## Natal Chart

Enter birth date, time, and location to compute a tropical whole-sign horoscope via `circular-natal-horoscope-js`. Each celestial body (Sun, Moon, Mercury through Pluto, Chiron) activates the voice of its zodiac sign — your chart becomes a chord. If birth time is provided, the Ascendant activates its sign too.

Each body's ecliptic degree within its sign (0–30°) applies microtonal detuning: `(degree - 15) * 3.33¢`. A planet at the start of a sign detunes −50¢, mid-sign stays centered, end of sign +50¢. Two people with Sun in Aries hear different tunings depending on where in Aries their Sun sits.

Partial data is fine:

- **Date only** — valid planetary positions, no Ascendant (needs time)
- **Date + time** — planets + Ascendant (Ascendant accuracy improves with location)
- **All four fields** — fully accurate positions

Natal chord fires simultaneously (stagger 0) and rings until manually stopped — ADSR envelope sustains with no auto-cutoff. Single "Compute & Play" button. Manual key exploration is always available — toggling keys doesn't interfere with the natal chord.

## Setup

```bash
npm install
npm run dev
```

## Tuning

All sound-shaping numbers live in `src/tuning.js`: TUNING, OSC_TYPES, SHADOW, KNOB_DEFS, KNOB_GROUPS, LISTEN_PRESETS, CHAINS, ACTIVE_CHAIN, ZODIAC_NOTES, OCTAVE_GAIN, COUSTO_DETUNE, SIGN_RULERS, PLANETARY_CHARACTER. Change a value, hear the difference. Alternative tuning profiles in `src/presets/` (deep-space-oracle, glass-meridian, tape-seance, harmonic-furnace, zodiac) are drop-in replacements for tuning.js.

Engine + UI + visuals live in `src/App.jsx`.
