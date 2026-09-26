# Tuning

Two separate systems set each voice's pitch. Lionel Williams' chromatic
calendar picks the note class (C to B, one per sign; see
[VOICES.md](VOICES.md)). A cents offset then moves that note off 12-tone equal
temperament (12-TET, the standard piano tuning). A cent is a hundredth of a
semitone.

## Cousto planetary tuning

Hans Cousto's *Cosmic Octave* (1978) takes each planet's orbital period and
doubles its frequency, octave by octave, until it lands in the audible range.
Each sign is detuned by how far its traditional ruling planet's Cousto tone
sits from the nearest equal-tempered note:
`cents = 1200 × log2(f_cousto / f_nearest_ET)`.

The app applies half of that offset. That keeps the planetary color without
quarter-tone clashes in dense voicings. Signs that share a ruler share the same
offset, so each pair is in tune with itself.

| Ruler   | Raw cents | Applied cents | Signs               |
| ------- | --------- | ------------- | ------------------- |
| Sun     | +38       | +19           | Leo                 |
| Moon    | +23       | +11.5         | Cancer              |
| Mercury | +33       | +16.5         | Gemini, Virgo       |
| Venus   | +10       | +5            | Taurus, Libra       |
| Mars    | -25       | -12.5         | Aries, Scorpio      |
| Jupiter | -13       | -6.5          | Pisces, Sagittarius |
| Saturn  | +12       | +6            | Aquarius, Capricorn |

The Cousto offsets apply when you play keys with no chart for that sign, and
they are the center that Eclipse's random detune drifts around.

## Degree detune from a chart

When a chart puts a body in a sign, that voice's detune comes from the body's
exact degree instead of from Cousto: `(degree - 15) × 3.33` cents, since one
30-degree sign spans 100 cents. A body at the start of a sign sounds 50 cents
flat, one at 15 degrees sounds on pitch, and one at the end sounds 50 cents
sharp. Two people with the Sun in Aries hear two tunings of D, and when both
voices sound together the beating between them is the distance between their
Suns. When several bodies share a sign, the first in the order Sun, Moon,
Mercury through Pluto, Chiron sets the detune; the Ascendant sets it only for a
sign with no bodies in it (`src/astro.js`).

## Where the numbers live

- `src/tuning.js` holds the sound-shaping defaults: `TUNING` (effect and
  envelope settings, aspect and Orbit constants), `OSC_TYPES`, `SHADOW`
  (Eclipse targets), `KNOB_DEFS`, `KNOB_GROUPS`, `LISTEN_PRESETS`, `CHAINS`,
  `ACTIVE_CHAIN`, `OCTAVE_GAIN`, `SIGN_RULERS`, `PLANETARY_CHARACTER`,
  `ASPECTS` and `PLANET_ORBIT_DAYS`. Change a value while `npm run dev` runs
  and Vite reloads the page with it.
- `src/signs.js` holds the per-sign values the engine reads: note, octave,
  velocity, applied Cousto detune, pan position and group, and oscillator count
  and spread.
- `ZODIAC_NOTES` and `COUSTO_DETUNE` in `src/tuning.js` are reference tables.
  Nothing imports them, so editing them changes nothing; edit `src/signs.js`
  instead.

## Older tuning profiles

`src/presets/` holds five older profiles: deep-space-oracle, glass-meridian,
harmonic-furnace, tape-seance and zodiac. Each exports its own `TUNING`,
`SHADOW`, `LISTEN_PRESETS`, `CHAINS` and `ACTIVE_CHAIN`, plus a `MACROS` table
that the current app does not read. They pin the sample rate to 16 kHz for a
lo-fi sound, and their aspect tension ranges from 3 cents (Glass Meridian) to
7 cents (Harmonic Furnace).

Nothing in the app imports them, and they predate some current settings: each
profile's `TUNING` lacks ten keys that the engine now reads (`harmonicity`,
`modulationIndex`, `oscSpread`, the four chorus settings, the two highpass
settings and `centsPerDegree`). To try one, copy its values into the matching
exports of `src/tuning.js` and keep the missing keys; replacing the whole file
breaks the imports. `src/__tests__/presets.test.js` checks only that each
profile has the six exports, a numeric sample rate and a valid chain name.
