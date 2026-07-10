// Snapshot schema + share-link codec. A snapshot is the full sound state:
// knobs, active signs (both banks), chain, osc type, listen preset,
// eclipse, orbit, and both charts' birth inputs. The same object round-trips
// through Save (.json download), Copy (clipboard), Load (file), and Link
// (URL hash). Birth data in a link lives in the fragment — it never
// reaches a server.

export const SNAPSHOT_VERSION = "v14";

export function buildSnapshot(state) {
  const {
    signsA,
    signsB,
    knobs,
    chain,
    oscType,
    listen,
    eclipse,
    orbit,
    natalA,
    natalB,
  } = state;
  return {
    meta: {
      name: "untitled",
      timestamp: new Date().toISOString(),
      version: SNAPSHOT_VERSION,
    },
    chain,
    oscType,
    signs: signsA,
    signsB,
    knobs: { ...knobs },
    listen,
    eclipse: !!eclipse,
    orbit: !!orbit,
    natal: { a: natalA, b: natalB },
  };
}

// Accepts any v12+ snapshot object; returns a normalized shape or null.
export function parseSnapshot(raw) {
  let obj = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  if (!obj.knobs || typeof obj.knobs !== "object") return null;
  return {
    chain: typeof obj.chain === "string" ? obj.chain : null,
    oscType: typeof obj.oscType === "string" ? obj.oscType : null,
    signs: obj.signs && typeof obj.signs === "object" ? obj.signs : {},
    signsB: obj.signsB && typeof obj.signsB === "object" ? obj.signsB : {},
    knobs: obj.knobs,
    listen: typeof obj.listen === "string" ? obj.listen : null,
    eclipse: !!obj.eclipse,
    orbit: !!obj.orbit,
    natal: {
      a: normalizeNatal(obj.natal?.a),
      b: normalizeNatal(obj.natal?.b),
    },
  };
}

function normalizeNatal(n) {
  if (!n || typeof n !== "object") return null;
  const out = {
    date: typeof n.date === "string" ? n.date : "",
    time: typeof n.time === "string" ? n.time : "",
    lat: Number.isFinite(n.lat) ? n.lat : null,
    lng: Number.isFinite(n.lng) ? n.lng : null,
    city: typeof n.city === "string" ? n.city : "",
  };
  return out.date || out.time || out.city ? out : null;
}

// ── URL hash codec ──
// base64url of the JSON, numbers rounded to 4 significant digits so a
// full state stays comfortably under typical URL limits.

function roundNumbers(_key, value) {
  return typeof value === "number" && Number.isFinite(value)
    ? +value.toPrecision(4)
    : value;
}

export function encodeShareState(snapshot) {
  const rest = { ...snapshot };
  delete rest.meta;
  const json = JSON.stringify(rest, roundNumbers);
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeShareState(str) {
  if (!str || typeof str !== "string") return null;
  try {
    const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return parseSnapshot(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

// Extract the share payload from a location.hash like "#s=..."
export function shareStateFromHash(hash) {
  const m = /[#&]s=([A-Za-z0-9_-]+)/.exec(hash || "");
  return m ? decodeShareState(m[1]) : null;
}
