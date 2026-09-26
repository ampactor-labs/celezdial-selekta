# Controls

Audio starts on the first click or key press, because browsers block sound
until the page gets a user gesture.

## Keyboard

Twelve zodiac keys in chromatic order, C to B. Click a key to toggle its voice
on or off. The QWERTY row `awsedftgyhuj` mirrors the keys piano-style (a = C,
w = Db, s = D, and so on to j = B), and each key shows its letter. Typing in a
text or date field does not trigger notes. Hovering a key shows its note,
ruler, oscillator, Cousto offset and any chart placements.

## Charts

Each chart takes a birth date, a time and a birth city, and has a **now**
button that fills in the current sky. Once a chart has data, a **Play** button
(it reads **Pause** while voices sound) and an **Orbit** button appear under
the charts. See [ASTROLOGY.md](ASTROLOGY.md).

## The veil

The dotted "look within" block near the bottom of the page opens the Controls
veil. It holds everything else.

**Eclipse** turns chaos mode on and off; see [FX.md](FX.md#eclipse).

**The oscillator button** is labelled `dynamic` at first, which means each sign
uses its ruling planet's oscillator. Each press switches every voice to one
shared type, in this order: fatsine, amsine, fattriangle, amtriangle,
fmtriangle, fatsawtooth, fmsine, fatsquare, then back to `dynamic`.

**Randomize** sets every knob to a random value within its range.

**Knobs**: drag up or down to turn, shift-drag for fine control, double-click to
reset. A focused knob also answers the arrow keys (2% of its range per step,
0.2% with shift) and the scroll wheel.

| Group      | Knobs                                                                              |
| ---------- | ---------------------------------------------------------------------------------- |
| Oscillator | HARM (AM and FM harmonicity), MOD (FM modulation index), SPRD (fat detune in cents), STGR (Play stagger) |
| Envelope   | ATK, DEC, SUS, REL (each multiplied per sign by its planet's factor)               |
| Vibrato    | RATE, DPTH, MIX                                                                    |
| Pan        | RATE, WDTH                                                                         |
| Echo       | TIME, FDBK, MIX, FILT                                                              |
| EQ         | LOW, MID, HIGH, HI x (high-band crossover)                                         |
| Chebyshev  | ORD, MIX                                                                           |
| Distortion | DRIV, MIX                                                                          |
| Reverb     | ROOM, DAMP, MIX, MOD (damping sweep rate), AMT (damping sweep depth)               |
| Chorus     | RATE, DLY, DPTH, MIX                                                               |
| Phaser     | RATE, OCT, BASE, Q, MIX                                                            |

That is 39 knobs, each mapped to one engine parameter. Ranges and defaults are
in `KNOB_DEFS` in `src/tuning.js`.

**Chains**: a row of pills that switches between seven effect orders while
sound plays; see [FX.md](FX.md#the-chains).

**Listen**: monitor EQ presets for headphones, laptop speakers, phone and a big
speaker system. On load the app picks one with `matchMedia`: phone for a narrow
touch screen, laptop for a tablet-sized touch screen, headphones otherwise.

**MIDI**: a pill that cycles through your MIDI outputs and back to off. It is
hidden where the browser has no Web MIDI. Chart A's voices (and keys played
without a chart) go out on channels 1 to 12, one channel per sign, with each
voice's detune sent as pitch bend (assuming a ±2 semitone bend range). Bank B
stays in the browser, because 24 voices do not fit into 16 MIDI channels one
per voice.

**Save** downloads a `.json` snapshot of the sound state: all knob values, both
banks' active signs, chain, oscillator type, listen preset, Eclipse, Orbit, and
both charts' birth inputs. **Load** reads one back.

**Link** copies a URL that carries the same state in its fragment (the part
after `#`). Browsers do not send the fragment to the server, so birth data in a
link stays out of server requests. Opening the link restores the state without
sound; Play is the first sound.

Loading a snapshot or a link restores the knobs, chain, oscillator type, listen
preset and both charts' inputs. It does not restart the active keys, Eclipse or
Orbit, even though the snapshot records them.

**Record** taps the end of the chain, the same signal the speakers get, and
downloads a `.webm` file when you press Stop. It appears only where the browser
has `MediaRecorder`.

**Perform** goes fullscreen and shows only the keyboard and the animated
background. The ✕ button or Esc leaves it.
