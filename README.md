# Celezdial Selekta

An ambient synthesizer for the browser that maps the twelve zodiac signs to twelve voices on a piano-style keyboard, C through B. Each voice is detuned toward a pitch derived from its ruling planet's orbit, and all voices are summed before one waveshaper (a curve that bends the waveform) so it adds sum and difference tones between the notes. Enter one or two birth dates and every planet lights its sign's key, retuned by its degree within the sign. It is built with React and Tone.js.

**Status: working.** It is deployed and runs end to end, but the v14 snapshot format may still change and many voices at once are heavy on older phones.

Live: https://ampactor.dev/celezdial-selekta/

## Quick start

Try it at the live link, or run it locally with Node.js and npm (CI builds with Node 22):

```sh
npm install
npm run dev
```

Vite serves the app at `http://localhost:3000/celezdial-selekta/` and opens it in your browser. Click or tap any key: the first gesture starts the audio engine, and the voice fades in over 1.7 to 4.2 seconds depending on its sign. To hear a birth chart, enter a date under Chart A and press Play. The knobs, effect chains, listening presets and file actions sit behind the dotted "look within" block, and a short guide on the page explains what you are hearing.

## How it works

The app is polyphonic: many notes can sound at once. It builds 24 Tone.js synth voices, one per sign in each of two banks, so Chart A and Chart B can each sound all twelve signs. `src/App.jsx` holds the interface and starts and stops voices. `src/astro.js` turns birth data into signs to sound, and `src/engine.js` builds the audio graph. Most numbers that shape the sound live in `src/tuning.js`, and the per-sign data lives in `src/signs.js`. All voices run through one effects chain:

```text
24 voices -> panners -> sum bus -> high-pass (35 Hz) -> vibrato -> echo
  -> 3-band EQ -> Chebyshev waveshaper -> [distortion] -> reverb -> chorus
  -> [phaser] -> listening EQ -> soft clip -> speakers and recorder
```

This is the default `zodiac` order. Bracketed stages join the path only when their mix knob is above zero, and six other orders can be swapped in live. Three decisions shaped the sound.

### Sum before saturation

The voices meet on one bus before the Chebyshev waveshaper. On a single sine wave, the order-2 Chebyshev curve produces the octave above. On a sum of notes it also multiplies the notes together, which adds sum and difference tones between them, so the chord makes tones of its own. Order 3 adds odd harmonics that sound harsh on dense chords, so the default is order 2 at a 25% mix.

### Planetary tuning

Each sign's note follows Lionel Williams' chromatic calendar, which lays the zodiac year over one octave: Aquarius is C, and Aries, the spring equinox, is D. The notes spread over three octaves in groups a minor third apart, so no two notes in one octave are closer than three semitones. Each voice is then microtuned (moved between the twelve standard pitches) toward its ruling planet's tone in Hans Cousto's cosmic octave, which shifts orbital periods up by octaves until they can be heard. The offsets play at half strength, from −12.5 to +19 cents (hundredths of a semitone), to keep the planetary colour without quarter-tone clashes.

### Natal-chart mode

A natal chart records where the Sun, Moon and planets stood at a moment of birth. The `circular-natal-horoscope-js` library computes it in the browser, and each body lights the key of its sign. The body's degree within the sign replaces the Cousto offset with −50 to +50 cents. Chart B plays on the second bank, so a sign both charts share sounds two tunings of one note at once, heard as beating. Aspects (the angles between planets) make voices louder or pull pairs slightly out of tune, and Orbit mode swells each voice on a cycle set by its ruler's orbital period, from 16 s for the Moon to 88 s for Saturn.

[docs/DESIGN.md](docs/DESIGN.md) has the rest: the settings of every stage, tables for all twelve voices, the eight chain orders, the chart features and a reference for every control.

## Project layout

```text
src/
  App.jsx        interface: keyboard, charts, knobs, canvas glow
  engine.js      Tone.js audio graph, chain wiring, knob-to-parameter map
  tuning.js      sound-shaping numbers: effects, knobs, chains, rulers, aspects
  signs.js       the twelve voices: note, octave, velocity, tuning, pan, colours
  astro.js       chart computation, aspects, orbit periods
  snapshot.js    snapshot format and share-link codec
  midi.js        Web MIDI output
  utils.js       colour, formatting and knob-geometry helpers
  presets/       five older tuning profiles (see Limitations)
  __tests__/     Vitest suites
public/fonts/    the Spiral ST title font
docs/DESIGN.md   design notes and the full controls reference
```

## Deploy

GitHub Pages serves the site at https://ampactor.dev/celezdial-selekta/. Every push to `main` runs [.github/workflows/deploy.yml](.github/workflows/deploy.yml), which installs with `npm ci` on Node 22, runs `npm run build` and publishes the `build/` folder. The workflow can also be started by hand. Vite builds with the base path `/celezdial-selekta/` ([vite.config.js](vite.config.js)), so the built files expect to be served from that path.

## Testing

```sh
npm test
```

This runs Vitest over the five files in `src/__tests__/`. The summary reports 110 tests, all passing:

- `astro.test.js` (17 tests): angular distance, cross-chart aspects and their orbs, how aspects become loudness boosts and tension partners, orbit periods, and one real chart (the Sun on 2000-01-01 lands in Capricorn with a plausible detune).
- `snapshot.test.js` (7): the snapshot round trip, the older v12 shape, malformed input, and the share-link codec with its number rounding and non-ASCII city names.
- `tuning.test.js` (10): knob defaults inside their ranges, required fields, chain definitions, the sign-ruler table and the sample-rate setting.
- `presets.test.js` (41): each file in `src/presets/` exports the six names the test expects and names a chain it defines.
- `utils.test.js` (35): colour conversion, value formatting, logarithmic and stepped knob scales, and knob arc geometry.

`npm run lint` runs ESLint over `src/` and passes with no warnings. CI runs neither command: [deploy.yml](.github/workflows/deploy.yml) only builds and deploys. No test covers the audio engine, the interface, MIDI, recording or the sign table in `src/signs.js`, and nothing checks how it sounds, which is still done by ear.

## Limitations

The full instrument is heavy for a phone. Two charts can sound 24 synth voices at once, twelve per chart. Every voice feeds one effects chain, nine stages long in the default order, and the chain keeps running between notes. Nothing scales the quality down automatically when a device falls behind, so on an older phone you have to sound fewer keys yourself.

- Mid-range Android phones glitched until the engine switched to the device's native sample rate (commit `89e3feb`). This repository keeps no measurements of phone performance.
- Tone.js schedules every note 300 ms ahead, so a key sounds about 300 ms after you press it, plus the device's own output latency. MIDI notes go out at once and lead the browser's own sound by that much. A main-thread stall longer than the look-ahead makes notes late.
- In the first bank, each voice's own pan position is lost: connecting an LFO (a low-frequency oscillator, used as a slow automatic knob) to a Tone.js parameter resets the parameter to zero (`connectSignal` in Tone.js 14.7.77). The four pan groups also move in step. [docs/DESIGN.md](docs/DESIGN.md#stereo-placement) has the detail.
- Load and Link restore the knobs, chain, oscillator mode, listening preset and both charts, and leave playback off. The keys that were sounding and the Eclipse and Orbit switches are saved in the file but not restored.
- A chart gets coordinates only from a picked city suggestion or the `now` button. Without them it is cast at latitude and longitude 0, where the time is read as UTC. The chart is then off by the birthplace's offset from UTC, and the Ascendant (rising sign) is the one for that point.
- The city field sends what you type to OpenStreetMap's Nominatim service, and the `now` button sends your coordinates there to name the place. Chart math runs in the browser, and a share link keeps its state in the URL fragment, which browsers do not send to the web server.
- MIDI out carries only the first bank (Chart A, and keys played outside any chart). It needs a browser with Web MIDI and assumes a pitch-bend range of 2 semitones on the receiving synth.
- A recording keeps the browser's default MediaRecorder format, but the file is always named `.webm`.
- The five profiles in `src/presets/` follow an older layout of `src/tuning.js`, so copying one over it breaks the build. Some settings in `tuning.js` have no effect: `ZODIAC_NOTES`, `COUSTO_DETUNE`, the `orb` values in `ASPECTS` and `retriggerGap`. The `custom` chain appears in no menu.

## License

No license chosen yet. The Spiral ST title font in `public/fonts/spiral-st/` comes with its own terms, the 1001Fonts Free For Commercial Use License in [1001fonts-spiral-st-eula.txt](public/fonts/spiral-st/1001fonts-spiral-st-eula.txt).
