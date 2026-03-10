import { describe, it, expect } from "vitest";
import {
  TUNING,
  KNOB_DEFS,
  KNOB_GROUPS,
  SIGN_RULERS,
  CHAINS,
  ACTIVE_CHAIN,
} from "../tuning.js";

const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

describe("TUNING", () => {
  it("has numeric fields", () => {
    expect(typeof TUNING.sampleRate).toBe("number");
    expect(typeof TUNING.attack).toBe("number");
    expect(typeof TUNING.decay).toBe("number");
    expect(typeof TUNING.sustain).toBe("number");
    expect(typeof TUNING.release).toBe("number");
  });

  it("sampleRate is in valid range", () => {
    expect(TUNING.sampleRate).toBeGreaterThanOrEqual(22050);
    expect(TUNING.sampleRate).toBeLessThanOrEqual(96000);
  });

  it("stagger defaults to 0.06s for audible ripple", () => {
    expect(TUNING.stagger).toBe(0.06);
  });
});

describe("KNOB_DEFS", () => {
  it("every entry has min, max, default", () => {
    for (const [key, def] of Object.entries(KNOB_DEFS)) {
      expect(def, `${key} missing min`).toHaveProperty("min");
      expect(def, `${key} missing max`).toHaveProperty("max");
      expect(def, `${key} missing default`).toHaveProperty("default");
    }
  });

  it("default is within [min, max]", () => {
    for (const [key, def] of Object.entries(KNOB_DEFS)) {
      expect(def.default, `${key} default below min`).toBeGreaterThanOrEqual(def.min);
      expect(def.default, `${key} default above max`).toBeLessThanOrEqual(def.max);
    }
  });
});

describe("KNOB_GROUPS", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(KNOB_GROUPS)).toBe(true);
    expect(KNOB_GROUPS.length).toBeGreaterThan(0);
  });

  it("each group has label and key", () => {
    for (const group of KNOB_GROUPS) {
      expect(group).toHaveProperty("label");
      expect(group).toHaveProperty("key");
    }
  });
});

describe("SIGN_RULERS", () => {
  it("has all 12 zodiac signs", () => {
    for (const sign of ZODIAC_SIGNS) {
      expect(SIGN_RULERS, `missing ${sign}`).toHaveProperty(sign);
    }
  });
});

describe("CHAINS", () => {
  it("each chain has an order array", () => {
    for (const [key, chain] of Object.entries(CHAINS)) {
      expect(Array.isArray(chain.order), `${key} missing order array`).toBe(true);
    }
  });

  it("ACTIVE_CHAIN exists in CHAINS", () => {
    expect(CHAINS).toHaveProperty(ACTIVE_CHAIN);
  });
});
