# Effects chain

The audio graph is built in `src/engine.js`. The order of the effects is data:
each chain in `CHAINS` (`src/tuning.js`) is a list of node names, and the
engine wires them in that order.

## Default signal chain (Zodiac)

```
2 banks × 12 PolySynth (per-sign oscillator type, envelope multipliers, detune)
  → Panners (bank A driven by 4 pan-group LFOs)
  → sumBus                      all voices summed before any saturation
      → Highpass (35 Hz, -12 dB/oct)
      → Vibrato (slow tape wow, 0.08 Hz)
      → Echo (delay → lowpass → tanh saturation → feedback, hand-wired)
      → EQ3 (three-band "tape" EQ)
      → Chebyshev (order 2: even harmonics on the summed voices)
      → [Distortion: bypassed until its mix is raised]
      → Reverb (25 ms pre-delay → Freeverb, room 0.88, damping swept by an LFO)
      → Chorus (on by default, for stereo width)
      → [Phaser: bypassed until its mix is raised]
      → Monitor EQ (listen preset for the playback device)
      → Soft clip (tanh limiter)
      → output, and the recorder tap
```

## Why the voices are summed first

A Chebyshev waveshaper bends the waveform with a polynomial. On a single note
it adds harmonics. On a sum of notes it also creates sum and difference tones
between the partials of different voices (intermodulation), so the chord
colors itself. Order 2 adds even harmonics only, which reads as octave
doubling and warmth. Order 3 creates harsh odd-harmonic intermodulation on
dense material, so the default stays at 2 and the ORD knob goes up to 11.

## Echo loop

The echo is wired by hand so that its feedback path can hold a filter and a
saturator: delay → lowpass (2.8 kHz) → `tanh` saturation → feedback gain → back
into the delay. Each repeat comes back darker
and a little more saturated. The loop gain is feedback × drive (0.35 × 0.6 by
default) and must stay under 1, or quiet signals would grow without end. A
crossfade mixes the dry and wet paths, and an input gain of 0.7 keeps the hot
polyphonic sum from overloading the loop.

## Bypassed nodes

Distortion and phaser start disconnected, because their mix is 0. When you
raise the mix knob above 0 the engine splices the node back in between its
neighbors, and when you lower it to 0 it takes the node out again, which
saves CPU while they are unused.

## The chains

Every chain uses the same nodes; only the order changes.

| Chain     | Order (abbreviated)                              | Character                                                     |
| --------- | ------------------------------------------------ | ------------------------------------------------------------- |
| Zodiac    | vib → echo → eq → cheby → rev → cho              | The default. Balanced: pretty on load, cosmic at the extremes |
| Cathedral | cheby → eq → vib → echo → rev → cho              | Saturation first, warm and thick                              |
| Void      | cheby → dist → eq → vib → rev → pha → echo → cho | Reverb before delay, so echoes repeat an already diffuse tail |
| Furnace   | echo → cheby → dist → eq → vib → rev → cho → pha | Clean echoes re-enter the waveshaper and get dirtier          |
| Tape      | vib → cheby → dist → eq → echo → rev → cho → pha | Pitch drift feeds the saturation, so harmonics shift over time |
| Evolve    | vib → echo → rev → pha → cheby → dist → eq → cho | Space before saturation, so tails grow new harmonics as they decay |
| Glass     | eq → vib → echo → rev → cho → pha                | No saturation at all                                          |
| Custom    | every node, in an order to edit by hand          | A scratch chain for experiments                               |

Every chain ends with the monitor EQ and the soft clip, except Custom, whose
listed order puts the reverb after the soft clip.

The veil's chain pills switch between the first seven while sound plays. The
engine fades the summing bus out over 80 ms, tears down the chain-level
connections, rewires them in the new order and fades back in. Custom has no
pill: select it by setting `ACTIVE_CHAIN` in `src/tuning.js`, or by loading a
snapshot whose `chain` is `"custom"`.

## Eclipse

Eclipse is a chaos mode. Turning it on ramps these parameters toward the
`SHADOW` targets in `src/tuning.js` over 16 seconds:

| Parameter        | Default | Eclipse target |
| ---------------- | ------- | -------------- |
| Reverb mix       | 0.45    | 0.85           |
| Echo feedback    | 0.35    | 0.87           |
| Echo mix         | 0.22    | 0.86           |
| Vibrato depth    | 0.15    | 0.72           |
| Vibrato rate     | 0.08 Hz | 0.06 Hz        |
| Chebyshev mix    | 0.25    | 0.85           |
| Pan LFO rate     | 0.03 Hz | 0.18 Hz        |
| Pan LFO width    | 0.28    | 0.55           |

It also widens the spread of the fat oscillators by 4 cents every 0.2 s up to
120 cents, and every 1.2 s moves each voice's detune toward a random point
within 15 cents of its Cousto offset. Turning Eclipse off ramps everything
back to the current knob values over 16 seconds and resets spread and detune.
Pressing the oscillator button while Eclipse is on also ends it.
