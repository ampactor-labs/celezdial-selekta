# Charts, aspects and Orbit

The chart maths is in `src/astro.js`. It takes birth data and returns which
signs to sound, each body's position and the chart's aspects. It does not touch
the UI or the audio engine.

## Birth charts

Enter birth data for up to two people, Chart A and Chart B. Each chart is a
tropical, whole-sign horoscope computed by `circular-natal-horoscope-js`
(tropical means the signs are measured from the spring equinox; whole-sign
means each house is one whole sign). Every body the library returns (Sun, Moon,
Mercury through Pluto, and Chiron) activates the voice of the sign it is in.
With a birth time, the Ascendant (the sign rising on the eastern horizon)
activates its sign too.

Each body's degree within its sign detunes its voice; see
[TUNING.md](TUNING.md#degree-detune-from-a-chart).

Partial data is accepted:

- **Date only**: positions for 12:00 on that day, and no Ascendant.
- **Date and time**: planets and an Ascendant. Without a city the time is read
  at latitude 0, longitude 0, so a local birth time needs the birth city for an
  accurate chart.
- **Date, time and city**: the full chart.

The city field searches OpenStreetMap's Nominatim service as you type and
fills in the coordinates of the place you pick.

## Two charts at once

Both charts sound together. A key plays the voice of each chart that has a body
in that sign. If only Chart A has Aries, one voice sounds. If both do, bank A
and bank B each play Aries, tuned by their own degrees, and you hear the
interval between the two tunings. Keys that both charts share get a breathing
amber and teal glow.

**Play** sounds every chart-active key in keyboard order (C to B), with the
STGR knob setting the gap between entries (0.06 s by default). **Pause**
releases all voices. Clicking a key works at any time: on a chart sign it
toggles that chart's voice (or both charts' voices), and on any other sign it
toggles a bank A voice at its Cousto tuning.

The info panel lists the shared signs first, with both charts' bodies and
degrees, then the signs unique to each chart, then the aspects.

## Transits

Each chart header has a **now** button that fills in the current date and time,
so the chart becomes the sky overhead. With a birth chart in A and now in B,
the comparison shows a transit reading: shared signs glow and the cross-chart
aspects list and sound.

The button asks for your location. The library reads the time fields in the
time zone at the chart's coordinates, so a local clock time at longitude 0
would land hours off. With your location, the chart uses your coordinates and
the city field shows the place name from a Nominatim reverse lookup. If you
decline, the fields fill with the current UTC time at latitude 0, longitude 0:
the planets are right for this moment, and the Ascendant is the one rising at
that point on the equator. The sky moves, so the chord changes from day to
day.

## Aspects

An aspect is a major angle between two bodies: conjunction ☌ (0°), opposition
☍ (180°), trine △ (120°), square □ (90°) and sextile ⚹ (60°). Within each
chart the library finds them with its default orbs (the allowed error). Across
the two charts, `computeSynastryAspects` compares ecliptic longitudes directly,
with tighter orbs:

| Aspect      | Angle | Cross-chart orb |
| ----------- | ----- | --------------- |
| Conjunction | 0°    | 6°              |
| Opposition  | 180°  | 6°              |
| Trine       | 120°  | 5°              |
| Square      | 90°   | 5°              |
| Sextile     | 60°   | 4°              |

Both kinds appear in the info panel and change the sound:

- Each trine or sextile lifts the velocity of both signs involved by 3%.
- Each conjunction lifts it by 4%.
- The total lift per sign is capped at 10%.
- Squares and oppositions detune. When one voice of a tense pair starts while
  the other is already sounding, the newcomer sounds 4 cents off its chart
  tuning, and the beating between the two passes through the Chebyshev
  intermodulation. When Play starts both, the one later in keyboard order
  takes the shift.

The numbers are the `aspect*` keys of `TUNING` in `src/tuning.js`.

## Orbit

Orbit replaces sustained chart voices with cycles. Each chart-active voice
swells and releases on a period taken from its ruling planet's orbital period,
mapped on a log scale from the Moon (27.3 days) to Saturn (10,759 days) onto 16
to 88 seconds (`orbitPeriodMin` and `orbitPeriodMax`). Moon-ruled Cancer
cycles every 16 seconds; Saturn-ruled Capricorn and Aquarius every 88. Each
voice holds for 45% of its cycle (`orbitDuty`). Start times are spread by the
golden ratio so the voices rarely line up, and the chord keeps changing. It is
Cousto's idea applied to rhythm instead of pitch.

Orbit applies the aspect velocity lifts but not the tension detune.
