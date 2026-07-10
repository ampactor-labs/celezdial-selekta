import { describe, it, expect } from "vitest";
import {
  SNAPSHOT_VERSION,
  buildSnapshot,
  parseSnapshot,
  encodeShareState,
  decodeShareState,
  shareStateFromHash,
} from "../snapshot.js";

const STATE = {
  signsA: { Leo: true, Aries: false },
  signsB: { Cancer: true },
  knobs: { attack: 2.8, reverbWet: 0.123456789, chebyOrder: 2 },
  chain: "zodiac",
  oscType: "per-sign",
  listen: "headphones",
  eclipse: false,
  orbit: true,
  natalA: { date: "1990-04-15", time: "07:30", lat: 34.05, lng: -118.24, city: "Los Angeles" },
  natalB: null,
};

describe("buildSnapshot / parseSnapshot", () => {
  it("round-trips through JSON", () => {
    const snap = buildSnapshot(STATE);
    expect(snap.meta.version).toBe(SNAPSHOT_VERSION);
    const parsed = parseSnapshot(JSON.stringify(snap));
    expect(parsed.chain).toBe("zodiac");
    expect(parsed.oscType).toBe("per-sign");
    expect(parsed.signs.Leo).toBe(true);
    expect(parsed.signsB.Cancer).toBe(true);
    expect(parsed.orbit).toBe(true);
    expect(parsed.natal.a.city).toBe("Los Angeles");
    expect(parsed.natal.a.lat).toBeCloseTo(34.05);
    expect(parsed.natal.b).toBeNull();
  });

  it("accepts the legacy v12 shape", () => {
    const v12 = {
      meta: { version: "v12" },
      chain: "zodiac",
      oscType: "fatsine",
      signs: { Leo: true },
      knobs: { attack: 1 },
      listen: "phone",
      eclipse: true,
    };
    const parsed = parseSnapshot(v12);
    expect(parsed.knobs.attack).toBe(1);
    expect(parsed.signsB).toEqual({});
    expect(parsed.natal.a).toBeNull();
    expect(parsed.eclipse).toBe(true);
  });

  it("rejects garbage", () => {
    expect(parseSnapshot("not json")).toBeNull();
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot({ meta: {} })).toBeNull(); // no knobs
    expect(parseSnapshot(42)).toBeNull();
  });
});

describe("share-state codec", () => {
  it("round-trips through base64url", () => {
    const snap = buildSnapshot(STATE);
    const enc = encodeShareState(snap);
    expect(enc).toMatch(/^[A-Za-z0-9_-]+$/); // URL-safe, no padding
    const dec = decodeShareState(enc);
    expect(dec.chain).toBe("zodiac");
    expect(dec.natal.a.date).toBe("1990-04-15");
    // numbers rounded to 4 significant digits
    expect(dec.knobs.reverbWet).toBeCloseTo(0.1235, 4);
  });

  it("survives unicode city names", () => {
    const snap = buildSnapshot({
      ...STATE,
      natalA: { ...STATE.natalA, city: "São Paulo, Brasil" },
    });
    const dec = decodeShareState(encodeShareState(snap));
    expect(dec.natal.a.city).toBe("São Paulo, Brasil");
  });

  it("rejects malformed input", () => {
    expect(decodeShareState("!!!")).toBeNull();
    expect(decodeShareState("")).toBeNull();
    expect(decodeShareState(null)).toBeNull();
  });

  it("extracts from a location hash", () => {
    const enc = encodeShareState(buildSnapshot(STATE));
    expect(shareStateFromHash(`#s=${enc}`).chain).toBe("zodiac");
    expect(shareStateFromHash("#other=1")).toBeNull();
    expect(shareStateFromHash("")).toBeNull();
  });
});
