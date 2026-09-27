# Design notes

These notes hold the detail behind the [How it works](../README.md#how-it-works) section of the README: the signal chain, how the twelve voices are tuned and balanced, the chart features, and a reference for every control. The numbers come from the source files named in each section. Where this page and the code disagree, the code is right.

## Signal chain

The default chain is `zodiac` in [`src/tuning.js`](../src/tuning.js), wired up by `createEngine` in [`src/engine.js`](../src/engine.js). Values in parentheses are the defaults.

```text
12 voices per chart x 2 charts (bank A and bank B)
  -> one panner per voice
  -> sum bus: every voice mixes here, before any saturation
  -> high-pass filter (35 Hz, -12 dB per octave)
  -> vibrato (0.08 Hz, depth 0.15, 30% mix)
  -> echo: delay -> low-pass -> tanh saturator -> feedback gain -> delay
  -> 3-band EQ (low +2 dB, mid +1 dB, high -5 dB above 4.5 kHz)
  -> Chebyshev waveshaper (order 2, 25% mix)
  -> [distortion]
  -> reverb: 25 ms pre-delay into Freeverb (room 0.88, damping swept)
  -> chorus (0.3 Hz, 18 ms, depth 0.35, 18% mix)
  -> [phaser]
  -> listening EQ (the Listen presets)
  -> soft clip (tanh)
  -> speakers and the recorder
```

Bracketed stages start outside the signal path. Raising a stage's MIX knob above zero wires it in, and setting the knob back to zero takes it out again, so the stage costs no processing while it would be silent. The echo splits the signal into a dry path and a wet path, and a crossfade mixes them back together.

### Sum before saturation

Summing the voices before the Chebyshev stage is the core of the design. A waveshaper passes every sample through a fixed curve. On a single sine wave, the order-2 Chebyshev curve produces the second harmonic, one octave up, which reads as warmth. On a sum of notes the curve also multiplies the notes together. That creates sum and difference tones (intermodulation) between their partials, the sine components each note is made of, so the chord generates tones of its own. Order 3 adds odd harmonics that turn harsh on dense chords, so the default stays at order 2, as the comments in `tuning.js` explain. The ORD knob goes up to order 11.

### Echo

The echo is built by hand from Tone.js nodes. The delay (0.85 s) feeds a low-pass filter (2.8 kHz, -12 dB per octave), then a tanh saturator with a drive of 0.6, then the feedback gain (0.35), and then the delay again. Each repeat therefore comes back darker and softer, like a tape delay. A gain of 0.7 in front of the delay leaves headroom for a loud chord, and the crossfade sets the mix (22% wet). The loop gain is the feedback times the drive: 0.21 at the defaults. The comment in `tuning.js` requires it to stay below 1, or small signals would keep growing. Changes to the echo knobs ramp in over 80 to 150 ms.

### Reverb

Freeverb is a standard algorithmic reverb: parallel comb filters feed a series of all-pass filters. Here it sits behind a 25 ms pre-delay. A sine sweep moves its damping frequency around the DAMP knob's value. With the defaults (0.04 Hz, depth 0.15, DAMP at 1.2 kHz) the damping moves between about 825 Hz and 1.75 kHz and back every 25 seconds, in ten steps a second. Those limits follow from the sweep formula in `engine.js`.

### Switching chains

Picking another chain fades the sum bus out over 80 ms and disconnects every chain node. The engine then wires the nodes again in the new order, puts back any bracketed stage whose mix is up, and fades the bus in over 180 ms.

### Engine settings

- The audio context runs at the device's native sample rate. It used to force 44.1 kHz. Android hardware typically runs at 48 kHz, so Chrome had to resample and left its fast audio path, and mid-range phones glitched once the reverb was fully wired in (commit `89e3feb`). A tuning profile can still pin a rate: the five files in `src/presets/` pin 16 kHz for a lo-fi sound.
- Tone.js schedules events 300 ms ahead on the audio clock and checks for new ones every 50 ms. Key presses start their notes at `Tone.now()`, which includes that look-ahead, so a note begins about 300 ms after the press, plus the device's own output latency. MIDI notes go out at once, so external gear leads the browser's own sound by that much.
- Tone.js and the audio graph load on the first click, tap or key press, because browsers block audio until the user acts.
- On iOS the engine sets the audio session type to `playback`, the setting that lets audio play with the silent switch on (iOS 17 and later). It also runs an inaudible oscillator (gain 1e-37) that, according to the code comment, keeps the context from suspending when the screen locks.

## Voicing

### Octaves

The twelve notes are spread over three octaves in diminished-seventh groups: sets of four notes a minor third (three semitones) apart. No two notes in the same octave are closer than three semitones, and the three groups together still cover all twelve pitches.

| Octave | Notes        | Signs                              |
| ------ | ------------ | ---------------------------------- |
| 3      | C, Eb, Gb, A | Aquarius, Taurus, Leo, Scorpio     |
| 4      | D, F, Ab, B  | Aries, Cancer, Libra, Capricorn    |
| 5      | Db, E, G, Bb | Pisces, Gemini, Virgo, Sagittarius |

### Loudness

Velocity is how hard a note is struck, and here it sets each voice's level. It follows the traditional hierarchy of rulers. Signs ruled by the luminaries (the Sun and Moon) are loudest, the signs of the personal planets come next, and the signs of the social planets (Jupiter and Saturn) sit lowest as a bed.

| Tier     | Ruler   | Signs               | Velocity   |
| -------- | ------- | ------------------- | ---------- |
| Luminary | Sun     | Leo                 | 0.65       |
| Luminary | Moon    | Cancer              | 0.60       |
| Personal | Mars    | Aries, Scorpio      | 0.52, 0.48 |
| Personal | Venus   | Taurus, Libra       | 0.50, 0.47 |
| Personal | Mercury | Gemini, Virgo       | 0.48, 0.45 |
| Social   | Jupiter | Sagittarius, Pisces | 0.40, 0.38 |
| Social   | Saturn  | Capricorn, Aquarius | 0.35, 0.33 |

Aspects can lift a velocity by up to 10% (see [Aspects](#aspects)), and no velocity goes above 0.95.

Each voice starts at -9 dB. An octave correction then evens out perceived loudness, based on the Fletcher-Munson curves, which describe how loud different pitches sound at the same level: +2 dB in octave 3, 0 dB in octave 4 and -2 dB in octave 5. `OCTAVE_GAIN` also lists +5 dB for octave 2, which no voice uses. Adaptive voicing adds `5 × log10(12 / n)` dB on top, where n counts the voices sounding across both charts: +5.4 dB for one voice, +3 dB for three, 0 dB for twelve and -1.5 dB for 24. In Orbit mode, n is 45% of the orbiting voices, rounded.

### The twelve voices

| Sign           | Note | Octave | Velocity | Cousto offset (cents) | Oscillator  | Pan group | Fat count |
| -------------- | ---- | ------ | -------- | --------------------- | ----------- | --------- | --------- |
| Aquarius ♒︎    | C    | 3      | 0.33     | +6                    | fmtriangle  | A         | 2         |
| Pisces ♓︎      | Db   | 5      | 0.38     | −6.5                  | amtriangle  | D         | 3         |
| Aries ♈︎       | D    | 4      | 0.52     | −12.5                 | fatsawtooth | B         | 2         |
| Taurus ♉︎      | Eb   | 3      | 0.50     | +5                    | fattriangle | C         | 2         |
| Gemini ♊︎      | E    | 5      | 0.48     | +16.5                 | fmsine      | B         | 3         |
| Cancer ♋︎      | F    | 4      | 0.60     | +11.5                 | amsine      | D         | 2         |
| Leo ♌︎         | Gb   | 3      | 0.65     | +19                   | fatsine     | B         | 2         |
| Virgo ♍︎       | G    | 5      | 0.45     | +16.5                 | fmsine      | A         | 3         |
| Libra ♎︎       | Ab   | 4      | 0.47     | +5                    | fattriangle | C         | 2         |
| Scorpio ♏︎     | A    | 3      | 0.48     | −12.5                 | fatsawtooth | C         | 2         |
| Sagittarius ♐︎ | Bb   | 5      | 0.40     | −6.5                  | amtriangle  | D         | 3         |
| Capricorn ♑︎   | B    | 4      | 0.35     | +6                    | fmtriangle  | A         | 2         |

The oscillator column shows each sign's type in the default dynamic mode (see [Planetary character](#planetary-character)). Fat count is the number of detuned copies a fat oscillator stacks. In dynamic mode it applies to the five fat signs, and a uniform fat type chosen with the oscillator button applies it to all twelve. The detune spread of every stack comes from the SPRD knob (8 cents by default). `src/signs.js` also gives each sign a spread of its own (5 to 12 cents), but the engine applies the knob's value over it as soon as it starts, so those per-sign values are never heard.

### Stereo placement

Each sign has a pan position in `src/signs.js`, from -0.7 (left) to +0.7 (right), and belongs to one of four pan groups, A to D. The engine gives each group its own LFO (a low-frequency oscillator, used here as a slow automatic pan knob) at 0.03 Hz with a depth of 0.28. It connects each LFO to the pan of that group's Chart A voices, so that each group drifts on its own.

Two details of the code change the result. Connecting a signal to a Tone.js parameter resets the parameter to zero (`connectSignal` in Tone.js 14.7.77). The LFO output therefore becomes the whole pan value, each voice's base position is lost, and every Chart A voice pans within 0.28 of the centre. The four LFOs also share one rate, depth and start time, so the groups move together. Chart B's voices sit at the mirror image of the base positions at 30% of the width, and they do not move. This reading comes from the source code; it has not been checked by listening or by rendering audio.

## Tuning

### Notes

Each sign's note comes from Lionel Williams' chromatic calendar, which lays the zodiac year over one octave. One sign spans 30 degrees of the zodiac and 100 cents of pitch (a cent is a hundredth of a semitone). Aquarius sits on C, Aries (the spring equinox) on D, and so on up to Capricorn on B.

### Cousto planetary tuning

Hans Cousto's cosmic octave treats a planet's orbital period as a very low frequency and doubles it, octave by octave, until it can be heard. Each sign is detuned by the gap between its ruling planet's tone and the nearest note of standard equal temperament (12-TET, the tuning of a piano). Tuning between the twelve standard pitches like this is called microtuning.

The offsets play at half strength, which keeps each planet's colour without quarter-tone clashes on dense chords. Signs that share a ruler share an offset, so each such pair sits in tune with itself.

| Ruler   | Cousto tone | Nearest note   | Full offset (cents) | Applied (cents) | Signs               |
| ------- | ----------- | -------------- | ------------------- | --------------- | ------------------- |
| Sun     | 126.22 Hz   | B2, 123.47 Hz  | +38                 | +19             | Leo                 |
| Moon    | 210.42 Hz   | G#3, 207.65 Hz | +23                 | +11.5           | Cancer              |
| Mercury | 141.27 Hz   | C#3, 138.59 Hz | +33                 | +16.5           | Gemini, Virgo       |
| Venus   | 221.23 Hz   | A3, 220.00 Hz  | +10                 | +5              | Taurus, Libra       |
| Mars    | 144.72 Hz   | D3, 146.83 Hz  | −25                 | −12.5           | Aries, Scorpio      |
| Jupiter | 183.58 Hz   | F#3, 185.00 Hz | −13                 | −6.5            | Pisces, Sagittarius |
| Saturn  | 147.85 Hz   | D3, 146.83 Hz  | +12                 | +6              | Aquarius, Capricorn |

The tones and nearest notes come from the comments on `COUSTO_DETUNE` in `tuning.js`. Each full offset is 1200 × log2(tone / nearest note), rounded to the cent. `COUSTO_DETUNE` itself is a reference table: the halved offsets the voices play are written into `src/signs.js`.

Two systems stack here. The chromatic calendar picks the note, and Cousto picks the offset within it. For a sign that a chart contains, the [degree detune](#degree-detune) replaces the Cousto offset.

## Planetary character

Each sign takes its ruling planet's character: an oscillator type and multipliers for its envelope. The envelope (ADSR) is a note's shape over time: attack, decay, sustain level and release. Orbital speed maps to envelope speed. The fast inner planets (Mars, Mercury) get quick, driven envelopes, and the slow outer planets (Jupiter, Saturn) get slow, broad ones.

| Planet  | Oscillator  | Attack | Decay | Sustain | Release | Character              |
| ------- | ----------- | ------ | ----- | ------- | ------- | ---------------------- |
| Sun     | fatsine     | ×0.8   | ×0.9  | ×1.1    | ×0.9    | Warm centre, assertive |
| Moon    | amsine      | ×1.2   | ×1.1  | ×1.0    | ×1.3    | Tidal AM, long sustain |
| Mars    | fatsawtooth | ×0.6   | ×0.7  | ×0.9    | ×0.8    | Bright and driven      |
| Venus   | fattriangle | ×1.3   | ×1.1  | ×1.1    | ×1.1    | Warm and rounded       |
| Mercury | fmsine      | ×0.7   | ×0.8  | ×0.9    | ×0.8    | Metallic FM            |
| Jupiter | amtriangle  | ×1.4   | ×1.2  | ×1.0    | ×1.4    | Broad AM warmth        |
| Saturn  | fmtriangle  | ×1.5   | ×1.3  | ×1.0    | ×1.5    | Dense FM               |

The envelope knobs set base values, and each sign multiplies them by its planet's factors (sustain is capped at 1). With the default 2.8 s attack, Mars signs reach full level in about 1.7 s and Saturn signs in 4.2 s, so the inner-planet voices bloom first.

In the default dynamic mode the oscillators fall into these families:

- Fat, in five signs (Leo, Aries, Scorpio, Taurus, Libra): stacks of detuned copies that take the count and spread settings and the Eclipse spread ramp.
- AM, in three signs (Cancer, Sagittarius, Pisces): amplitude modulation, from bell-like to warm.
- FM, in four signs (Gemini, Virgo, Capricorn, Aquarius): frequency modulation, from metallic to structured.

Signs with one ruler share one character. Aries and Scorpio both play Mars's fatsawtooth, and Taurus and Libra both play Venus's fattriangle.

## Astrological system

The app uses traditional rulership: the seven planets visible to the eye rule the twelve signs, with no modern co-rulers (Uranus, Neptune, Pluto). Every ruler except the Sun and Moon then rules exactly two signs, which gives clean shared-ruler pairs. Uranus, Neptune, Pluto and Chiron still light keys when a chart places them, but they rule no sign, so they set no voice's oscillator or envelope.

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

## FX chains

`CHAINS` in `src/tuning.js` defines eight orders of the same effects, and the order changes the character. Each of the seven below starts after the high-pass filter and ends with the listening EQ and the soft clip. The descriptions follow the comments in `tuning.js`.

| Chain            | Order                                                                        | Character                                                                                  |
| ---------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| zodiac (default) | vibrato → echo → EQ → Chebyshev → [distortion] → reverb → chorus → [phaser]  | Tape, furnace and cathedral combined; the EQ before the saturation picks which harmonics it makes |
| cathedral        | Chebyshev → [distortion] → EQ → vibrato → echo → reverb → chorus → [phaser]  | Saturation first, so its harmonics colour everything after it: warm and thick              |
| void             | Chebyshev → [distortion] → EQ → vibrato → reverb → phaser → echo → chorus    | Reverb before the echo, so the echo repeats the reverb tail: diffuse, receding echoes      |
| furnace          | echo → Chebyshev → [distortion] → EQ → vibrato → reverb → chorus → [phaser]  | Echo before saturation: the echoes are waveshaped together with the dry signal              |
| tape             | vibrato → Chebyshev → [distortion] → EQ → echo → reverb → chorus → [phaser]  | Pitch drift feeds the saturation, so the harmonics shift over time                         |
| evolve           | vibrato → echo → reverb → [phaser] → Chebyshev → [distortion] → EQ → chorus  | Space before saturation: decaying tails keep producing new harmonics                       |
| glass            | EQ → vibrato → echo → reverb → chorus → [phaser]                             | No saturation at all                                                                       |

These seven appear as pills in the controls panel. The void chain keeps its phaser wired, because the phaser borders the echo's dry and wet split, which the bypass mechanism cannot express.

The eighth chain, `custom`, is a template for your own order, and no menu offers it. It plays only if `ACTIVE_CHAIN` in `tuning.js` names it, or a loaded snapshot or link does. As shipped it lists every node with the reverb after the soft clip, and its comment says the entries are commented out, but every entry is live. The rules for a valid order sit in the comment above it: `ECHO` exactly once, `softClip` last, `monitorEQ` just before it, and no node in both `order` and `bypass`.

## Charts

[`src/astro.js`](../src/astro.js) computes charts with the `circular-natal-horoscope-js` library, loaded the first time a chart is needed. It uses the tropical zodiac and whole-sign houses, and the computation runs in the browser.

### Entering a chart

Each chart takes a birth date, a time and a birth city. The Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto and Chiron each light the key of the sign they occupy. With a birth time, the Ascendant (the sign rising on the eastern horizon) lights its sign too. Partial data still works:

- Date only: the chart is cast for 12:00 UTC on that day, with no Ascendant. Fast movers such as the Moon may sit in a different sign than at the real birth time.
- Date and time without a city: the time is read as UTC, so the chart is off by the birthplace's offset from UTC, and the Ascendant is the one for latitude 0, longitude 0.
- Date, time and city: the library reads the time in the city's timezone and computes the Ascendant for that place.

The city field suggests places from OpenStreetMap's Nominatim service as you type (from the second letter, after a 500 ms pause), so the typed text leaves the browser. Picking a suggestion stores its latitude and longitude; typed text alone sets no location.

The info panel lists the signs both charts share first, with each chart's placements, then each chart's own signs, then the aspects. Each placement shows the body's glyph and its degree within the sign, with ℞ for a retrograde planet. Hovering over a key shows its note, octave, ruler, oscillator and Cousto offset, plus any chart placements.

### Degree detune

Where a body sits inside its sign retunes that sign's voice by `(degree - 15) × 100 / 30` cents. A body at 0° plays 50 cents flat, one at 15° plays in tune, and one near 30° plays almost 50 cents sharp. This replaces the Cousto offset for every sign the chart contains. When several bodies share a sign, the first in this order sets the tuning: Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, Chiron, then the Ascendant. Two people with the Sun in the same sign therefore hear two tunings of one note, set by where each Sun sits.

### Two charts

Both charts sound at once. Chart A plays on bank A and Chart B on bank B, so a sign in both charts starts two voices of the same note, each tuned by its own chart. The gap between the two tunings is heard as beating. Keys that both charts share pulse amber and teal.

Play starts every sign the charts contain, in key order from C to B, spaced by the STGR knob (0.06 s by default). Pause releases every voice. The keys still work by hand while charts are loaded (see [Keyboard](#keyboard)).

### Transits

Each chart header has a `now` button that fills in the current date and time. A birth chart in A against the current sky in B is then a transit reading, the astrological term for comparing the two. The button asks the browser for your location. If you allow it, the chart uses your coordinates, which fixes the timezone and gives your own Ascendant, and the city field shows the place name from a Nominatim reverse lookup of those coordinates. If you decline, the fields fill with the current UTC date and time at latitude 0, longitude 0. The planets are then right for the moment, and the Ascendant is the one for that point on the equator. Pressing `now` again later gives a different chart, because the sky has moved.

### Aspects

Aspects are the angles between two bodies. The app uses the five major ones: conjunction ☌ (0°), opposition ☍ (180°), trine △ (120°), square □ (90°) and sextile ⚹ (60°). Within one chart the library finds them with its own default orbs, the allowed error around each angle: 8° for conjunction, opposition and trine, 7° for square and 6° for sextile (read from `circular-natal-horoscope-js` 1.1.0). Across two charts, `computeSynastryAspects` measures the angles from the ecliptic longitudes itself, with tighter orbs: 6° for conjunction and opposition, 5° for trine and square, 4° for sextile. The info panel lists both kinds with their orbs.

Aspects change the sound:

- A trine or sextile raises the velocity of the voices at both ends by 3%, and a conjunction by 4%. The total lift per voice stops at 10%.
- A square or opposition makes the pair beat. When a voice starts while its tense partner is already sounding, it plays 4 cents sharp of its chart tuning, and the beating also runs through the Chebyshev stage's intermodulation. When Play starts both voices together, the later sign in key order takes the shift.

The amounts are the `aspect*` keys in `TUNING`. The preset files carry their own values, for example 7 cents of tension in `harmonic-furnace.js` and 3 cents in `glass-meridian.js`.

### Orbit

Orbit replaces the sustained chord with cycles. Each voice a chart contains swells and fades on a cycle derived from its ruling planet's orbital period, mapped on a log scale into 16 to 88 seconds by `orbitPeriodSeconds` in `src/astro.js`.

| Ruler   | Orbital period (days) | Cycle (s) | Signs               |
| ------- | --------------------- | --------- | ------------------- |
| Moon    | 27.32                 | 16.0      | Cancer              |
| Mercury | 87.97                 | 22.3      | Gemini, Virgo       |
| Venus   | 224.7                 | 29.2      | Taurus, Libra       |
| Sun     | 365.25                | 33.5      | Leo                 |
| Mars    | 686.98                | 40.1      | Aries, Scorpio      |
| Jupiter | 4332.59               | 67.9      | Sagittarius, Pisces |
| Saturn  | 10759.22              | 88.0      | Capricorn, Aquarius |

The cycle lengths are computed from that function with the default `orbitPeriodMin` and `orbitPeriodMax`. Each voice holds for 45% of its cycle. Start times are spread by the golden ratio (0.618) across up to 80% of each cycle, so the voices do not start together. This is the Cousto idea applied to time: planetary periods become rhythm. Orbit needs a chart. It uses each voice's chart tuning and aspect velocity, but not the tension shift. Pressing Orbit again, Play or Pause stops the cycles.

## Controls

The interface lives in [`src/App.jsx`](../src/App.jsx). A short guide headed "what am I hearing?" sits between the charts and the controls panel and explains the mapping in plain language.

### Keyboard

Twelve keys are laid out like one octave of a piano, one per sign, from Aquarius on C to Capricorn on B. Click or tap a key to start its voice, and again to release it. With no chart entered, a key plays on bank A. With charts entered, it plays on every bank whose chart contains that sign, and on bank A if neither does. The QWERTY row `a w s e d f t g y h u j` plays the keys piano-style: a is C, w is Db, s is D, and so on up to j for B. The white keys show their letter on devices with a mouse.

Each sounding voice lights a glow on a canvas behind its key, in one of four colours from its sign's palette. The glow follows the voice's envelope, running about a third faster than the sound, and the drawing loop runs only while something sounds.

### Knobs

The controls panel holds 39 knobs. Drag a knob up or down to turn it, hold Shift while dragging for fine control, and double-click to reset it. A focused knob also answers the arrow keys (2% of its range per press, 0.2% with Shift) and the scroll wheel.

| Group      | Knobs                                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| Oscillator | HARM (AM and FM harmonicity, the modulator to carrier ratio), MOD (FM modulation index), SPRD (fat detune spread in cents), STGR (stagger between voices on Play, in seconds) |
| Envelope   | ATK, DEC, SUS, REL (each multiplied by the sign's planetary factor)                                            |
| Vibrato    | RATE, DPTH, MIX                                                                                                |
| Pan        | RATE, WDTH (the pan LFOs)                                                                                      |
| Echo       | TIME, FDBK, MIX, FILT                                                                                          |
| EQ         | LOW, MID, HIGH, HI x (the high band's crossover)                                                               |
| Chebyshev  | ORD, MIX                                                                                                       |
| Distortion | DRIV, MIX                                                                                                      |
| Reverb     | ROOM, DAMP, MIX, MOD (damping sweep rate), AMT (damping sweep depth)                                           |
| Chorus     | RATE, DLY, DPTH, MIX                                                                                           |
| Phaser     | RATE, OCT, BASE, Q, MIX                                                                                        |

### Buttons

- **Play** and **Pause** share one button, which appears under the charts with **Orbit** once a chart places a planet. See [Two charts](#two-charts) and [Orbit](#orbit).
- **look within**, the dotted block under the guide, opens and closes the controls panel. Every control below lives there.
- **eclipse** ramps the effects toward extreme settings over 16 seconds: echo feedback 0.87, echo mix 0.86, reverb mix 0.85, Chebyshev mix 0.85, vibrato depth 0.72 at 0.06 Hz, and faster, wider panning (0.18 Hz, depth 0.55). Fat voices widen their spread by 4 cents every 0.2 s up to 120 cents. Every voice's tuning also drifts at random within 15 cents of its Cousto offset, which overrides chart tuning while Eclipse is on. Pressing it again ramps the effects back to the knob settings over 16 seconds and resets spread and tuning at once; sounding chart voices keep their Cousto offset until they restart.
- **dynamic**, the oscillator button, cycles every voice's oscillator: dynamic (each sign plays its ruling planet's type), then fatsine, amsine, fattriangle, amtriangle, fmtriangle, fatsawtooth, fmsine and fatsquare, and back to dynamic. The label shows the current choice. A change applies at once if a bank A voice is sounding, or else with the next note. Pressing it also ends Eclipse.
- **randomize** sets every knob to a random point along its own scale.
- The chain pills switch between the seven chains, also while the sound plays.
- The Listen pills pick a monitor EQ for the playback device, as low, mid and high gains with crossovers at 400 Hz and 2.5 kHz. On load the app picks one from the screen: Phone for a narrow touch screen, Laptop for a tablet-sized touch screen, and HP otherwise.

  | Preset     | Low   | Mid   | High  |
  | ---------- | ----- | ----- | ----- |
  | HP         | −2 dB | 0 dB  | +1 dB |
  | Laptop     | +6 dB | +2 dB | +3 dB |
  | Phone      | +4 dB | +3 dB | +2 dB |
  | Big System | +3 dB | −2 dB | 0 dB  |

- **midi** cycles through your MIDI outputs: off, each output in turn, then off again. The first press asks for MIDI access, and the pill is hidden in browsers without Web MIDI. Bank A's voices, including keys played by hand, go out on channels 1 to 12, one per sign in key order. Before each note the voice's detune goes out as pitch bend, which assumes a bend range of 2 semitones on the receiving synth. Bank B stays in the browser, because 24 voices would not fit 16 MIDI channels without clashes.
- **Save** downloads the state as `celezdial-snapshot-<timestamp>.json`, and **Load** reads such a file back. See [Snapshots and links](#snapshots-and-links).
- **Link** writes the state into the page URL and copies the URL.
- **Record** captures the end of the chain, the same signal the speakers get, and downloads it as `celezdial-<timestamp>.webm` when you press **Stop**. It appears only where the browser has MediaRecorder, and the file keeps the browser's default recording format whatever its name says.
- **Perform** goes fullscreen with only the keyboard and its glow. The ✕ button or leaving fullscreen (Esc) ends it.

## Snapshots and links

A snapshot ([`src/snapshot.js`](../src/snapshot.js), format `v14`) is a JSON object holding the knob values, which keys each bank has sounding, the chain, the oscillator mode, the listening preset, the Eclipse and Orbit switches, and both charts' date, time, city and coordinates. The parser also accepts the older v12 shape.

Load and Link restore the knobs (clamped to their ranges), the chain, the oscillator mode, the listening preset and both charts' inputs. They leave playback off. The sounding keys and the Eclipse and Orbit switches are saved but not restored, so Play or Orbit makes the first sound.

Link encodes the same state, without the file's name and timestamp, as base64url in the URL fragment, the part after `#` (here `#s=...`). Numbers are rounded to four significant digits to keep the URL short. Browsers do not send the fragment to the web server, so birth data in a link goes only where you send the link. Opening a link restores the state silently. Several devices can open the same link, and each then plays on its own, with no sync between them.

## Changing the sound in code

Most of the numbers that shape the sound live in `src/tuning.js`: `TUNING` (effect defaults, envelope, aspect and orbit settings), `OSC_TYPES`, `SHADOW` (the Eclipse targets), `KNOB_DEFS`, `KNOB_GROUPS`, `LISTEN_PRESETS`, `CHAINS`, `ACTIVE_CHAIN`, `OCTAVE_GAIN`, `SIGN_RULERS`, `PLANETARY_CHARACTER`, `ASPECTS` and `PLANET_ORBIT_DAYS`. Change a value and reload the page to hear it. The per-sign data (note, octave, velocity, Cousto offset, pan and colours) lives in [`src/signs.js`](../src/signs.js).

Some entries have no effect. `ZODIAC_NOTES` and `COUSTO_DETUNE` are reference tables that no code reads. The `orb` values in `ASPECTS` are unused, because within-chart aspects use the library's own orbs, and `TUNING.retriggerGap` is unused too.

The five files in `src/presets/` (deep-space-oracle, glass-meridian, harmonic-furnace, tape-seance and zodiac) are alternative tuning profiles from an older layout of `tuning.js`. Each exports `TUNING`, `SHADOW`, `MACROS`, `LISTEN_PRESETS`, `CHAINS` and `ACTIVE_CHAIN`. That covers five of the sixteen names the app imports from `tuning.js`, so copying a preset over `src/tuning.js` breaks the build. With `glass-meridian.js` copied in, `vite build` stops at `"PLANETARY_CHARACTER" is not exported by "src/tuning.js"`. To use a preset, carry its values across by hand. Each one pins a 16 kHz sample rate and names its own default chain.
