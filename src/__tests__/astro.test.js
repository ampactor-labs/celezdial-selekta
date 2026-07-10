import { describe, it, expect } from "vitest";
import {
  computeChart,
  computeSynastryAspects,
  angularDistance,
  aspectVoiceMods,
  orbitPeriodSeconds,
} from "../astro.js";
import { TUNING, ASPECTS, PLANET_ORBIT_DAYS } from "../tuning.js";

describe("angularDistance", () => {
  it("wraps around the zodiac", () => {
    expect(angularDistance(350, 10)).toBe(20);
    expect(angularDistance(10, 350)).toBe(20);
    expect(angularDistance(0, 180)).toBe(180);
    expect(angularDistance(90, 90)).toBe(0);
  });
});

describe("computeSynastryAspects", () => {
  const bodyAt = (sign, longitude) => ({ sign, degree: longitude % 30, longitude });

  it("detects exact majors across charts", () => {
    const a = { Sun: bodyAt("Capricorn", 280) };
    const b = {
      Moon: bodyAt("Taurus", 40), // 240 apart → 120 → trine
      Mars: bodyAt("Aries", 10), // 270 apart → 90 → square
      Venus: bodyAt("Capricorn", 282), // 2 apart → conjunction
    };
    const found = computeSynastryAspects(a, b);
    const byPair = Object.fromEntries(found.map((x) => [`${x.p1}-${x.p2}`, x]));
    expect(byPair["Sun-Moon"].key).toBe("trine");
    expect(byPair["Sun-Mars"].key).toBe("square");
    expect(byPair["Sun-Venus"].key).toBe("conjunction");
    expect(byPair["Sun-Venus"].orb).toBeCloseTo(2);
  });

  it("sorts by orb and ignores non-aspects", () => {
    const a = { Sun: bodyAt("Aries", 0) };
    const b = {
      Moon: bodyAt("Taurus", 45), // 45° — no major aspect
      Mars: bodyAt("Cancer", 91), // square, orb 1
      Venus: bodyAt("Leo", 120.5), // trine, orb 0.5
    };
    const found = computeSynastryAspects(a, b);
    expect(found.map((x) => x.p2)).toEqual(["Venus", "Mars"]);
  });

  it("respects the tighter synastry orb", () => {
    const a = { Sun: bodyAt("Aries", 0) };
    const wide = ASPECTS.sextile.synOrb + 0.5;
    const b = { Moon: bodyAt("Gemini", 60 + wide) };
    expect(computeSynastryAspects(a, b)).toEqual([]);
  });

  it("handles empty or missing charts", () => {
    expect(computeSynastryAspects({}, {})).toEqual([]);
    expect(computeSynastryAspects(null, undefined)).toEqual([]);
  });
});

describe("aspectVoiceMods", () => {
  const bodies = {
    Sun: { sign: "Leo", degree: 10, longitude: 130 },
    Moon: { sign: "Sagittarius", degree: 10, longitude: 250 },
    Mars: { sign: "Scorpio", degree: 10, longitude: 220 },
  };

  it("boosts both ends of a consonant aspect", () => {
    const mods = aspectVoiceMods({
      aspectsA: [{ p1: "Sun", p2: "Moon", key: "trine", orb: 0 }],
      aspectsB: [],
      synastry: [],
      bodiesA: bodies,
      bodiesB: {},
    });
    expect(mods.A.Leo.boost).toBeCloseTo(TUNING.aspectConsonantBoost);
    expect(mods.A.Sagittarius.boost).toBeCloseTo(TUNING.aspectConsonantBoost);
  });

  it("lists tension partners for squares", () => {
    const mods = aspectVoiceMods({
      aspectsA: [{ p1: "Sun", p2: "Mars", key: "square", orb: 1 }],
      aspectsB: [],
      synastry: [],
      bodiesA: bodies,
      bodiesB: {},
    });
    expect(mods.A.Leo.tense).toEqual([{ sign: "Scorpio", bank: "A" }]);
    expect(mods.A.Scorpio.tense).toEqual([{ sign: "Leo", bank: "A" }]);
  });

  it("caps accumulated boosts", () => {
    const many = Array.from({ length: 10 }, () => ({
      p1: "Sun",
      p2: "Moon",
      key: "trine",
      orb: 0,
    }));
    const mods = aspectVoiceMods({
      aspectsA: many,
      aspectsB: [],
      synastry: [],
      bodiesA: bodies,
      bodiesB: {},
    });
    expect(mods.A.Leo.boost).toBe(TUNING.aspectBoostCap);
  });

  it("skips same-voice tension (conjunction territory)", () => {
    const mods = aspectVoiceMods({
      aspectsA: [{ p1: "Sun", p2: "Sun", key: "square", orb: 0 }],
      aspectsB: [],
      synastry: [],
      bodiesA: bodies,
      bodiesB: {},
    });
    expect(mods.A.Leo?.tense ?? []).toEqual([]);
  });

  it("routes synastry tension across banks", () => {
    const mods = aspectVoiceMods({
      aspectsA: [],
      aspectsB: [],
      synastry: [{ p1: "Sun", p2: "Mars", key: "opposition", orb: 2 }],
      bodiesA: bodies,
      bodiesB: bodies,
    });
    expect(mods.A.Leo.tense).toEqual([{ sign: "Scorpio", bank: "B" }]);
    expect(mods.B.Scorpio.tense).toEqual([{ sign: "Leo", bank: "A" }]);
  });
});

describe("orbitPeriodSeconds", () => {
  it("maps the Moon to the fastest cycle and Saturn to the slowest", () => {
    expect(orbitPeriodSeconds("Moon")).toBeCloseTo(TUNING.orbitPeriodMin);
    expect(orbitPeriodSeconds("Saturn")).toBeCloseTo(TUNING.orbitPeriodMax);
  });

  it("is monotonic across the traditional rulers", () => {
    const rulers = ["Moon", "Mercury", "Venus", "Sun", "Mars", "Jupiter", "Saturn"];
    const periods = rulers.map(orbitPeriodSeconds);
    for (let i = 1; i < periods.length; i++) {
      expect(periods[i]).toBeGreaterThan(periods[i - 1]);
    }
  });

  it("falls back to the Sun for unknown planets", () => {
    expect(orbitPeriodSeconds("Vulcan")).toBeCloseTo(orbitPeriodSeconds("Sun"));
  });

  it("covers every planet in PLANET_ORBIT_DAYS", () => {
    for (const planet of Object.keys(PLANET_ORBIT_DAYS)) {
      const p = orbitPeriodSeconds(planet);
      expect(p).toBeGreaterThanOrEqual(TUNING.orbitPeriodMin);
      expect(p).toBeLessThanOrEqual(TUNING.orbitPeriodMax);
    }
  });
});

describe("computeChart (real ephemeris)", () => {
  it("returns null without a date", async () => {
    expect(await computeChart("", "", null, null)).toBeNull();
  });

  it("places the J2000 Sun in Capricorn with a sane detune", async () => {
    // 2000-01-01 12:00 UT: Sun ≈ 280.5° ecliptic = 10.5° Capricorn.
    // Sign membership is robust to timezone interpretation (Sun moves ~1°/day).
    const chart = await computeChart("2000-01-01", "12:00", 0, 0);
    expect(chart).not.toBeNull();
    expect(chart.bodies.Sun.sign).toBe("Capricorn");
    expect(chart.bodies.Sun.longitude).toBeGreaterThan(278);
    expect(chart.bodies.Sun.longitude).toBeLessThan(283);
    expect(chart.activations.Capricorn.planets).toContain("Sun");
    // degree ~10.5 → (10.5 − 15) × 3.33 ≈ −15¢
    expect(chart.activations.Capricorn.detuneCents).toBeGreaterThan(-25);
    expect(chart.activations.Capricorn.detuneCents).toBeLessThan(-5);
    expect(chart.hasTime).toBe(true);
    // time given → Ascendant computed
    expect(chart.bodies.Ascendant).toBeDefined();
    // aspects come back as majors between voiced labels
    expect(Array.isArray(chart.aspects)).toBe(true);
    for (const a of chart.aspects) {
      expect(ASPECTS).toHaveProperty(a.key);
    }
  });

  it("skips the Ascendant without a birth time", async () => {
    const chart = await computeChart("2000-01-01", "", 0, 0);
    expect(chart.hasTime).toBe(false);
    expect(chart.bodies.Ascendant).toBeUndefined();
  });
});
