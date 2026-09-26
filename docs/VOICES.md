# Voices

Each of the twelve zodiac signs is one voice: a Tone.js `PolySynth` limited to
one note. The engine builds two banks of twelve (bank A for Chart A, bank B for
Chart B), so up to 24 voices can sound at once. The per-sign data lives in
`src/signs.js`; the per-planet data lives in `src/tuning.js`.

## Sign to note

The note class comes from Lionel Williams' chromatic calendar: the zodiac year
laid over one octave, with Aquarius at C and Aries (the spring equinox) at D.
One sign spans 30 degrees of the ecliptic and 100 cents of pitch.

## Octave placement

The twelve notes are spread over three octaves in diminished-seventh groups (a
diminished seventh chord stacks minor thirds, three semitones apart):

| Octave | Notes        | Interval pattern    |
| ------ | ------------ | ------------------- |
| 3      | C, Eb, Gb, A | dim7 (minor thirds) |
| 4      | D, F, Ab, B  | dim7                |
| 5      | Db, E, G, Bb | dim7                |

Within any one octave the closest interval is a minor third, so no two voices
in the same octave sit a semitone or a whole tone apart. Signs that are
neighbors on the keyboard always land in different octaves. The three groups
interlock to cover all twelve pitch classes.

## Velocity

Velocity (how hard a note is struck, 0 to 1) follows the traditional hierarchy
of the ruling planets. Signs ruled by the luminaries (Sun and Moon) are
loudest, signs ruled by the personal planets come next, and signs ruled by the
social planets (Jupiter and Saturn) are quietest.

| Tier     | Ruler   | Signs               | Velocity   |
| -------- | ------- | ------------------- | ---------- |
| Luminary | Sun     | Leo                 | 0.65       |
| Luminary | Moon    | Cancer              | 0.60       |
| Personal | Mars    | Aries, Scorpio      | 0.52, 0.48 |
| Personal | Venus   | Taurus, Libra       | 0.50, 0.47 |
| Personal | Mercury | Gemini, Virgo       | 0.48, 0.45 |
| Social   | Jupiter | Sagittarius, Pisces | 0.40, 0.38 |
| Social   | Saturn  | Capricorn, Aquarius | 0.35, 0.33 |

## Voice table

| Sign        | Note | Octave | Velocity | Cousto cents | Oscillator  | Pan group |
| ----------- | ---- | ------ | -------- | ------------ | ----------- | --------- |
| Aquarius    | C    | 3      | 0.33     | +6           | fmtriangle  | A         |
| Pisces      | Db   | 5      | 0.38     | -6.5         | amtriangle  | D         |
| Aries       | D    | 4      | 0.52     | -12.5        | fatsawtooth | B         |
| Taurus      | Eb   | 3      | 0.50     | +5           | fattriangle | C         |
| Gemini      | E    | 5      | 0.48     | +16.5        | fmsine      | B         |
| Cancer      | F    | 4      | 0.60     | +11.5        | amsine      | D         |
| Leo         | Gb   | 3      | 0.65     | +19          | fatsine     | B         |
| Virgo       | G    | 5      | 0.45     | +16.5        | fmsine      | A         |
| Libra       | Ab   | 4      | 0.47     | +5           | fattriangle | C         |
| Scorpio     | A    | 3      | 0.48     | -12.5        | fatsawtooth | C         |
| Sagittarius | Bb   | 5      | 0.40     | -6.5         | amtriangle  | D         |
| Capricorn   | B    | 4      | 0.35     | +6           | fmtriangle  | A         |

The Cousto column is the microtonal offset from equal temperament; see
[TUNING.md](TUNING.md). The five signs with a `fat` oscillator run two
detuned oscillators each. `src/signs.js` also gives each sign its own spread (5
or 8 cents), but the engine applies the SPRD knob to every fat voice when it
starts, so in practice all of them use the knob's value (8 cents by default).
AM and FM oscillators ignore count and spread.

## Rulers and planetary character

The app uses traditional rulership: the seven visible planets, with no modern
co-rulers (Uranus, Neptune, Pluto). This matches Cousto's system and gives six
pairs of signs that share a ruler.

| Sign        | Ruler   | Tier     |
| ----------- | ------- | -------- |
| Leo         | Sun     | Luminary |
| Cancer      | Moon    | Luminary |
| Aries       | Mars    | Personal |
| Scorpio     | Mars    | Personal |
| Taurus      | Venus   | Personal |
| Libra       | Venus   | Personal |
| Gemini      | Mercury | Personal |
| Virgo       | Mercury | Personal |
| Sagittarius | Jupiter | Social   |
| Pisces      | Jupiter | Social   |
| Capricorn   | Saturn  | Social   |
| Aquarius    | Saturn  | Social   |

Each sign inherits its ruler's oscillator type and a set of multipliers for the
ADSR envelope (attack, decay, sustain, release). Orbital speed maps to envelope
speed: the inner planets (Mars, Mercury) get fast envelopes, the outer planets
(Jupiter, Saturn) slow ones.

| Planet  | Oscillator  | Attack | Decay | Sustain | Release | Character                    |
| ------- | ----------- | ------ | ----- | ------- | ------- | ---------------------------- |
| Sun     | fatsine     | ×0.8   | ×0.9  | ×1.1    | ×0.9    | Warm center, assertive       |
| Moon    | amsine      | ×1.2   | ×1.1  | ×1.0    | ×1.3    | Tidal AM, long sustain       |
| Mars    | fatsawtooth | ×0.6   | ×0.7  | ×0.9    | ×0.8    | Bright harmonics, driven     |
| Venus   | fattriangle | ×1.3   | ×1.1  | ×1.1    | ×1.1    | Warm and rounded             |
| Mercury | fmsine      | ×0.7   | ×0.8  | ×0.9    | ×0.8    | Metallic FM                  |
| Jupiter | amtriangle  | ×1.4   | ×1.2  | ×1.0    | ×1.4    | Wide AM warmth               |
| Saturn  | fmtriangle  | ×1.5   | ×1.3  | ×1.0    | ×1.5    | Structured FM                |

The envelope knobs set a base value and each sign multiplies it by its
planet's factor. With the default 2.8 s attack, Mars signs attack in about
1.7 s and Saturn signs in about 4.2 s, so the inner-planet voices arrive first
when a chart plays.

That gives three oscillator families:

- **Fat** (Leo, Aries, Scorpio, Taurus, Libra): stacks of detuned
  oscillators. They respond to the SPRD knob and to Eclipse's spread ramp.
- **AM** (Cancer, Sagittarius, Pisces): amplitude modulation, from bell-like to
  warm. They respond to HARM.
- **FM** (Gemini, Virgo, Capricorn, Aquarius): frequency modulation, from
  metallic to structured. They respond to HARM and MOD.

Signs that share a ruler share its character: Aries and Scorpio both get Mars's
fatsawtooth, and Taurus and Libra both get Venus's fattriangle.

## Panning

Each sign has a fixed stereo position (`panBase`) and a pan group (A to D) in
`src/signs.js`. Bank B uses the fixed positions, mirrored at 30% width, and
does not move. In bank A, one LFO per group drives the pan of every voice in
that group (0.03 Hz and a width of 0.28 by default). Connecting an LFO to a
Tone.js parameter replaces the parameter's own value, so in bank A the fixed
positions have no effect. The four LFOs also start together at the same rate,
so as the code stands the four groups move in step.

## Loudness

Each voice starts at -9 dB, plus a per-octave offset that flattens perceived
loudness across the range (a Fletcher-Munson style correction): +2 dB in
octave 3, 0 dB in octave 4 and -2 dB in octave 5. The table in `src/tuning.js`
also has +5 dB for octave 2, which no voice uses.

Adaptive voicing then adds `5 × log10(12 / active)` dB to every voice, where
`active` counts the sounding voices in both banks. One voice gets +5.4 dB,
three get +3 dB and twelve get 0 dB; above twelve the offset turns negative.
