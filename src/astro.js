// Chart computation — the bridge between circular-natal-horoscope-js
// and the instrument. Everything here is UI-free and engine-free:
// birth data in, activations/bodies/aspects out.

import { TUNING, ASPECTS, PLANET_ORBIT_DAYS } from "./tuning";
import { SIGNS_BY_LOWERCASE } from "./signs";

let _horoscopeModule = null;
export async function getHoroscope() {
  if (!_horoscopeModule) {
    _horoscopeModule = await import("circular-natal-horoscope-js");
  }
  return _horoscopeModule;
}

const BODY_MAP = {
  Sun: "sun",
  Moon: "moon",
  Mercury: "mercury",
  Venus: "venus",
  Mars: "mars",
  Jupiter: "jupiter",
  Saturn: "saturn",
  Uranus: "uranus",
  Neptune: "neptune",
  Pluto: "pluto",
  Chiron: "chiron",
};

// Labels whose aspects we voice — bodies plus the Ascendant.
const VOICED_LABELS = new Set([...Object.keys(BODY_MAP), "Ascendant"]);

// Pure chart computation — reused for Chart A, Chart B, and transits.
// Returns { activations, bodies, aspects, hasTime } or null without a date.
// bodies[label] = { sign, degree (0–30 within sign), longitude (0–360) }.
// aspects = within-chart majors from the library, filtered to voiced labels.
export async function computeChart(date, time, lat, lng) {
  if (!date) return null;

  const { Origin, Horoscope } = await getHoroscope();

  const [year, month, day] = date.split("-").map(Number);
  let hour = 12,
    minute = 0;
  if (time) {
    [hour, minute] = time.split(":").map(Number);
  }

  const latitude = parseFloat(lat) || 0;
  const longitude = parseFloat(lng) || 0;

  const origin = new Origin({
    year,
    month: month - 1,
    date: day,
    hour,
    minute,
    latitude,
    longitude,
  });

  const chart = new Horoscope({
    origin,
    houseSystem: "whole-sign",
    zodiac: "tropical",
    aspectPoints: ["bodies", "points", "angles"],
    aspectWithPoints: ["bodies", "points", "angles"],
    aspectTypes: ["major"],
    language: "en",
  });

  const activations = {};
  const bodies = {};

  for (const [label, bodyKey] of Object.entries(BODY_MAP)) {
    const body = chart.CelestialBodies[bodyKey];
    if (!body) continue;
    const signName = body.Sign.label;
    const signKey = SIGNS_BY_LOWERCASE[signName.toLowerCase()];
    if (!signKey) continue;
    const absolute = body.ChartPosition.Ecliptic.DecimalDegrees;
    const degree = absolute % 30;
    const detune = (degree - 15) * TUNING.centsPerDegree;
    if (!activations[signKey])
      activations[signKey] = { planets: [], detuneCents: detune };
    activations[signKey].planets.push(label);
    bodies[label] = {
      sign: signKey,
      degree,
      longitude: absolute,
      retro: !!body.isRetrograde,
    };
  }

  if (time && chart.Ascendant?.Sign) {
    const ascSign = chart.Ascendant.Sign.label;
    const ascKey = SIGNS_BY_LOWERCASE[ascSign.toLowerCase()];
    if (ascKey) {
      const absolute = chart.Ascendant.ChartPosition.Ecliptic.DecimalDegrees;
      const degree = absolute % 30;
      const detune = (degree - 15) * TUNING.centsPerDegree;
      if (!activations[ascKey])
        activations[ascKey] = { planets: [], detuneCents: detune };
      activations[ascKey].planets.push("Ascendant");
      bodies["Ascendant"] = { sign: ascKey, degree, longitude: absolute };
    }
  }

  const aspects = (chart.Aspects?.all || [])
    .filter(
      (a) => VOICED_LABELS.has(a.point1Label) && VOICED_LABELS.has(a.point2Label),
    )
    .map((a) => ({
      p1: a.point1Label,
      p2: a.point2Label,
      key: a.aspectKey,
      orb: Math.abs(a.orb ?? 0),
    }));

  return { activations, bodies, aspects, hasTime: !!time };
}

// Shortest angular distance between two ecliptic longitudes, 0–180.
export function angularDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// Cross-chart (synastry) aspects — the library only aspects within one
// chart, so the relationship between two charts is computed here.
// bodiesA/bodiesB are computeChart body maps. Tighter synOrb applies.
export function computeSynastryAspects(bodiesA, bodiesB) {
  const found = [];
  for (const [labelA, a] of Object.entries(bodiesA || {})) {
    if (a?.longitude == null) continue;
    for (const [labelB, b] of Object.entries(bodiesB || {})) {
      if (b?.longitude == null) continue;
      const dist = angularDistance(a.longitude, b.longitude);
      for (const [key, def] of Object.entries(ASPECTS)) {
        const orb = Math.abs(dist - def.angle);
        if (orb <= def.synOrb) {
          found.push({ p1: labelA, p2: labelB, key, orb });
          break; // one aspect per pair — majors don't overlap within orb
        }
      }
    }
  }
  return found.sort((x, y) => x.orb - y.orb);
}

// Fold aspects into per-voice modifiers. Returns per-bank maps:
//   mods.A[sign] = { boost, tense: [{ sign, bank }] }
// boost lifts trigger velocity (capped); tense lists partner voices that,
// when already sounding, pull this voice aspectTensionCents off its natal
// detune — square/opposition heard as beating roughness.
export function aspectVoiceMods({ aspectsA, aspectsB, synastry, bodiesA, bodiesB }) {
  const mods = { A: {}, B: {} };
  const entry = (bank, sign) =>
    (mods[bank][sign] ??= { boost: 0, tense: [] });

  const fold = (aspects, bodies1, bank1, bodies2, bank2) => {
    for (const a of aspects || []) {
      const s1 = bodies1?.[a.p1]?.sign;
      const s2 = bodies2?.[a.p2]?.sign;
      if (!s1 || !s2) continue;
      const q = ASPECTS[a.key]?.quality;
      if (q === "consonant") {
        entry(bank1, s1).boost += TUNING.aspectConsonantBoost;
        entry(bank2, s2).boost += TUNING.aspectConsonantBoost;
      } else if (q === "focal") {
        entry(bank1, s1).boost += TUNING.aspectFocalBoost;
        entry(bank2, s2).boost += TUNING.aspectFocalBoost;
      } else if (q === "tense") {
        // same-voice pairs can't tension against themselves
        if (s1 === s2 && bank1 === bank2) continue;
        entry(bank1, s1).tense.push({ sign: s2, bank: bank2 });
        entry(bank2, s2).tense.push({ sign: s1, bank: bank1 });
      }
    }
  };

  fold(aspectsA, bodiesA, "A", bodiesA, "A");
  fold(aspectsB, bodiesB, "B", bodiesB, "B");
  fold(synastry, bodiesA, "A", bodiesB, "B");

  for (const bank of ["A", "B"]) {
    for (const m of Object.values(mods[bank])) {
      m.boost = Math.min(m.boost, TUNING.aspectBoostCap);
    }
  }
  return mods;
}

// Orbit mode period for a ruling planet: orbital days log-mapped from the
// traditional-ruler range (Moon..Saturn) into orbitPeriodMin..Max seconds.
export function orbitPeriodSeconds(planet) {
  const days = PLANET_ORBIT_DAYS[planet] ?? PLANET_ORBIT_DAYS.Sun;
  const lo = Math.log(PLANET_ORBIT_DAYS.Moon);
  const hi = Math.log(PLANET_ORBIT_DAYS.Saturn);
  const t = Math.min(1, Math.max(0, (Math.log(days) - lo) / (hi - lo)));
  return (
    TUNING.orbitPeriodMin *
    Math.pow(TUNING.orbitPeriodMax / TUNING.orbitPeriodMin, t)
  );
}
