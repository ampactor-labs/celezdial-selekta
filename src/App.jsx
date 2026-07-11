// ═══════════════════════════════════════════════════════════════
// CELESTIAL PAD v14 — Aspects · Orbit · Chains · Share
//
// UI + visuals live here. The audio graph is src/engine.js, chart
// math is src/astro.js, sign data is src/signs.js, state codec is
// src/snapshot.js. All sound-shaping numbers stay in src/tuning.js.
//
// ─── STATE MODEL ────────────────────────────────────────────
//
// engineRef      — Tone.js audio graph, created on first interaction.
//                  Null until user clicks (browser autoplay policy).
// activeSigns    — Set<string> of currently sounding sign names.
// params         — Object of 39 direct knob values. Each knob maps
//                  1:1 to an engine parameter via KNOB_MAP. Shadow
//                  mode temporarily overrides FX params; when Shadow
//                  disengages, param values are restored.
// oscIndex       — 0–7 | null. null = dynamic (default): each sign uses
//                  its ruling planet's oscillator. 0–7 = all synths share
//                  one OSC_TYPES entry. Breathe cycles null → 0 → ... → 7 → null.
// shadow         — Boolean. Shadow/Eclipse mode active. Ramps FX
//                  params toward chaos targets over rampTime seconds.
// activeChain    — CHAINS key; pills in the veil rewire at runtime.
// orbit          — Boolean. Chart voices cycle on planetary periods
//                  instead of sustaining.
// perform        — Boolean. Fullscreen, keyboard + emanation only.
// aspectMods     — Per-bank per-sign velocity boosts and tension
//                  partners derived from chart + synastry aspects.
//
// ─── CONTROLS ───────────────────────────────────────────────
//
// Piano keyboard — Toggle voices on/off. QWERTY row awsedftgyhuj
//                  mirrors the 12 keys; knobs answer arrow keys and
//                  the wheel when focused.
// Eclipse        — Chaos mode. Ramps all FX toward extreme values.
// Breathe        — Cycles oscillator type, per-sign → uniform types.
// Oracle dots    — Opens the Controls veil (knobs, chains, listen,
//                  randomize, save/copy/load/link, record, perform).
// Natal charts   — Two charts; "now" fills the current sky (transits).
//                  Aspects color the voices; Orbit breathes them.
//
// ═══════════════════════════════════════════════════════════════

import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import {
  TUNING,
  SHADOW,
  KNOB_DEFS,
  KNOB_GROUPS,
  CHAINS,
  ACTIVE_CHAIN,
  LISTEN_PRESETS,
  OSC_TYPES,
  SIGN_RULERS,
  ASPECTS,
  CHART_A_COLOR,
  CHART_B_COLOR,
  BODY_GLYPHS,
} from "./tuning";
import {
  SIGNS,
  SIGN_CHARACTER,
  SIGN_COLORS,
  COLOR_OFF,
  KNOB_DEFAULT_COLOR,
  KEYBOARD_ORDER,
  NATURAL_KEYS,
  SHARP_KEYS,
  SHARP_POSITIONS,
  SIGN_NAMES,
  KEY_TO_SIGN,
  SIGN_TO_KEY,
} from "./signs";
import {
  Tone,
  createEngine,
  KNOB_MAP,
  applyAdaptiveVoicing,
} from "./engine";
import {
  computeChart,
  computeSynastryAspects,
  aspectVoiceMods,
  orbitPeriodSeconds,
} from "./astro";
import {
  buildSnapshot,
  parseSnapshot,
  encodeShareState,
  shareStateFromHash,
} from "./snapshot";
import { MidiOut, midiSupported } from "./midi";
import {
  hexToRgb,
  rgbToHex,
  formatValue,
  logMap,
  stepMap,
  arcPoint,
  describeArc,
  KNOB_TRACK_PATH,
  KNOB_R,
  KNOB_CX,
  KNOB_CY,
  KNOB_START,
  KNOB_SWEEP,
} from "./utils";

// ─── Font Constants ───────────────────────────────────────────
const FONTS = {
  title: "'Spiral ST', serif",
  body: "system-ui, -apple-system, sans-serif",
  mono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
};

const STYLE_CHART_A = { color: CHART_A_COLOR };
const STYLE_CHART_B = { color: CHART_B_COLOR };

const VIS_SPEED = 0.65; // visual envelope runs ~35% faster than audio

const SHARP_KEY_STYLES = SHARP_POSITIONS.map((left) => ({ left }));
const SIGN_INDEX = Object.fromEntries(KEYBOARD_ORDER.map((s, i) => [s, i]));
const CAN_RECORD = typeof MediaRecorder !== "undefined";
const CHAIN_KEYS = Object.keys(CHAINS).filter((k) => k !== "custom");

// Degrees in astrologer notation: 10.3 → 10°18′
function fmtDeg(d) {
  let deg = Math.floor(d);
  let min = Math.round((d - deg) * 60);
  if (min === 60) {
    deg += 1;
    min = 0;
  }
  return `${deg}°${String(min).padStart(2, "0")}′`;
}

// Info-panel placement string: "☉ 10°18′℞  ♀ 24°06′"
function planetsWithDegrees(planets, bodies) {
  return planets
    .map((p) => {
      const b = bodies?.[p];
      const g = BODY_GLYPHS[p] || p;
      return b ? `${g} ${fmtDeg(b.degree)}${b.retro ? "℞" : ""}` : g;
    })
    .join("  ");
}

// Hover text for a key: the voice's fixed identity, then any chart
// placements with their degrees.
function keyTitle(sign, hasA, hasB, bodiesA, bodiesB) {
  const cfg = SIGN_CHARACTER[sign];
  const lines = [
    `${sign} · ${cfg.note}${cfg.octave} · ${SIGN_RULERS[sign]} ${cfg.oscType} · ${cfg.detuneCents > 0 ? "+" : ""}${cfg.detuneCents}¢ Cousto`,
  ];
  const placements = (label, planets, bodies) => {
    if (!planets) return;
    const parts = planets.planets.map((p) => {
      const b = bodies?.[p];
      return b
        ? `${p} ${fmtDeg(b.degree)}${b.retro ? " ℞" : ""}`
        : p;
    });
    lines.push(`${label}: ${parts.join(", ")}`);
  };
  placements("A", hasA, bodiesA);
  placements("B", hasB, bodiesB);
  return lines.join("\n");
}
// ─── Device-aware listen preset detection ─────────────────────
const DETECTED_LISTEN_PRESET = (() => {
  if (typeof window === "undefined") return "headphones";
  const mq = (q) => window.matchMedia(q).matches;
  if (mq("(max-width: 600px) and (pointer: coarse)")) return "phone";
  if (mq("(min-width: 601px) and (max-width: 1024px) and (pointer: coarse)")) return "laptop";
  return "headphones";
})();
// OSC_TYPES imported from tuning.js — 8 types cycled by Breathe

const knobScaleProps = Object.fromEntries(
  Object.entries(KNOB_DEFS).map(([name, def]) => [
    name,
    def.scale === "log"
      ? logMap(def.min, def.max)
      : def.scale === "step"
        ? stepMap(def.min, def.max)
        : {},
  ]),
);

// ─── SVG Arc Knob Component ──────────────────────────────────

const Knob = React.memo(function Knob({
  label,
  value,
  defaultValue,
  min,
  max,
  format,
  onChange,
  mapToNorm,
  mapFromNorm,
}) {
  const dragRef = useRef(null);

  const norm = mapToNorm ? mapToNorm(value) : (value - min) / (max - min);
  const clampedNorm = Math.max(0, Math.min(1, norm));
  const normRef = useRef(clampedNorm);
  normRef.current = clampedNorm;
  const valueAngle = KNOB_START + clampedNorm * KNOB_SWEEP;

  const valuePath =
    clampedNorm > 0.003 ? describeArc(KNOB_START, valueAngle) : "";
  const pointer = arcPoint(valueAngle);

  const onPointerDown = useCallback(
    (e) => {
      e.target.setPointerCapture(e.pointerId);
      dragRef.current = { startY: e.clientY, startNorm: normRef.current };
    },
    [],
  );

  const onPointerMove = useCallback(
    (e) => {
      if (!dragRef.current) return;
      const sensitivity = e.shiftKey ? 0.0005 : 0.003;
      const dy = dragRef.current.startY - e.clientY;
      const newNorm = Math.max(
        0,
        Math.min(1, dragRef.current.startNorm + dy * sensitivity),
      );
      const newValue = mapFromNorm
        ? mapFromNorm(newNorm)
        : min + newNorm * (max - min);
      onChange(newValue);
    },
    [min, max, onChange, mapFromNorm],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const onDoubleClick = useCallback(() => {
    onChange(defaultValue);
  }, [defaultValue, onChange]);

  // Keyboard + wheel nudging — arrows step 2% of range, shift steps 0.2%
  const nudge = useCallback(
    (dir, fine) => {
      const step = fine ? 0.002 : 0.02;
      const newNorm = Math.max(0, Math.min(1, normRef.current + dir * step));
      onChange(mapFromNorm ? mapFromNorm(newNorm) : min + newNorm * (max - min));
    },
    [min, max, onChange, mapFromNorm],
  );
  const nudgeRef = useRef(nudge);
  nudgeRef.current = nudge;

  const onKeyDown = useCallback((e) => {
    switch (e.key) {
      case "ArrowUp":
      case "ArrowRight":
        e.preventDefault();
        nudgeRef.current(1, e.shiftKey);
        break;
      case "ArrowDown":
      case "ArrowLeft":
        e.preventDefault();
        nudgeRef.current(-1, e.shiftKey);
        break;
      default:
    }
  }, []);

  // Wheel needs a non-passive native listener to preventDefault page scroll
  const svgRef = useRef(null);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      nudgeRef.current(e.deltaY > 0 ? -1 : 1, e.shiftKey);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div className="cel-knob">
      <span className="cel-knob-label">{label}</span>
      <svg
        ref={svgRef}
        width="56"
        height="56"
        className="cel-knob-svg"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={format ? format(value) : String(value)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
      >
        <path
          d={KNOB_TRACK_PATH}
          fill="none"
          stroke="rgba(180,140,255,0.15)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {valuePath && <path d={valuePath} className="cel-knob-value-arc" />}
        <circle
          cx={pointer.x}
          cy={pointer.y}
          r="4"
          className="cel-knob-pointer"
        />
        <circle
          cx={KNOB_CX}
          cy={KNOB_CY}
          r="6"
          fill="rgba(180,140,255,0.08)"
          stroke="rgba(180,140,255,0.2)"
          strokeWidth="1"
        />
      </svg>
      <span className="cel-knob-value">{format ? format(value) : value}</span>
    </div>
  );
});

// ─── Engine creation lock ───────────────────────────────────

let _enginePromise = null; // prevents duplicate contexts

// ─── Component ───────────────────────────────────────────────

// Reusable gradient data pool — avoids per-frame heap allocation in rAF loop
const _GRAD_POOL = Array.from({ length: 24 }, () => ({
  sign: '', cx: 0, cy: 0, r: 0, g: 0, b: 0, alpha: 0, falloff: 0,
}));
let _gradCount = 0;
let _prevLevelSum = -1;
let _prevGradCount = -1;

// Pre-built vsKey → sign lookup — avoids per-frame endsWith + slice string ops
const _VSKEY_SIGN = {};
for (const _s of KEYBOARD_ORDER) { _VSKEY_SIGN[_s] = _s; _VSKEY_SIGN[`${_s}_B`] = _s; }

// Per-sign glow accumulator pool — avoids per-frame {} allocation in rAF loop
// r/g/b/w: weighted accumulator; active: had contributions this frame
// lr/lg/lb/la: last-written values for component dirty-check (no string needed)
const _GLOW_POOL = {};
for (const _s of KEYBOARD_ORDER) {
  _GLOW_POOL[_s] = { r: 0, g: 0, b: 0, w: 0, active: false, lr: -1, lg: -1, lb: -1, la: -1 };
}

// Active visual-state list — tick iterates only live entries, not all 24 null slots
const _VS_ACTIVE = new Array(24);
let _vsActiveCount = 0;

// Pre-computed RGB triples for all SIGN_COLORS palette entries — no hexToRgb at attack time
const _DEFAULT_COLOR = [144, 112, 204];

// Default params computed once at module level (KNOB_DEFS is a module constant)
const _INIT_PARAMS = Object.fromEntries(Object.entries(KNOB_DEFS).map(([k, d]) => [k, d.default]));
const _SIGN_RGB = {};
for (const [_sign, _pal] of Object.entries(SIGN_COLORS)) {
  _SIGN_RGB[_sign] = _pal.slice(0, 4).map(hexToRgb);
}

// Signs that got glow contributions this frame — flush only these, not all 12
const _GLOW_DIRTY = new Array(12);
let _glowDirtyCount = 0;
let _anyGlowWasActive = false; // true if any sign had glow last frame (guards cleanup loop)

// ─── Diagnostics ──────────────────────────────────────────────
const _DEBUG = typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('debug');

const _diag = {
  frameGaps: new Float32Array(512),  // circular: last ~17s of frame gaps @30fps
  frameGapIdx: 0,
  frameGapCount: 0,
  frameDrops: 0,
  _prevTickTime: 0,

  longTasks: [],      // capped at 64 — entries from PerformanceObserver longtask
  _ltMax: 64,

  gradCacheHits: 0,
  gradCacheMisses: 0,

  driftSamples: new Float32Array(128),  // circular: clock drift probe (ms)
  driftIdx: 0,
  driftCount: 0,
  _driftFrameCounter: 0,
  lastDriftMs: 0,

  ctxStateLog: [],   // [{state, time}] — AudioContext state transitions
  engine: null,
  ctx: null,
  driftUnderruns: 0,      // samples where drift < -2ms
  noteEvents: [],         // capped at 100 — [{type, sign, time}]
  audioInfo: null,        // set after engine init: {baseLatency, outputLatency, bufferSize, sampleRate}
};

if (typeof PerformanceObserver !== 'undefined') {
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (_diag.longTasks.length >= _diag._ltMax) _diag.longTasks.shift();
        _diag.longTasks.push({ start: e.startTime, duration: e.duration });
      }
    }).observe({ entryTypes: ['longtask'] });
  } catch (_) {}
}

// ─── Platform detection ───────────────────────────────────────
const _platform = (() => {
  if (typeof window === 'undefined') return {};
  const ua = navigator.userAgent;
  return {
    isIOS: /iPad|iPhone|iPod/.test(ua) && !window.MSStream,
    isAndroid: /Android/.test(ua),
    isSafari: /^((?!chrome|android).)*safari/i.test(ua),
    isChrome: /Chrome/.test(ua),
    ua: ua.slice(0, 150),
  };
})();

if (typeof window !== 'undefined') {
  window.__selekta = {
    get diag() { return _diag; },
    get frameDrops() { return _diag.frameDrops; },
    get longTasks() { return _diag.longTasks; },
    get gradCacheRatio() {
      const t = _diag.gradCacheHits + _diag.gradCacheMisses;
      return t ? (_diag.gradCacheHits / t * 100).toFixed(1) + '%' : 'n/a';
    },
    get lastDriftMs() { return _diag.lastDriftMs; },
    get ctxStateLog() { return _diag.ctxStateLog; },
    get engine() { return _diag.engine; },
    get ctx() { return _diag.ctx; },
    get debug() { return _DEBUG; },
    get platform() { return _platform; },
    get audioInfo() { return _diag.audioInfo; },
    get driftUnderruns() { return _diag.driftUnderruns; },
    get noteEvents() { return _diag.noteEvents; },

    summary() {
      const t = _diag.gradCacheHits + _diag.gradCacheMisses;
      const cacheRate = t ? (_diag.gradCacheHits / t * 100).toFixed(1) : 'n/a';
      const recentLt = _diag.longTasks.slice(-5)
        .map(e => `  ${e.duration.toFixed(0)}ms @+${(e.start/1000).toFixed(1)}s`)
        .join('\n') || '  (none)';
      return [
        '=== Selekta Diagnostics ===',
        `Platform: ${_platform.isIOS ? 'iOS' : _platform.isAndroid ? 'Android' : 'desktop'} | ${_platform.isSafari ? 'Safari' : _platform.isChrome ? 'Chrome' : 'other'}`,
        `AudioContext: ${_diag.ctx?.rawContext?.state ?? 'no engine'}`,
        `Audio buffer: ${_diag.audioInfo ? `${_diag.audioInfo.bufferSize ?? '?'} samples (${_diag.audioInfo.baseLatency != null ? (_diag.audioInfo.baseLatency * 1000).toFixed(1) + 'ms base latency)' : 'latency unknown)'}` : 'n/a'}`,
        `Frames logged: ${_diag.frameGapCount}  |  drops (>50ms): ${_diag.frameDrops}`,
        `Clock drift: ${_diag.driftCount > 0 ? _diag.lastDriftMs.toFixed(2) : 'n/a'} ms  |  underruns (<-2ms): ${_diag.driftUnderruns} / ${_diag.driftCount}`,
        `Gradient cache: ${cacheRate}% hit  (${_diag.gradCacheHits}H / ${_diag.gradCacheMisses}M)`,
        `Long tasks (last 5):\n${recentLt}`,
        `Note events logged: ${_diag.noteEvents.length}`,
        `State transitions: ${_diag.ctxStateLog.length}`,
        `Debug mode: ${_DEBUG ? 'ON (perf marks active)' : 'OFF (?debug to enable)'}`,
      ].join('\n');
    },

    reset() {
      _diag.frameGaps.fill(0); _diag.frameGapIdx = 0;
      _diag.frameGapCount = 0; _diag.frameDrops = 0; _diag._prevTickTime = 0;
      _diag.longTasks.length = 0;
      _diag.gradCacheHits = 0; _diag.gradCacheMisses = 0;
      _diag.driftSamples.fill(0); _diag.driftIdx = 0;
      _diag.driftCount = 0; _diag._driftFrameCounter = 0; _diag.lastDriftMs = 0;
      _diag.driftUnderruns = 0;
      _diag.noteEvents.length = 0;
      _diag.audioInfo = null;
      _diag.ctxStateLog.length = 0;
      console.log('[selekta] diagnostics reset');
    },

    frameStats() {
      const gaps = [..._diag.frameGaps].filter(g => g > 0).sort((a, b) => a - b);
      if (!gaps.length) return 'no data';
      const pct = (p) => gaps[Math.floor(gaps.length * p)] ?? 0;
      return { count: gaps.length, p50: pct(0.5).toFixed(1), p95: pct(0.95).toFixed(1), p99: pct(0.99).toFixed(1), max: gaps[gaps.length-1].toFixed(1) };
    },
  };
}

const KeyboardSection = React.memo(function KeyboardSection({
  natalActivations,
  natalActivationsB,
  bodiesA,
  bodiesB,
  onClick,
  keyRefCallbacks,
}) {
  return (
    <div className="cel-keyboard" onClick={onClick}>
      {NATURAL_KEYS.map((sign) => {
        const cfg = SIGNS[sign];
        const hasChartA = natalActivations[sign];
        const hasChartB = natalActivationsB[sign];
        return (
          <button
            key={sign}
            type="button"
            ref={keyRefCallbacks[sign]}
            className={`cel-key cel-key-natural${hasChartA && hasChartB ? " cel-key-shared" : ""}`}
            data-sign={sign}
            title={keyTitle(sign, hasChartA, hasChartB, bodiesA, bodiesB)}
          >
            {(hasChartA || hasChartB) && (
              <span className="cel-chart-dots">
                {hasChartA && <span className="cel-chart-dot cel-chart-dot-a" />}
                {hasChartB && <span className="cel-chart-dot cel-chart-dot-b" />}
              </span>
            )}
            <span className="cel-key-glyph">{cfg.glyph}</span>
            <span className="cel-key-name">{sign}</span>
            <span className="cel-key-kbd">{SIGN_TO_KEY[sign]}</span>
            {(hasChartA || hasChartB) && (
              <span className="cel-key-bodies">
                {hasChartA && hasChartA.planets.map(p => (
                  <span key={`a-${p}`} className="cel-body-glyph cel-body-a">{BODY_GLYPHS[p] || p[0]}</span>
                ))}
                {hasChartB && hasChartB.planets.map(p => (
                  <span key={`b-${p}`} className="cel-body-glyph cel-body-b">{BODY_GLYPHS[p] || p[0]}</span>
                ))}
              </span>
            )}
            <span className="cel-key-note">{cfg.note}</span>
          </button>
        );
      })}
      {SHARP_KEYS.map((sign, i) => {
        const cfg = SIGNS[sign];
        const hasChartA = natalActivations[sign];
        const hasChartB = natalActivationsB[sign];
        return (
          <button
            key={sign}
            type="button"
            ref={keyRefCallbacks[sign]}
            className={`cel-key cel-key-sharp${hasChartA && hasChartB ? " cel-key-shared" : ""}`}
            style={SHARP_KEY_STYLES[i]}
            data-sign={sign}
            title={keyTitle(sign, hasChartA, hasChartB, bodiesA, bodiesB)}
          >
            {(hasChartA || hasChartB) && (
              <span className="cel-chart-dots">
                {hasChartA && <span className="cel-chart-dot cel-chart-dot-a" />}
                {hasChartB && <span className="cel-chart-dot cel-chart-dot-b" />}
              </span>
            )}
            <span className="cel-key-glyph">{cfg.glyph}</span>
            <span className="cel-key-name">{sign}</span>
          </button>
        );
      })}
    </div>
  );
});

export default function App() {
  const engineRef = useRef(null);
  const [status, setStatus] = useState("idle");
  const [anyActive, setAnyActive] = useState(false);
  const [shadow, setShadow] = useState(false);
  const [oscIndex, setOscIndex] = useState(null); // null = dynamic (per-sign planetary)
  const [listenPreset, setListenPreset] = useState(DETECTED_LISTEN_PRESET);
  const shadowIntervalsRef = useRef([]);
  const visualStateRef = useRef({});
  const keyRefsRef = useRef({});
  const rootRef = useRef(null);
  const emanationRef = useRef(null);
  const shadowRef = useRef(false);
  const pendingOscTypeRef = useRef("per-sign"); // dynamic default: engine builds per-sign
  const activeOscTypeRef = useRef(null); // null → spread/detune logic falls back to per-sign type
  const canvasCtxRef = useRef(null);
  const rafIdRef = useRef(null);
  const lastFrameTimeRef = useRef(null);
  const keyPositionsRef = useRef({});
  const startLoopRef = useRef(null);
  const lastAccentRef = useRef({ r: -1, g: -1, b: -1 });
  const colorIndexRef = useRef({});
  const [natalDate, setNatalDate] = useState("");
  const [natalTime, setNatalTime] = useState("");
  const [natalLat, setNatalLat] = useState(null);
  const [natalLng, setNatalLng] = useState(null);
  const [cityQueryA, setCityQueryA] = useState("");
  const [citySuggestionsA, setCitySuggestionsA] = useState([]);
  const [cityLoadingA, setCityLoadingA] = useState(false);
  const [cityHighlightA, setCityHighlightA] = useState(-1);
  const [natalActivations, setNatalActivations] = useState({});
  const natalActivationsRef = useRef({});
  // Chart B state
  const [natalDateB, setNatalDateB] = useState("");
  const [natalTimeB, setNatalTimeB] = useState("");
  const [natalLatB, setNatalLatB] = useState(null);
  const [natalLngB, setNatalLngB] = useState(null);
  const [cityQueryB, setCityQueryB] = useState("");
  const [citySuggestionsB, setCitySuggestionsB] = useState([]);
  const [cityLoadingB, setCityLoadingB] = useState(false);
  const [cityHighlightB, setCityHighlightB] = useState(-1);
  const [natalActivationsB, setNatalActivationsB] = useState({});
  const natalActivationsBRef = useRef({});
  const cityDebounceARef = useRef(null);
  const cityDebounceBRef = useRef(null);
  const cityGenARef = useRef(0);
  const cityGenBRef = useRef(0);
  const citySelectedARef = useRef(false);
  const citySelectedBRef = useRef(false);
  const [params, setParams] = useState(() => ({ ..._INIT_PARAMS }));
  const renderThrottleRef = useRef(0);
  const trailingRenderRef = useRef(null);
  const gradientCacheRef = useRef({});
  const canvasScaleRef = useRef(1);
  const keyExtentRef = useRef(60);
  const paramsRef = useRef({ ..._INIT_PARAMS });
  const natalDebounceARef = useRef(null);
  const natalDebounceBRef = useRef(null);
  const natalGenARef = useRef(0);
  const natalGenBRef = useRef(0);
  const activeSignsARef = useRef(new Set());
  const activeSignsBRef = useRef(new Set());
  // Chart bodies + aspects (per chart), synastry derived below
  const [bodiesA, setBodiesA] = useState({});
  const [bodiesB, setBodiesB] = useState({});
  const [aspectsA, setAspectsA] = useState([]);
  const [aspectsB, setAspectsB] = useState([]);
  const aspectModsRef = useRef({ A: {}, B: {} });
  // Runtime chain, orbit, perform, record, midi, share
  const [activeChain, setActiveChain] = useState(ACTIVE_CHAIN);
  const activeChainRef = useRef(ACTIVE_CHAIN);
  const [orbit, setOrbit] = useState(false);
  // timeouts is a Set — fired timers remove themselves so hours of
  // orbiting don't accumulate thousands of stale ids
  const orbitRef = useRef({ on: false, events: [], timeouts: new Set() });
  const [perform, setPerform] = useState(false);
  const [recording, setRecording] = useState(false);
  const recordingRef = useRef(false);
  const [midiLabel, setMidiLabel] = useState("midi: off");
  const midiRef = useRef(null);
  const [linkFeedback, setLinkFeedback] = useState(false);
  const loadInputRef = useRef(null);
  const listenPresetRef = useRef(DETECTED_LISTEN_PRESET);

  // Engine application is throttled like the React render: pointermove
  // fires at 60-120Hz and each KNOB_MAP apply touches up to 24 synths.
  // 30Hz with a trailing flush is indistinguishable at the ear (ramped
  // params just get smoother targets) and cuts main-thread churn during
  // drags by ~3x. Pending values keep per-name so simultaneous touches
  // both land their final values.
  const engineApplyRef = useRef({ last: 0, timer: null, pending: new Map() });

  const setParam = useCallback((name, value) => {
    const p = paramsRef.current;
    p[name] = value;

    const a = engineApplyRef.current;
    a.pending.set(name, value);
    const flush = () => {
      const eng = engineRef.current;
      if (eng) {
        for (const [n, v] of a.pending) KNOB_MAP[n]?.apply(eng, v);
      }
      a.pending.clear();
    };
    const now = performance.now();
    clearTimeout(a.timer);
    if (now - a.last > 33) {
      a.last = now;
      flush();
    } else {
      a.timer = setTimeout(() => {
        a.last = performance.now();
        flush();
      }, 40);
    }

    clearTimeout(trailingRenderRef.current);
    if (now - renderThrottleRef.current > 50) {
      renderThrottleRef.current = now;
      setParams({ ...p });
    } else {
      trailingRenderRef.current = setTimeout(() => {
        setParams({ ...paramsRef.current });
      }, 60);
    }
  }, []);

  // Stable callbacks — one per param, never re-created
  const paramSetters = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(KNOB_DEFS).map((name) => [name, (v) => setParam(name, v)]),
      ),
    [setParam],
  );

  const randomizeParams = useCallback(() => {
    const eng = engineRef.current;
    const newParams = {};
    for (const [name, def] of Object.entries(KNOB_DEFS)) {
      const norm = Math.random();
      const props =
        def.scale === "log"
          ? logMap(def.min, def.max)
          : def.scale === "step"
            ? stepMap(def.min, def.max)
            : null;
      const value = props
        ? props.mapFromNorm(norm)
        : def.min + norm * (def.max - def.min);
      newParams[name] = value;
      if (eng) KNOB_MAP[name]?.apply(eng, value);
    }
    paramsRef.current = newParams;
    setParams(newParams);
  }, []);

  const collectSnapshot = useCallback(
    () =>
      buildSnapshot({
        signsA: Object.fromEntries(
          SIGN_NAMES.map((s) => [s, activeSignsARef.current.has(s)]),
        ),
        signsB: Object.fromEntries(
          SIGN_NAMES.map((s) => [s, activeSignsBRef.current.has(s)]),
        ),
        knobs: paramsRef.current,
        chain: activeChainRef.current,
        oscType: oscIndex === null ? "per-sign" : OSC_TYPES[oscIndex],
        listen: listenPreset,
        eclipse: shadow,
        orbit,
        natalA: { date: natalDate, time: natalTime, lat: natalLat, lng: natalLng, city: cityQueryA },
        natalB: { date: natalDateB, time: natalTimeB, lat: natalLatB, lng: natalLngB, city: cityQueryB },
      }),
    [oscIndex, listenPreset, shadow, orbit, natalDate, natalTime, natalLat, natalLng, cityQueryA, natalDateB, natalTimeB, natalLatB, natalLngB, cityQueryB],
  );

  const exportSnapshot = useCallback(() => {
    const snap = collectSnapshot();
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `celezdial-snapshot-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [collectSnapshot]);

  // Restore a parsed snapshot: fields, knobs, chain, listen, osc type.
  // Playback stays silent by design — charts recompute from the restored
  // inputs, then Play (or Orbit) is the user's gesture.
  const applySnapshotState = useCallback((snap) => {
    if (!snap) return;
    const p = paramsRef.current;
    for (const [name, def] of Object.entries(KNOB_DEFS)) {
      const v = snap.knobs[name];
      if (typeof v === "number" && Number.isFinite(v)) {
        p[name] = Math.min(def.max, Math.max(def.min, v));
      }
    }
    setParams({ ...p });
    const eng = engineRef.current;
    if (eng) {
      for (const name of Object.keys(KNOB_DEFS)) {
        KNOB_MAP[name]?.apply(eng, p[name]);
      }
    }
    if (snap.chain && CHAINS[snap.chain]) {
      activeChainRef.current = snap.chain;
      setActiveChain(snap.chain);
      eng?.rewireChain(snap.chain);
    }
    if (snap.oscType) {
      if (snap.oscType === "per-sign") {
        pendingOscTypeRef.current = "per-sign";
        activeOscTypeRef.current = null;
        setOscIndex(null);
      } else {
        const i = OSC_TYPES.indexOf(snap.oscType);
        if (i >= 0) {
          pendingOscTypeRef.current = OSC_TYPES[i];
          activeOscTypeRef.current = OSC_TYPES[i];
          setOscIndex(i);
        }
      }
    }
    if (snap.listen && LISTEN_PRESETS[snap.listen]) {
      setListenPreset(snap.listen);
      if (eng?.fx.monitorEQ) {
        const lp = LISTEN_PRESETS[snap.listen];
        eng.fx.monitorEQ.low.value = lp.low;
        eng.fx.monitorEQ.mid.value = lp.mid;
        eng.fx.monitorEQ.high.value = lp.high;
      }
    }
    const a = snap.natal?.a;
    if (a) {
      setNatalDate(a.date || "");
      setNatalTime(a.time || "");
      setNatalLat(a.lat);
      setNatalLng(a.lng);
      citySelectedARef.current = !!a.city; // suppress autocomplete re-trigger
      setCityQueryA(a.city || "");
    }
    const b = snap.natal?.b;
    if (b) {
      setNatalDateB(b.date || "");
      setNatalTimeB(b.time || "");
      setNatalLatB(b.lat);
      setNatalLngB(b.lng);
      citySelectedBRef.current = !!b.city;
      setCityQueryB(b.city || "");
    }
  }, []);

  const shareLink = useCallback(() => {
    const enc = encodeShareState(collectSnapshot());
    const url = `${window.location.origin}${window.location.pathname}#s=${enc}`;
    window.history.replaceState(null, "", `#s=${enc}`);
    navigator.clipboard.writeText(url).then(() => {
      setLinkFeedback(true);
      setTimeout(() => setLinkFeedback(false), 1200);
    });
  }, [collectSnapshot]);

  const loadSnapshotFile = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      file.text().then((text) => applySnapshotState(parseSnapshot(text)));
    },
    [applySnapshotState],
  );

  // Share-link restore — birth data lives in the fragment, never sent anywhere
  useEffect(() => {
    const snap = shareStateFromHash(window.location.hash);
    if (snap) applySnapshotState(snap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-computed format functions — stable references for React.memo
  const formatFns = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(KNOB_DEFS).map(([name, def]) => [
          name,
          (v) => formatValue(v, def),
        ]),
      ),
    [],
  );

  // Info panel sign sets — memoized so inline IIFE doesn't recompute on unrelated renders
  const infoPanelSigns = useMemo(() => {
    const keysA = Object.keys(natalActivations);
    const keysB = Object.keys(natalActivationsB);
    const keysASet = new Set(keysA);
    const keysBSet = new Set(keysB);
    return {
      hasAny: keysA.length > 0 || keysB.length > 0,
      hasBoth: keysA.length > 0 && keysB.length > 0,
      shared: keysA.filter(s => keysBSet.has(s)),
      onlyA: keysA.filter(s => !keysBSet.has(s)),
      onlyB: keysB.filter(s => !keysASet.has(s)),
      keysA,
      keysB,
    };
  }, [natalActivations, natalActivationsB]);

  // Synastry aspects between the two charts, and the per-voice modifiers
  // (velocity boosts, tension partners) all trigger paths read via ref.
  const synastryAspects = useMemo(
    () => computeSynastryAspects(bodiesA, bodiesB),
    [bodiesA, bodiesB],
  );
  const aspectMods = useMemo(
    () =>
      aspectVoiceMods({
        aspectsA,
        aspectsB,
        synastry: synastryAspects,
        bodiesA,
        bodiesB,
      }),
    [aspectsA, aspectsB, synastryAspects, bodiesA, bodiesB],
  );
  useEffect(() => {
    aspectModsRef.current = aspectMods;
  }, [aspectMods]);
  useEffect(() => {
    listenPresetRef.current = listenPreset;
  }, [listenPreset]);

  // Stable key ref callbacks — same function identity across renders, prevents 24 spurious ref calls
  const keyRefCallbacks = useMemo(
    () => Object.fromEntries(KEYBOARD_ORDER.map(sign => [sign, (el) => { keyRefsRef.current[sign] = el; }])),
    [],
  );

  // Pre-computed grouped knobs with row support for side-by-side pairs
  const groupedKnobs = useMemo(() => {
    const groups = KNOB_GROUPS.map(({ key, label, row }) => ({
      key,
      label,
      row,
      knobs: Object.entries(KNOB_DEFS).filter(([_, d]) => d.group === key),
    }));
    const result = [];
    const seen = new Set();
    for (const g of groups) {
      if (seen.has(g.key)) continue;
      seen.add(g.key);
      if (g.row != null) {
        const partners = groups.filter(
          (x) => x.row === g.row && !seen.has(x.key),
        );
        partners.forEach((p) => seen.add(p.key));
        result.push({ type: "row", groups: [g, ...partners] });
      } else {
        result.push({ type: "single", ...g });
      }
    }
    return result;
  }, []);


  useEffect(() => {
    return () => {
      shadowIntervalsRef.current.forEach((id) => Tone.Transport.clear(id));
      orbitRef.current.events.forEach((id) => Tone.Transport.clear(id));
      orbitRef.current.timeouts.forEach(clearTimeout);
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
      _enginePromise = null;
    };
  }, []);

  useEffect(() => {
    shadowRef.current = shadow;
  }, [shadow]);

  // ─── iOS audio lifecycle recovery ─────────────────────────────
  // Handles: interrupted state (phone call, Siri, notifications),
  // tab backgrounding, screen lock, bfcache restore.
  useEffect(() => {
    const tryResume = async () => {
      try {
        if (!Tone) return;
        if (Tone.getContext()?.rawContext?.state !== "running") {
          await Tone.start();
          const raw = Tone.getContext()?.rawContext;
          if (raw && raw.state !== "running") await raw.resume();
        }
      } catch (_) {}
    };

    // Resume on tab/app restore
    const onVisibility = () => {
      if (!document.hidden) tryResume();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Resume on any touch (catches interrupted state after phone calls)
    const onTouch = () => tryResume();
    document.addEventListener("touchend", onTouch, { passive: true });

    // Handle bfcache restore (user hits back)
    const onPageShow = (e) => {
      if (e.persisted) tryResume();
    };
    window.addEventListener("pageshow", onPageShow);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("touchend", onTouch);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  // ─── Position cache (eliminates getBoundingClientRect in rAF) ──
  useEffect(() => {
    const updatePositions = () => {
      const rootEl = rootRef.current;
      if (!rootEl) return;
      const rr = rootEl.getBoundingClientRect();
      const positions = {};
      let maxKeyExtent = 0;
      for (const sign of KEYBOARD_ORDER) {
        const el = keyRefsRef.current[sign];
        if (el) {
          const kr = el.getBoundingClientRect();
          positions[sign] = {
            cx: kr.left + kr.width / 2 - rr.left,
            cy: kr.top + kr.height / 2 - rr.top,
          };
          const extent = Math.max(kr.width, kr.height);
          if (extent > maxKeyExtent) maxKeyExtent = extent;
        }
      }
      keyPositionsRef.current = positions;
      keyExtentRef.current = maxKeyExtent || 60;
      // Size canvas + cache 2d context.
      // Glow is extremely tolerant of downscale — cap intrinsic resolution at
      // 1200px in either dimension to keep radial-gradient rasterization within
      // GPU sanity on large desktop displays (prevents compositor lockup).
      const canvas = emanationRef.current;
      if (canvas) {
        const MAX_CANVAS_DIM = 1200;
        const scale = Math.min(1, MAX_CANVAS_DIM / rr.width, MAX_CANVAS_DIM / rr.height) || 1;
        canvas.width = Math.max(1, Math.round(rr.width * scale));
        canvas.height = Math.max(1, Math.round(rr.height * scale));
        canvasScaleRef.current = scale;
        canvasCtxRef.current = canvas.getContext("2d");
        gradientCacheRef.current = {};
      }
    };
    updatePositions();
    const ro = new ResizeObserver(updatePositions);
    if (rootRef.current) ro.observe(rootRef.current);
    window.addEventListener("resize", updatePositions);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updatePositions);
    };
  }, []);

  // ─── Visual color engine (rAF loop) ─────────────────────────
  // Each active planet holds a fixed color (one of 4 colorful palette entries).
  // On release, that color lerps toward #0c0c0c — light dissolves into void.
  // Loop only runs when planets are active (idle = no rAF = saves battery).
  useEffect(() => {
    const [darkR, darkG, darkB] = hexToRgb(COLOR_OFF);

    const tick = (now) => {
      if (now - lastFrameTimeRef.current < 33) {
        requestAnimationFrame(tick);
        return;
      }
      lastFrameTimeRef.current = now;

      // ── Diagnostic: frame timing ──
      if (_DEBUG) {
        if (_diag.frameGapCount > 0) {
          const _gap = now - _diag._prevTickTime;
          _diag.frameGaps[_diag.frameGapIdx++ % 512] = _gap;
          if (_gap > 50) _diag.frameDrops++;
        }
        _diag._prevTickTime = now;
        _diag.frameGapCount++;
      }

      // ── Diagnostic: clock drift probe (every 32 frames) ──
      if (_DEBUG) {
        if (_diag.ctx && ++_diag._driftFrameCounter >= 8) {
          _diag._driftFrameCounter = 0;
          const _raw = _diag.ctx.rawContext;
          if (_raw.state === 'running' && _raw.getOutputTimestamp) {
            const _ts = _raw.getOutputTimestamp();
            if (_ts.contextTime > 0) {
              const _drift = (_raw.currentTime -
                (_ts.contextTime + (performance.now() - _ts.performanceTime) / 1000)) * 1000;
              _diag.driftSamples[_diag.driftIdx++ % 128] = _drift;
              _diag.driftCount++;
              _diag.lastDriftMs = _drift;
              if (_drift < -2) {
                _diag.driftUnderruns++;
                console.warn(`[selekta] clock drift ${_drift.toFixed(1)}ms — scheduling starvation`);
              }
            }
          }
        }
      }

      if (_DEBUG) performance.mark('selekta:tick-start');

      let blendR = 0,
        blendG = 0,
        blendB = 0,
        totalWeight = 0;
      _gradCount = 0;
      _glowDirtyCount = 0;
      const _shadow = shadowRef.current;

      for (let _i = 0; _i < _vsActiveCount; _i++) {
        const vsKey = _VS_ACTIVE[_i];
        const vs = visualStateRef.current[vsKey];
        if (!vs) {
          // Defensive: orphaned slot — compact and reprocess index
          _VS_ACTIVE[_i] = _VS_ACTIVE[--_vsActiveCount];
          _i--;
          continue;
        }
        const sign = _VSKEY_SIGN[vsKey];
        if (now < vs.startTime) continue;
        const elapsed = (now - vs.startTime) / 1000;
        let level = vs.envelopeLevel;

        switch (vs.stage) {
          case "attack":
            level = Math.min(1, elapsed / vs.attackTime);
            if (level >= 1) {
              vs.stage = "decay";
              vs.startTime = now;
            }
            break;
          case "decay": {
            const dp = Math.min(1, elapsed / vs.decayTime);
            level = 1 - (1 - vs.sustainLevel) * dp;
            if (dp >= 1) vs.stage = "sustain";
            break;
          }
          case "sustain":
            level = vs.sustainLevel;
            break;
          case "release": {
            const rp = Math.min(1, elapsed / vs.releaseTime);
            level = vs.releaseStartLevel * (1 - rp);
            if (rp >= 1) {
              vs.stage = "idle";
              level = 0;
            }
            break;
          }
          default:
            level = 0;
        }
        vs.envelopeLevel = level;

        const ar = vs.activeColor[0], ag = vs.activeColor[1], ab = vs.activeColor[2];
        let r = ar,
          g = ag,
          b = ab;

        if (vs.stage === "release" && vs.releaseStartLevel > 0.001) {
          const rp = 1 - level / vs.releaseStartLevel;
          r = Math.round(ar + (darkR - ar) * rp);
          g = Math.round(ag + (darkG - ag) * rp);
          b = Math.round(ab + (darkB - ab) * rp);
        }

        // Accumulate glow per element — blended after the loop
        if (level > 0.01) {
          const acc = _GLOW_POOL[sign];
          if (acc.active) {
            acc.r += r * level;
            acc.g += g * level;
            acc.b += b * level;
            acc.w += level;
          } else {
            acc.r = r * level;
            acc.g = g * level;
            acc.b = b * level;
            acc.w = level;
            acc.active = true;
            _GLOW_DIRTY[_glowDirtyCount++] = sign;
          }
        }

        // Emanation — push data for canvas draw (no strings, no getBoundingClientRect)
        const pos = keyPositionsRef.current[sign];
        if (pos && level > 0.01 && _gradCount < _GRAD_POOL.length) {
          const _gd = _GRAD_POOL[_gradCount++];
          _gd.sign = vsKey;
          _gd.cx = pos.cx;
          _gd.cy = pos.cy;
          _gd.r = r;
          _gd.g = g;
          _gd.b = b;
          _gd.alpha = level * 0.38;
          _gd.falloff = _shadow ? 50 : 40;
        }

        if (level > 0.01) {
          blendR += ar * level;
          blendG += ag * level;
          blendB += ab * level;
          totalWeight += level;
        }

        if (vs.stage === "idle") {
          visualStateRef.current[vsKey] = null; // preserve V8 hidden class
          _VS_ACTIVE[_i] = _VS_ACTIVE[--_vsActiveCount];
          _i--;
        }
      }
      const hasActive = _vsActiveCount > 0;

      // Flush blended glow — only active signs, component dirty-check, no string during sustain
      for (let _gi = 0; _gi < _glowDirtyCount; _gi++) {
        const sign = _GLOW_DIRTY[_gi];
        const acc = _GLOW_POOL[sign];
        acc.active = false; // reset for next frame
        const el = keyRefsRef.current[sign];
        if (!el) continue;
        const gr = Math.round(acc.r / acc.w);
        const gg = Math.round(acc.g / acc.w);
        const gb = Math.round(acc.b / acc.w);
        const ga = Math.round(Math.min(acc.w * 0.7, 0.45) * 100) / 100;
        if (gr !== acc.lr || gg !== acc.lg || gb !== acc.lb || ga !== acc.la) {
          el.style.setProperty("--glow-hue", `rgb(${gr},${gg},${gb})`);
          el.style.setProperty("--glow-opacity", String(ga));
          acc.lr = gr; acc.lg = gg; acc.lb = gb; acc.la = ga;
        }
      }
      // Clear glow on signs that had glow last frame but have none this frame
      const _hadGlow = _anyGlowWasActive;
      _anyGlowWasActive = _glowDirtyCount > 0;
      if (_hadGlow) {
        for (const sign in _GLOW_POOL) {
          const acc = _GLOW_POOL[sign];
          if (!acc.active && acc.la !== 0) {
            const el = keyRefsRef.current[sign];
            if (el) el.style.setProperty("--glow-opacity", "0");
            acc.la = 0;
          }
        }
      }

      // Canvas emanation — single GPU-composited draw
      // Skip redraw if level sum and active sign count are unchanged (e.g. during sustain).
      const _canvasDirty = Math.abs(totalWeight - _prevLevelSum) > 0.003 || _gradCount !== _prevGradCount;
      _prevLevelSum = totalWeight;
      _prevGradCount = _gradCount;

      const canvas = emanationRef.current;
      const ctx = canvasCtxRef.current;
      if (canvas && ctx && _canvasDirty) {
        const cs = canvasScaleRef.current;
        // Identity transform for clear (physical pixels), then scale so the
        // rest of the draw code stays in root CSS-pixel coordinates.
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (cs !== 1) ctx.setTransform(cs, 0, 0, cs, 0, 0);
        if (_gradCount > 0) {
          // Logical (root) height — canvas.height is physical after scale clamp.
          const canvasH = canvas.height / cs;
          // Cap radius at 3× the largest key extent. Prevents gradients from
          // ballooning to cover the whole viewport on desktop, where per-pixel
          // radial-gradient rasterization becomes a GPU bottleneck.
          const maxRadius = (keyExtentRef.current * 3) | 0;
          const _cache = gradientCacheRef.current;
          for (let i = 0; i < _gradCount; i++) {
            const gd = _GRAD_POOL[i];
            let radius = ((canvasH * gd.falloff) / 100) | 0;
            if (radius > maxRadius) radius = maxRadius;
            const cx = gd.cx | 0, cy = gd.cy | 0;
            let entry = _cache[gd.sign];
            if (
              !entry ||
              entry.r !== gd.r || entry.g !== gd.g || entry.b !== gd.b ||
              entry.cx !== cx || entry.cy !== cy ||
              entry.radius !== radius
            ) {
              const ng = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
              ng.addColorStop(0, `rgba(${gd.r},${gd.g},${gd.b},1)`);
              ng.addColorStop(1, `rgba(${gd.r},${gd.g},${gd.b},0)`);
              if (entry) {
                entry.grad = ng; entry.r = gd.r; entry.g = gd.g; entry.b = gd.b;
                entry.cx = cx; entry.cy = cy; entry.radius = radius;
              } else {
                _cache[gd.sign] = { grad: ng, r: gd.r, g: gd.g, b: gd.b, cx, cy, radius };
              }
              entry = _cache[gd.sign];
              _diag.gradCacheMisses++;
            } else {
              _diag.gradCacheHits++;
            }
            ctx.globalAlpha = gd.alpha;
            ctx.fillStyle = entry.grad;
            ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
          }
          ctx.globalAlpha = 1;
        }
      }

      // Knob accent — component dirty-check avoids rgbToHex string during sustain
      const rootEl = rootRef.current;
      if (rootEl) {
        const acr = totalWeight > 0.01 ? Math.round(blendR / totalWeight) : -1;
        const acg = totalWeight > 0.01 ? Math.round(blendG / totalWeight) : -1;
        const acb = totalWeight > 0.01 ? Math.round(blendB / totalWeight) : -1;
        const prev = lastAccentRef.current;
        if (acr !== prev.r || acg !== prev.g || acb !== prev.b) {
          rootEl.style.setProperty("--knob-accent", acr < 0 ? KNOB_DEFAULT_COLOR : rgbToHex(acr, acg, acb));
          prev.r = acr; prev.g = acg; prev.b = acb;
        }
      }

      if (_DEBUG) performance.measure('selekta:tick', 'selekta:tick-start');

      // Idle detection — stop rAF when nothing is active
      if (hasActive) {
        rafIdRef.current = requestAnimationFrame(tick);
      } else {
        rafIdRef.current = null;
        lastFrameTimeRef.current = null;
      }
    };

    const startLoop = () => {
      if (!rafIdRef.current) rafIdRef.current = requestAnimationFrame(tick);
    };
    startLoopRef.current = startLoop;

    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      lastFrameTimeRef.current = null;
    };
  }, []);

  const ensureEngine = useCallback(async () => {
    if (engineRef.current) return engineRef.current;
    // Serialize creation — all concurrent callers share one promise
    if (!_enginePromise) {
      _enginePromise = createEngine({
        chain: activeChainRef.current,
        diag: _diag,
      }).then((eng) => {
        // Apply live param values — matters after a share-link or file
        // restore that ran before the first user gesture
        for (const name of Object.keys(KNOB_DEFS)) {
          KNOB_MAP[name]?.apply(eng, paramsRef.current[name]);
        }
        // Apply current listen preset EQ
        const lp = LISTEN_PRESETS[listenPresetRef.current];
        if (lp && eng.fx.monitorEQ) {
          eng.fx.monitorEQ.low.value = lp.low;
          eng.fx.monitorEQ.mid.value = lp.mid;
          eng.fx.monitorEQ.high.value = lp.high;
        }
        engineRef.current = eng;
        _diag.engine = eng;
        setStatus("ready");
        return eng;
      });
    }
    return _enginePromise;
  }, []);

  // Pre-warm: start engine build on first user gesture anywhere on page.
  // Resolves the 1186ms init block so it's done before sign press.
  useEffect(() => {
    let warmed = false;
    const warm = () => {
      if (warmed) return;
      warmed = true;
      document.removeEventListener('pointerdown', warm, { capture: true });
      ensureEngine().catch(() => {});
    };
    document.addEventListener('pointerdown', warm, { capture: true, passive: true });
    return () => document.removeEventListener('pointerdown', warm, { capture: true });
  }, [ensureEngine]);

  // Apply pending osc type from breathe — used in toggleSign
  function applyPendingOscType(eng) {
    const t = pendingOscTypeRef.current;
    if (!t) return;
    const p = paramsRef.current;
    const applyToBank = (synths, oscTypes, spreadTrk) => {
      if (t === "per-sign") {
        for (const name of SIGN_NAMES) {
          const sc = SIGN_CHARACTER[name];
          synths[name].set({ oscillator: { type: sc.oscType } });
          oscTypes[name] = sc.oscType;
          if (sc.oscType.startsWith("fat")) {
            synths[name].set({ oscillator: { count: sc.oscCount, spread: p.oscSpread } });
            spreadTrk[name] = p.oscSpread;
          }
          if (sc.oscType.startsWith("am") || sc.oscType.startsWith("fm")) {
            synths[name].set({ oscillator: { harmonicity: p.harmonicity } });
          }
          if (sc.oscType.startsWith("fm")) {
            synths[name].set({ oscillator: { modulationIndex: p.modulationIndex } });
          }
        }
      } else {
        const isFat = t.startsWith("fat");
        const isAMFM = t.startsWith("am") || t.startsWith("fm");
        const isFM = t.startsWith("fm");
        for (const name of SIGN_NAMES) {
          synths[name].set({ oscillator: { type: t } });
          oscTypes[name] = t;
          if (isFat) {
            synths[name].set({
              oscillator: {
                count: SIGN_CHARACTER[name].oscCount,
                spread: p.oscSpread,
              },
            });
            spreadTrk[name] = p.oscSpread;
          }
          if (isAMFM) {
            synths[name].set({ oscillator: { harmonicity: p.harmonicity } });
          }
          if (isFM) {
            synths[name].set({ oscillator: { modulationIndex: p.modulationIndex } });
          }
        }
      }
    };
    applyToBank(eng.synths, eng.oscTypeTracker, eng.spreadTracker);
    applyToBank(eng.synthsB, eng.oscTypeTrackerB, eng.spreadTrackerB);
    pendingOscTypeRef.current = null;
  }

  // Restore spread + detune (Eclipse exit, Breathe shadow cleanup, toggleShadow exit)
  function restoreSpreadAndDetune(eng) {
    const spreadVal = paramsRef.current.oscSpread;
    for (const name of SIGN_NAMES) {
      const sc = SIGN_CHARACTER[name];
      const signType = activeOscTypeRef.current ?? sc.oscType;
      if (signType.startsWith("fat")) {
        eng.synths[name].set({ oscillator: { spread: spreadVal } });
        eng.spreadTracker[name] = spreadVal;
        eng.synthsB[name].set({ oscillator: { spread: spreadVal } });
        eng.spreadTrackerB[name] = spreadVal;
      }
      eng.synths[name].set({ detune: sc.detuneCents });
      eng.detuneTracker[name] = sc.detuneCents;
      eng.synthsB[name].set({ detune: sc.detuneCents });
      eng.detuneTrackerB[name] = sc.detuneCents;
    }
  }

  // Imperative key active state — sets data attributes, bypasses React re-render
  const updateKeyActive = useCallback((sign) => {
    const el = keyRefsRef.current[sign];
    if (!el) return;
    const aa = activeSignsARef.current.has(sign);
    const ab = activeSignsBRef.current.has(sign);
    if (aa || ab) el.setAttribute('data-active', ''); else el.removeAttribute('data-active');
    if (aa && ab) el.setAttribute('data-both', ''); else el.removeAttribute('data-both');
  }, []);

  const toggleSign = useCallback(
    async (sign) => {
      const eng = await ensureEngine();
      const cfg = SIGN_CHARACTER[sign];
      if (!cfg) return;
      const note = `${cfg.note}${cfg.octave}`;
      const p = paramsRef.current;
      const { attack, decay, sustain, release } = p;

      // Determine which banks this sign belongs to (read refs, not state)
      const _na = natalActivationsRef.current;
      const _nb = natalActivationsBRef.current;
      const inA = !!_na[sign];
      const inB = !!_nb[sign];
      // If no chart data at all, default to bank A (manual play)
      const banks = [];
      if (inA || (!inA && !inB)) banks.push({ key: "A", synths: eng.synths, activations: _na, activeRef: activeSignsARef, suffix: "" });
      if (inB) banks.push({ key: "B", synths: eng.synthsB, activations: _nb, activeRef: activeSignsBRef, suffix: "_B" });

      for (const bank of banks) {
        const activeSet = bank.activeRef.current;
        if (activeSet.has(sign)) {
          // ── Release ──
          if (_diag.noteEvents.length >= 100) _diag.noteEvents.shift();
          _diag.noteEvents.push({ type: "release", sign, bank: bank.key, time: performance.now() });
          bank.synths[sign].releaseAll(Tone.now());
          bank.synths[sign].set({ detune: cfg.detuneCents });
          activeSet.delete(sign);
          if (bank.key === "A")
            midiRef.current?.noteOff(SIGN_INDEX[sign], cfg.note, cfg.octave);
          const vs = visualStateRef.current[bank.suffix ? `${sign}${bank.suffix}` : sign];
          if (vs) {
            vs.releaseStartLevel = vs.envelopeLevel;
            vs.stage = "release";
            vs.startTime = performance.now();
            vs.releaseTime = release * cfg.releaseMul;
          }
        } else {
          // ── Attack ──
          applyPendingOscType(eng);
          const mod = aspectModsRef.current?.[bank.key]?.[sign];
          let detune = bank.activations[sign]
            ? bank.activations[sign].detuneCents
            : cfg.detuneCents;
          // Tense aspect against an already-sounding partner voice — push
          // this voice off its natal tuning; the beat carries the tension
          if (mod?.tense?.length) {
            const partnerSounding = mod.tense.some((t) =>
              (t.bank === "A" ? activeSignsARef : activeSignsBRef).current.has(t.sign),
            );
            if (partnerSounding) detune += TUNING.aspectTensionCents;
          }
          bank.synths[sign].set({ detune });
          activeSet.add(sign);
          if (_diag.noteEvents.length >= 100) _diag.noteEvents.shift();
          _diag.noteEvents.push({ type: "attack", sign, bank: bank.key, time: performance.now() });
          const vel = Math.min(0.95, cfg.vel * (1 + (mod?.boost || 0)));
          bank.synths[sign].triggerAttack(note, Tone.now(), vel);
          if (bank.key === "A")
            midiRef.current?.noteOn(SIGN_INDEX[sign], cfg.note, cfg.octave, vel, detune);
          const ci = colorIndexRef.current[sign] || 0;
          colorIndexRef.current[sign] = (ci + 1) % 4;
          const vsKey = bank.suffix ? `${sign}${bank.suffix}` : sign;
          const _hadVs = !!visualStateRef.current[vsKey];
          visualStateRef.current[vsKey] = {
            stage: "attack",
            startTime: performance.now(),
            envelopeLevel: 0,
            attackTime: attack * cfg.attackMul * VIS_SPEED,
            decayTime: decay * cfg.decayMul * VIS_SPEED,
            sustainLevel: Math.min(1, sustain * cfg.sustainMul),
            releaseTime: release * cfg.releaseMul * VIS_SPEED,
            releaseStartLevel: 0,
            activeColor: _SIGN_RGB[sign]?.[ci] ?? _DEFAULT_COLOR,
          };
          if (!_hadVs) _VS_ACTIVE[_vsActiveCount++] = vsKey;
        }
      }
      updateKeyActive(sign);

      // After all banks updated: single adaptive voicing + visual loop + status
      const totalActive = activeSignsARef.current.size + activeSignsBRef.current.size;
      applyAdaptiveVoicing(eng, totalActive);
      if (totalActive > 0 && startLoopRef.current) startLoopRef.current();
      const nowActive = totalActive > 0;
      setStatus(nowActive ? "playing" : "ready");
      setAnyActive(nowActive);
    },
    [ensureEngine, updateKeyActive],
  );

  const handleKeyboardClick = useCallback(
    (e) => {
      const btn = e.target.closest("[data-sign]");
      if (btn) toggleSign(btn.dataset.sign);
    },
    [toggleSign],
  );

  const stopNatalPlayback = useCallback((eng) => {
    for (const name of SIGN_NAMES) {
      eng.synths[name].releaseAll(Tone.now());
      eng.synthsB[name].releaseAll(Tone.now());
    }
    const saved = paramsRef.current;
    eng.fx.reverb.wet.rampTo(saved.reverbWet, 0.5);
  }, []);

  // ─── Orbit mode ───────────────────────────────────────────────
  // Chart voices stop sustaining and breathe on cycles derived from
  // their ruling planets' orbital periods — Cousto applied to rhythm.

  const spawnOrbitVisual = useCallback((sign, bankSuffix, delayMs, holdSec) => {
    const cfg = SIGN_CHARACTER[sign];
    const p = paramsRef.current;
    const vsKey = bankSuffix ? `${sign}${bankSuffix}` : sign;
    const timeouts = orbitRef.current.timeouts;
    const t1 = setTimeout(() => {
      timeouts.delete(t1);
      const ci = colorIndexRef.current[vsKey] || 0;
      colorIndexRef.current[vsKey] = (ci + 1) % 4;
      const had = !!visualStateRef.current[vsKey];
      visualStateRef.current[vsKey] = {
        stage: "attack",
        startTime: performance.now(),
        envelopeLevel: 0,
        attackTime: p.attack * cfg.attackMul * VIS_SPEED,
        decayTime: p.decay * cfg.decayMul * VIS_SPEED,
        sustainLevel: Math.min(1, p.sustain * cfg.sustainMul),
        releaseTime: p.release * cfg.releaseMul * VIS_SPEED,
        releaseStartLevel: 0,
        activeColor: _SIGN_RGB[sign]?.[ci] ?? _DEFAULT_COLOR,
      };
      if (!had) _VS_ACTIVE[_vsActiveCount++] = vsKey;
      if (startLoopRef.current) startLoopRef.current();
    }, delayMs);
    const t2 = setTimeout(() => {
      timeouts.delete(t2);
      const vs = visualStateRef.current[vsKey];
      if (vs && vs.stage !== "idle") {
        vs.releaseStartLevel = vs.envelopeLevel;
        vs.stage = "release";
        vs.startTime = performance.now();
        vs.releaseTime = p.release * cfg.releaseMul * VIS_SPEED;
      }
    }, delayMs + holdSec * 1000);
    timeouts.add(t1);
    timeouts.add(t2);
  }, []);

  const stopOrbit = useCallback((eng) => {
    const ob = orbitRef.current;
    ob.events.forEach((id) => Tone.Transport.clear(id));
    ob.events = [];
    ob.timeouts.forEach(clearTimeout);
    ob.timeouts.clear();
    ob.on = false;
    if (eng) {
      for (const name of SIGN_NAMES) {
        eng.synths[name].releaseAll(Tone.now());
        eng.synthsB[name].releaseAll(Tone.now());
      }
    }
    const p = paramsRef.current;
    for (const sign of KEYBOARD_ORDER) {
      for (const key of [sign, `${sign}_B`]) {
        const vs = visualStateRef.current[key];
        if (vs && vs.stage !== "idle" && vs.stage !== "release") {
          vs.releaseStartLevel = vs.envelopeLevel;
          vs.stage = "release";
          vs.startTime = performance.now();
          vs.releaseTime = p.release * SIGN_CHARACTER[sign].releaseMul * VIS_SPEED;
        }
      }
    }
    midiRef.current?.allOff();
    setOrbit(false);
  }, []);

  const breathe = useCallback(async () => {
    const eng = await ensureEngine();
    if (shadow) {
      const { reverb, echoFeedbackGain, echoCrossfade, vibrato, chebyshev } =
        eng.fx;
      const rt = SHADOW.rampTime;
      const saved = paramsRef.current;
      shadowIntervalsRef.current.forEach((id) => Tone.Transport.clear(id));
      shadowIntervalsRef.current = [];
      reverb.wet.rampTo(saved.reverbWet, rt);
      echoFeedbackGain.gain.rampTo(saved.delayFeedback, rt);
      echoCrossfade.fade.rampTo(saved.delayWet, rt);
      vibrato.depth.rampTo(saved.vibratoDepth, rt);
      vibrato.frequency.rampTo(saved.vibratoFreq, rt);
      chebyshev.wet.rampTo(saved.chebyWet, rt);
      Object.values(eng.panLfos).forEach((lfo) => {
        lfo.frequency.rampTo(saved.panLfoFreq, rt);
        lfo.amplitude.rampTo(saved.panLfoAmplitude, rt);
      });
      restoreSpreadAndDetune(eng);
      setShadow(false);
    }
    // Cycle osc type — 0 → 1 → ... → 7 → null (per-sign) → 0 → ...
    const next =
      oscIndex === null
        ? 0
        : oscIndex + 1 >= OSC_TYPES.length
          ? null
          : oscIndex + 1;
    pendingOscTypeRef.current = next === null ? "per-sign" : OSC_TYPES[next];
    activeOscTypeRef.current = next === null ? null : OSC_TYPES[next];
    setOscIndex(next);
    // Apply immediately if notes are sounding
    if (activeSignsARef.current.size > 0) {
      applyPendingOscType(eng);
    }
  }, [ensureEngine, oscIndex, shadow]);

  const stopAll = useCallback(async () => {
    const eng = await ensureEngine();
    if (orbitRef.current.on) stopOrbit(eng);
    midiRef.current?.allOff();
    stopNatalPlayback(eng);
    const p = paramsRef.current;
    const release = p.release;
    for (const sign of activeSignsARef.current) {
      const vs = visualStateRef.current[sign];
      if (vs) {
        vs.releaseStartLevel = vs.envelopeLevel;
        vs.stage = "release";
        vs.startTime = performance.now();
        vs.releaseTime = release * SIGN_CHARACTER[sign].releaseMul * VIS_SPEED;
      }
    }
    for (const sign of activeSignsBRef.current) {
      const vs = visualStateRef.current[`${sign}_B`];
      if (vs) {
        vs.releaseStartLevel = vs.envelopeLevel;
        vs.stage = "release";
        vs.startTime = performance.now();
        vs.releaseTime = release * SIGN_CHARACTER[sign].releaseMul * VIS_SPEED;
      }
    }
    applyAdaptiveVoicing(eng, 0);
    activeSignsARef.current.clear();
    activeSignsBRef.current.clear();
    for (const s of KEYBOARD_ORDER) updateKeyActive(s);
    setAnyActive(false);
    setStatus("ready");
  }, [ensureEngine, stopNatalPlayback, stopOrbit, updateKeyActive]);

  // Tense-aspect detune for simultaneous starts: the later sign of the
  // pair (keyboard order) takes the shift, so exactly one voice moves.
  const tensionShift = useCallback((mod, sign, _na, _nb) => {
    if (!mod?.tense?.length) return 0;
    const shifted = mod.tense.some((t) => {
      const acts = t.bank === "A" ? _na : _nb;
      return acts[t.sign] && SIGN_INDEX[t.sign] < SIGN_INDEX[sign];
    });
    return shifted ? TUNING.aspectTensionCents : 0;
  }, []);

  const playAll = useCallback(async () => {
    const eng = await ensureEngine();
    if (orbitRef.current.on) stopOrbit(eng);
    applyPendingOscType(eng);
    const p = paramsRef.current;
    const stagger = p.stagger ?? 0;
    let delay = 0;

    const _na = natalActivationsRef.current;
    const _nb = natalActivationsBRef.current;
    const _mods = aspectModsRef.current;
    for (const sign of KEYBOARD_ORDER) {
      const inA = !!_na[sign];
      const inB = !!_nb[sign];
      if (!inA && !inB) continue;

      const cfg = SIGN_CHARACTER[sign];
      const note = `${cfg.note}${cfg.octave}`;
      const { attack, decay, sustain, release } = p;
      const now = Tone.now() + delay;

      if (inA && !activeSignsARef.current.has(sign)) {
        const modA = _mods?.A?.[sign];
        const detuneA =
          _na[sign].detuneCents + tensionShift(modA, sign, _na, _nb);
        eng.synths[sign].set({ detune: detuneA });
        const velA = Math.min(0.95, cfg.vel * (1 + (modA?.boost || 0)));
        eng.synths[sign].triggerAttack(note, now, velA);
        midiRef.current?.noteOn(SIGN_INDEX[sign], cfg.note, cfg.octave, velA, detuneA);
        const ci = colorIndexRef.current[sign] || 0;
        colorIndexRef.current[sign] = (ci + 1) % 4;
        const _hadVsA = !!visualStateRef.current[sign];
        visualStateRef.current[sign] = {
          stage: "attack", startTime: performance.now() + delay * 1000,
          envelopeLevel: 0,
          attackTime: attack * cfg.attackMul * VIS_SPEED,
          decayTime: decay * cfg.decayMul * VIS_SPEED,
          sustainLevel: Math.min(1, sustain * cfg.sustainMul),
          releaseTime: release * cfg.releaseMul * VIS_SPEED,
          releaseStartLevel: 0,
          activeColor: _SIGN_RGB[sign]?.[ci] ?? _DEFAULT_COLOR,
        };
        if (!_hadVsA) _VS_ACTIVE[_vsActiveCount++] = sign;
      }

      if (inB && !activeSignsBRef.current.has(sign)) {
        const modB = _mods?.B?.[sign];
        eng.synthsB[sign].set({
          detune: _nb[sign].detuneCents + tensionShift(modB, sign, _na, _nb),
        });
        const velB = Math.min(0.95, cfg.vel * (1 + (modB?.boost || 0)));
        eng.synthsB[sign].triggerAttack(note, now, velB);
        const ciB = colorIndexRef.current[`${sign}_B`] || 0;
        colorIndexRef.current[`${sign}_B`] = (ciB + 1) % 4;
        const _bKey = `${sign}_B`;
        const _hadVsB = !!visualStateRef.current[_bKey];
        visualStateRef.current[_bKey] = {
          stage: "attack", startTime: performance.now() + delay * 1000,
          envelopeLevel: 0,
          attackTime: attack * cfg.attackMul * VIS_SPEED,
          decayTime: decay * cfg.decayMul * VIS_SPEED,
          sustainLevel: Math.min(1, sustain * cfg.sustainMul),
          releaseTime: release * cfg.releaseMul * VIS_SPEED,
          releaseStartLevel: 0,
          activeColor: _SIGN_RGB[sign]?.[ciB] ?? _DEFAULT_COLOR,
        };
        if (!_hadVsB) _VS_ACTIVE[_vsActiveCount++] = _bKey;
      }

      delay += stagger;
    }

    // Bulk-set active signs after scheduling, update DOM imperatively
    for (const sign of KEYBOARD_ORDER) {
      if (_na[sign]) activeSignsARef.current.add(sign);
      if (_nb[sign]) activeSignsBRef.current.add(sign);
      updateKeyActive(sign);
    }
    applyAdaptiveVoicing(eng, activeSignsARef.current.size + activeSignsBRef.current.size);
    if (startLoopRef.current) startLoopRef.current();
    setAnyActive(true);
    setStatus("playing");
  }, [ensureEngine, stopOrbit, tensionShift, updateKeyActive]);

  const toggleOrbit = useCallback(async () => {
    const eng = await ensureEngine();
    if (orbitRef.current.on) {
      stopOrbit(eng);
      const total = activeSignsARef.current.size + activeSignsBRef.current.size;
      setStatus(total > 0 ? "playing" : "ready");
      return;
    }
    const _na = natalActivationsRef.current;
    const _nb = natalActivationsBRef.current;
    const entries = [];
    for (const sign of KEYBOARD_ORDER) {
      if (_na[sign]) entries.push({ sign, bank: "A" });
      if (_nb[sign]) entries.push({ sign, bank: "B" });
    }
    if (!entries.length) return;

    // Sustained voices hand over to the cycles
    stopNatalPlayback(eng);
    activeSignsARef.current.clear();
    activeSignsBRef.current.clear();
    for (const s of KEYBOARD_ORDER) updateKeyActive(s);
    setAnyActive(false);
    applyPendingOscType(eng);

    entries.forEach((e, i) => {
      const cfg = SIGN_CHARACTER[e.sign];
      const period = orbitPeriodSeconds(SIGN_RULERS[e.sign]);
      const hold = period * TUNING.orbitDuty;
      const phase = period * ((i * 0.618034) % 1) * 0.8; // golden-ratio spread
      const id = Tone.Transport.scheduleRepeat(
        (time) => {
          const acts =
            e.bank === "A"
              ? natalActivationsRef.current
              : natalActivationsBRef.current;
          if (!acts[e.sign]) return; // chart cleared while orbiting
          const synth =
            e.bank === "A" ? eng.synths[e.sign] : eng.synthsB[e.sign];
          const mod = aspectModsRef.current?.[e.bank]?.[e.sign];
          const detune = acts[e.sign].detuneCents;
          synth.set({ detune });
          const vel = Math.min(0.95, cfg.vel * (1 + (mod?.boost || 0)));
          synth.triggerAttackRelease(`${cfg.note}${cfg.octave}`, hold, time, vel);
          const delayMs = Math.max(0, (time - Tone.now()) * 1000);
          spawnOrbitVisual(e.sign, e.bank === "B" ? "_B" : "", delayMs, hold);
          if (e.bank === "A" && midiRef.current) {
            midiRef.current.noteOn(SIGN_INDEX[e.sign], cfg.note, cfg.octave, vel, detune);
            const tOff = setTimeout(() => {
              orbitRef.current.timeouts.delete(tOff);
              midiRef.current?.noteOff(SIGN_INDEX[e.sign], cfg.note, cfg.octave);
            }, delayMs + hold * 1000);
            orbitRef.current.timeouts.add(tOff);
          }
        },
        period,
        `+${phase.toFixed(3)}`,
      );
      orbitRef.current.events.push(id);
    });
    orbitRef.current.on = true;
    applyAdaptiveVoicing(
      eng,
      Math.max(1, Math.round(entries.length * TUNING.orbitDuty)),
    );
    setOrbit(true);
    setStatus("playing");
  }, [ensureEngine, stopOrbit, stopNatalPlayback, updateKeyActive, spawnOrbitVisual]);

  const toggleShadow = useCallback(async () => {
    const eng = await ensureEngine();
    const { reverb, echoFeedbackGain, echoCrossfade, vibrato, chebyshev } =
      eng.fx;
    const st = SHADOW;

    if (!shadow) {
      const rt = st.rampTime;
      reverb.wet.rampTo(st.reverbWet, rt);
      echoFeedbackGain.gain.rampTo(st.delayFeedback, rt);
      echoCrossfade.fade.rampTo(st.delayWet, rt);
      vibrato.depth.rampTo(st.vibratoDepth, rt);
      vibrato.frequency.rampTo(st.vibratoFreq, rt);
      chebyshev.wet.rampTo(st.chebyWet, rt);

      Object.values(eng.panLfos).forEach((lfo) => {
        lfo.frequency.rampTo(st.panLfoFreq, rt);
        lfo.amplitude.rampTo(st.panLfoAmplitude, rt);
      });

      // Slow spread ramp — per-sign fat check (AM/FM signs skip spread)
      const intervals = [];
      const spreadEventId = Tone.Transport.scheduleRepeat(() => {
        let allDone = true;
        for (const name of SIGN_NAMES) {
          const signType =
            activeOscTypeRef.current ?? SIGN_CHARACTER[name].oscType;
          if (!signType.startsWith("fat")) continue;
          const current = eng.spreadTracker[name];
          if (current < st.oscSpread) {
            allDone = false;
            const next = Math.min(current + 4, st.oscSpread);
            eng.spreadTracker[name] = next;
            eng.synths[name].set({ oscillator: { spread: next } });
            eng.spreadTrackerB[name] = next;
            eng.synthsB[name].set({ oscillator: { spread: next } });
          }
        }
        if (allDone) Tone.Transport.clear(spreadEventId);
      }, 0.2);
      intervals.push(spreadEventId);

      // Smooth detune drift — lerp toward random targets
      const detuneId = Tone.Transport.scheduleRepeat(() => {
        for (const name of SIGN_NAMES) {
          const base = SIGN_CHARACTER[name]?.detuneCents || 0;
          const current = eng.detuneTracker[name] ?? base;
          const target = base + (Math.random() * 2 - 1) * st.detuneRange;
          const next = current + (target - current) * 0.3;
          eng.detuneTracker[name] = next;
          eng.synths[name].set({ detune: next });
          eng.detuneTrackerB[name] = next;
          eng.synthsB[name].set({ detune: next });
        }
      }, 1.2);
      intervals.push(detuneId);

      shadowIntervalsRef.current = intervals;
    } else {
      shadowIntervalsRef.current.forEach((id) => Tone.Transport.clear(id));
      shadowIntervalsRef.current = [];

      const rt = st.rampTime;
      const saved = paramsRef.current;
      reverb.wet.rampTo(saved.reverbWet, rt);
      echoFeedbackGain.gain.rampTo(saved.delayFeedback, rt);
      echoCrossfade.fade.rampTo(saved.delayWet, rt);
      vibrato.depth.rampTo(saved.vibratoDepth, rt);
      vibrato.frequency.rampTo(saved.vibratoFreq, rt);
      chebyshev.wet.rampTo(saved.chebyWet, rt);

      Object.values(eng.panLfos).forEach((lfo) => {
        lfo.frequency.rampTo(saved.panLfoFreq, rt);
        lfo.amplitude.rampTo(saved.panLfoAmplitude, rt);
      });

      restoreSpreadAndDetune(eng);
    }
    setShadow((s) => !s);
  }, [shadow, ensureEngine]);

  const applyListenPreset = useCallback(
    async (key) => {
      const eng = await ensureEngine();
      const preset = LISTEN_PRESETS[key];
      if (!preset || !eng.fx.monitorEQ) return;
      eng.fx.monitorEQ.low.value = preset.low;
      eng.fx.monitorEQ.mid.value = preset.mid;
      eng.fx.monitorEQ.high.value = preset.high;
      setListenPreset(key);
    },
    [ensureEngine],
  );

  const listenHandlers = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(LISTEN_PRESETS).map((k) => [k, () => applyListenPreset(k)]),
      ),
    [applyListenPreset],
  );

  const selectChain = useCallback((key) => {
    activeChainRef.current = key;
    setActiveChain(key);
    engineRef.current?.rewireChain(key);
  }, []);

  const chainHandlers = useMemo(
    () => Object.fromEntries(CHAIN_KEYS.map((k) => [k, () => selectChain(k)])),
    [selectChain],
  );

  const toggleRecord = useCallback(async () => {
    const eng = await ensureEngine();
    if (!eng.recorder) return;
    if (!recordingRef.current) {
      eng.recorder.start();
      recordingRef.current = true;
      setRecording(true);
    } else {
      const blob = await eng.recorder.stop();
      recordingRef.current = false;
      setRecording(false);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `celezdial-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [ensureEngine]);

  const togglePerform = useCallback(() => {
    setPerform((prev) => {
      const next = !prev;
      if (next) {
        rootRef.current?.requestFullscreen?.().catch(() => {});
      } else if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) setPerform(false);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // MIDI out pill — off → each output → off. Access requested on first tap.
  const cycleMidi = useCallback(async () => {
    try {
      if (!midiRef.current) midiRef.current = new MidiOut();
      const outs = await midiRef.current.init();
      if (!outs.length) {
        setMidiLabel("midi: none found");
        return;
      }
      const cur = midiRef.current.output;
      const idx = outs.indexOf(cur);
      const next =
        cur === null ? outs[0] : idx + 1 < outs.length ? outs[idx + 1] : null;
      midiRef.current.setOutput(next);
      setMidiLabel(next ? `midi: ${next.name}` : "midi: off");
    } catch {
      setMidiLabel("midi: denied");
    }
  }, []);

  // QWERTY play — awsedftgyhuj mirrors the 12 keys, piano-style
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const t = e.target;
      if (
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)
      )
        return;
      const sign = KEY_TO_SIGN[e.key?.toLowerCase?.()];
      if (sign) {
        e.preventDefault();
        toggleSign(sign);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSign]);

  // Transit fill — the current sky as a chart. The library interprets
  // the time fields in the timezone at the given coordinates, so a bare
  // local wall-clock at lng 0 would be read as UTC and land hours off.
  // Geolocation (a contextual prompt, on the button press) fixes the
  // timezone and buys the Ascendant; if it's denied or unavailable, the
  // fields fill with UTC wall-time instead, which keeps the instant
  // astronomically exact at the default coordinates.
  const fillNowChart = useCallback(
    (setDate, setTime, setLat, setLng, setQuery, selectedRef) => {
      const pad = (n) => String(n).padStart(2, "0");
      const d = new Date();
      setDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
      setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
      const fallbackToUtc = () => {
        setDate(
          `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
        );
        setTime(`${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`);
        setLat(null);
        setLng(null);
        selectedRef.current = true;
        setQuery("");
      };
      if (!navigator.geolocation) {
        fallbackToUtc();
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
          selectedRef.current = true; // suppress autocomplete fetch
          setQuery("here");
          // Sync the picker to the real place name (city-level zoom)
          fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json&zoom=10`,
          )
            .then((r) => r.json())
            .then((j) => {
              if (j?.display_name) {
                selectedRef.current = true;
                setQuery(j.display_name.split(", ").slice(0, 3).join(", "));
              }
            })
            .catch(() => {});
        },
        fallbackToUtc,
        { timeout: 6000, maximumAge: 600000 },
      );
    },
    [],
  );

  const fillNowA = useCallback(() => {
    fillNowChart(setNatalDate, setNatalTime, setNatalLat, setNatalLng, setCityQueryA, citySelectedARef);
  }, [fillNowChart]);

  const fillNowB = useCallback(() => {
    fillNowChart(setNatalDateB, setNatalTimeB, setNatalLatB, setNatalLngB, setCityQueryB, citySelectedBRef);
  }, [fillNowChart]);

  const cityCacheRef = useRef(new Map());
  const fetchCitySuggestions = async (query) => {
    const cache = cityCacheRef.current;
    if (cache.has(query)) return cache.get(query);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
    );
    const json = await res.json();
    if (cache.size > 50) cache.clear();
    cache.set(query, json);
    return json;
  };

  const selectCity = (result, setLat, setLng, setQuery, setSuggestions, setHighlight, selectedRef) => {
    setLat(parseFloat(result.lat));
    setLng(parseFloat(result.lon));
    const parts = result.display_name.split(", ");
    selectedRef.current = true;
    setQuery(parts.slice(0, 3).join(", "));
    setSuggestions([]);
    setHighlight(-1);
  };

  const handleCityKeyDown = (e, suggestions, highlight, setHighlight, onSelect) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
    } else if (e.key === "Enter" && highlight >= 0 && suggestions[highlight]) {
      e.preventDefault();
      onSelect(suggestions[highlight]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setCitySuggestionsA([]);
      setCitySuggestionsB([]);
    }
  };

  useEffect(() => {
    clearTimeout(cityDebounceARef.current);
    if (citySelectedARef.current) { citySelectedARef.current = false; return; }
    if (cityQueryA.length < 2) { setCitySuggestionsA([]); return; }
    setCityLoadingA(true);
    cityDebounceARef.current = setTimeout(async () => {
      const gen = ++cityGenARef.current;
      try {
        const results = await fetchCitySuggestions(cityQueryA);
        if (gen !== cityGenARef.current) return;
        setCitySuggestionsA(results);
      } catch { setCitySuggestionsA([]); }
      if (gen === cityGenARef.current) setCityLoadingA(false);
    }, 500);
    return () => clearTimeout(cityDebounceARef.current);
  }, [cityQueryA]);

  useEffect(() => {
    clearTimeout(cityDebounceBRef.current);
    if (citySelectedBRef.current) { citySelectedBRef.current = false; return; }
    if (cityQueryB.length < 2) { setCitySuggestionsB([]); return; }
    setCityLoadingB(true);
    cityDebounceBRef.current = setTimeout(async () => {
      const gen = ++cityGenBRef.current;
      try {
        const results = await fetchCitySuggestions(cityQueryB);
        if (gen !== cityGenBRef.current) return;
        setCitySuggestionsB(results);
      } catch { setCitySuggestionsB([]); }
      if (gen === cityGenBRef.current) setCityLoadingB(false);
    }, 500);
    return () => clearTimeout(cityDebounceBRef.current);
  }, [cityQueryB]);

  useEffect(() => {
    clearTimeout(natalDebounceARef.current);
    natalDebounceARef.current = setTimeout(async () => {
      const gen = ++natalGenARef.current;
      if (natalDate) {
        const result = await computeChart(natalDate, natalTime, natalLat, natalLng);
        if (gen !== natalGenARef.current) return;
        const na = result ? result.activations : {};
        natalActivationsRef.current = na;
        setNatalActivations(na);
        setBodiesA(result ? result.bodies : {});
        setAspectsA(result ? result.aspects : []);
      } else {
        natalActivationsRef.current = {};
        setNatalActivations({});
        setBodiesA({});
        setAspectsA([]);
      }
    }, 300);
    return () => clearTimeout(natalDebounceARef.current);
  }, [natalDate, natalTime, natalLat, natalLng]);

  useEffect(() => {
    clearTimeout(natalDebounceBRef.current);
    natalDebounceBRef.current = setTimeout(async () => {
      const gen = ++natalGenBRef.current;
      if (natalDateB) {
        const result = await computeChart(natalDateB, natalTimeB, natalLatB, natalLngB);
        if (gen !== natalGenBRef.current) return;
        const nb = result ? result.activations : {};
        natalActivationsBRef.current = nb;
        setNatalActivationsB(nb);
        setBodiesB(result ? result.bodies : {});
        setAspectsB(result ? result.aspects : []);
      } else {
        natalActivationsBRef.current = {};
        setNatalActivationsB({});
        setBodiesB({});
        setAspectsB([]);
      }
    }, 300);
    return () => clearTimeout(natalDebounceBRef.current);
  }, [natalDateB, natalTimeB, natalLatB, natalLngB]);

  return (
    <>
      <style>{CSS}</style>
      <div
        className={`cel-root${shadow ? " cel-eclipse-active" : ""}${perform ? " cel-perform" : ""}`}
        ref={rootRef}
      >
        <canvas className="cel-emanation" ref={emanationRef} />

        <KeyboardSection
          natalActivations={natalActivations}
          natalActivationsB={natalActivationsB}
          bodiesA={bodiesA}
          bodiesB={bodiesB}
          onClick={handleKeyboardClick}
          keyRefCallbacks={keyRefCallbacks}
        />

        {!perform && (
        <div className="cel-natal cel-natal-dual">
          <div className="cel-natal-body">
            <div className="cel-natal-chart-label" style={STYLE_CHART_A}>
              Chart A
              <button type="button" className="cel-now-btn" onClick={fillNowA} title="Fill with the sky right now. Birth chart in A against now in B is a transit reading.">
                now
              </button>
            </div>
            <div className="cel-natal-inputs">
              <label className="cel-natal-field cel-pinned">
                <span>Birth date</span>
                <input
                  type="date"
                  className="cel-natal-input"
                  value={natalDate}
                  onChange={(e) => setNatalDate(e.target.value)}
                />
              </label>
              <label className="cel-natal-field cel-pinned">
                <span>Time</span>
                <input
                  type="time"
                  className="cel-natal-input"
                  value={natalTime}
                  onChange={(e) => setNatalTime(e.target.value)}
                />
              </label>
              <div className="cel-natal-city-wrap">
                <label className={`cel-natal-field${cityQueryA ? " has-value" : ""}`}>
                  <span>Birth city</span>
                  <input
                    type="text"
                    className="cel-natal-input"
                    autoComplete="off"
                    value={cityQueryA}
                    onChange={(e) => { setCityQueryA(e.target.value); setCityHighlightA(-1); }}
                    onBlur={() => setTimeout(() => setCitySuggestionsA([]), 150)}
                    onKeyDown={(e) => handleCityKeyDown(e, citySuggestionsA, cityHighlightA, setCityHighlightA,
                      (r) => selectCity(r, setNatalLat, setNatalLng, setCityQueryA, setCitySuggestionsA, setCityHighlightA, citySelectedARef))}
                  />
                  {cityLoadingA && <span className="cel-city-spinner">…</span>}
                </label>
                {citySuggestionsA.length > 0 && (
                  <ul className="cel-city-dropdown" role="listbox">
                    {citySuggestionsA.map((s, i) => (
                      <li key={s.place_id} role="option" aria-selected={i === cityHighlightA}
                        className={`cel-city-option${i === cityHighlightA ? " highlighted" : ""}`}
                        onMouseDown={() => selectCity(s, setNatalLat, setNatalLng, setCityQueryA, setCitySuggestionsA, setCityHighlightA, citySelectedARef)}>
                        {s.display_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="cel-natal-body">
            <div className="cel-natal-chart-label" style={STYLE_CHART_B}>
              Chart B
              <button type="button" className="cel-now-btn" onClick={fillNowB} title="Fill with the sky right now. Birth chart in A against now in B is a transit reading.">
                now
              </button>
            </div>
            <div className="cel-natal-inputs">
              <label className="cel-natal-field cel-pinned">
                <span>Birth date</span>
                <input
                  type="date"
                  className="cel-natal-input"
                  value={natalDateB}
                  onChange={(e) => setNatalDateB(e.target.value)}
                />
              </label>
              <label className="cel-natal-field cel-pinned">
                <span>Time</span>
                <input
                  type="time"
                  className="cel-natal-input"
                  value={natalTimeB}
                  onChange={(e) => setNatalTimeB(e.target.value)}
                />
              </label>
              <div className="cel-natal-city-wrap">
                <label className={`cel-natal-field${cityQueryB ? " has-value" : ""}`}>
                  <span>Birth city</span>
                  <input
                    type="text"
                    className="cel-natal-input"
                    autoComplete="off"
                    value={cityQueryB}
                    onChange={(e) => { setCityQueryB(e.target.value); setCityHighlightB(-1); }}
                    onBlur={() => setTimeout(() => setCitySuggestionsB([]), 150)}
                    onKeyDown={(e) => handleCityKeyDown(e, citySuggestionsB, cityHighlightB, setCityHighlightB,
                      (r) => selectCity(r, setNatalLatB, setNatalLngB, setCityQueryB, setCitySuggestionsB, setCityHighlightB, citySelectedBRef))}
                  />
                  {cityLoadingB && <span className="cel-city-spinner">…</span>}
                </label>
                {citySuggestionsB.length > 0 && (
                  <ul className="cel-city-dropdown" role="listbox">
                    {citySuggestionsB.map((s, i) => (
                      <li key={s.place_id} role="option" aria-selected={i === cityHighlightB}
                        className={`cel-city-option${i === cityHighlightB ? " highlighted" : ""}`}
                        onMouseDown={() => selectCity(s, setNatalLatB, setNatalLngB, setCityQueryB, setCitySuggestionsB, setCityHighlightB, citySelectedBRef)}>
                        {s.display_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {infoPanelSigns.hasAny && (
            <div className="cel-playback-controls">
              <button
                type="button"
                className="cel-btn cel-natal-play"
                onClick={anyActive ? stopAll : playAll}
              >
                {anyActive ? "Pause" : "Play"}
              </button>
              <button
                type="button"
                className={`cel-btn cel-orbit-btn${orbit ? " cel-orbit-active" : ""}`}
                onClick={toggleOrbit}
                title="Voices breathe on their ruling planets' orbital periods"
              >
                Orbit
              </button>
            </div>
          )}

          {/* Info panel — shared signs first, then unique per chart */}
          {infoPanelSigns.hasAny && (
          <div className="cel-natal-info-panel">
            {infoPanelSigns.hasBoth ? (
              <p className="cel-natal-context">
                Two charts at once. A shared sign plays both tunings of its
                note, and the beat between them is how far apart the two
                charts sit in that sign.
              </p>
            ) : (
              <p className="cel-natal-context">
                Each planet plays the note of its sign, tuned by its exact
                degree. Play sounds the whole chart at once.
              </p>
            )}
            {infoPanelSigns.shared.length > 0 && (
              <div className="cel-natal-info-section">
                <div className="cel-natal-section-header cel-natal-shared-header">
                  {infoPanelSigns.shared.length} shared {infoPanelSigns.shared.length === 1 ? "sign" : "signs"}
                </div>
                <div className="cel-natal-grid">
                  {infoPanelSigns.shared.map(sign => (
                    <span key={sign} className="cel-natal-item cel-natal-shared">
                      {SIGNS[sign].glyph} {sign}:
                      <span style={STYLE_CHART_A}> {planetsWithDegrees(natalActivations[sign].planets, bodiesA)}</span>
                      {" · "}
                      <span style={STYLE_CHART_B}>{planetsWithDegrees(natalActivationsB[sign].planets, bodiesB)}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {infoPanelSigns.onlyA.length > 0 && (
              <div className="cel-natal-info-section">
                <div className="cel-natal-section-header" style={STYLE_CHART_A}>
                  Chart A{natalDate ? ` · ${natalDate}` : ""}{infoPanelSigns.onlyA.length < infoPanelSigns.keysA.length ? ` (${infoPanelSigns.onlyA.length} unique)` : ""}
                </div>
                <div className="cel-natal-grid">
                  {infoPanelSigns.onlyA.map(sign => (
                    <span key={sign} className="cel-natal-item">
                      {SIGNS[sign].glyph} {sign}: {planetsWithDegrees(natalActivations[sign].planets, bodiesA)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {infoPanelSigns.onlyB.length > 0 && (
              <div className="cel-natal-info-section">
                <div className="cel-natal-section-header" style={STYLE_CHART_B}>
                  Chart B{natalDateB ? ` · ${natalDateB}` : ""}{infoPanelSigns.onlyB.length < infoPanelSigns.keysB.length ? ` (${infoPanelSigns.onlyB.length} unique)` : ""}
                </div>
                <div className="cel-natal-grid">
                  {infoPanelSigns.onlyB.map(sign => (
                    <span key={sign} className="cel-natal-item">
                      {SIGNS[sign].glyph} {sign}: {planetsWithDegrees(natalActivationsB[sign].planets, bodiesB)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(synastryAspects.length > 0 || aspectsA.length > 0 || aspectsB.length > 0) && (
              <div className="cel-natal-info-section">
                {synastryAspects.length > 0 && (
                  <>
                    <div className="cel-natal-section-header cel-natal-shared-header">
                      {synastryAspects.length} cross-chart {synastryAspects.length === 1 ? "aspect" : "aspects"}
                    </div>
                    <div className="cel-natal-grid">
                      {synastryAspects.map((a) => (
                        <span
                          key={`syn-${a.p1}-${a.key}-${a.p2}`}
                          className={`cel-aspect cel-aspect-${ASPECTS[a.key].quality}`}
                        >
                          <span style={STYLE_CHART_A}>{BODY_GLYPHS[a.p1] || a.p1}</span>
                          {" "}{ASPECTS[a.key].glyph}{" "}
                          <span style={STYLE_CHART_B}>{BODY_GLYPHS[a.p2] || a.p2}</span>
                          <span className="cel-aspect-orb"> {a.orb.toFixed(1)}°</span>
                        </span>
                      ))}
                    </div>
                  </>
                )}
                {aspectsA.length > 0 && (
                  <>
                    <div className="cel-natal-section-header" style={STYLE_CHART_A}>
                      Chart A aspects
                    </div>
                    <div className="cel-natal-grid">
                      {aspectsA.map((a) => (
                        <span
                          key={`a-${a.p1}-${a.key}-${a.p2}`}
                          className={`cel-aspect cel-aspect-${ASPECTS[a.key].quality}`}
                        >
                          {BODY_GLYPHS[a.p1] || a.p1} {ASPECTS[a.key].glyph}{" "}
                          {BODY_GLYPHS[a.p2] || a.p2}
                          <span className="cel-aspect-orb"> {a.orb.toFixed(1)}°</span>
                        </span>
                      ))}
                    </div>
                  </>
                )}
                {aspectsB.length > 0 && (
                  <>
                    <div className="cel-natal-section-header" style={STYLE_CHART_B}>
                      Chart B aspects
                    </div>
                    <div className="cel-natal-grid">
                      {aspectsB.map((a) => (
                        <span
                          key={`b-${a.p1}-${a.key}-${a.p2}`}
                          className={`cel-aspect cel-aspect-${ASPECTS[a.key].quality}`}
                        >
                          {BODY_GLYPHS[a.p1] || a.p1} {ASPECTS[a.key].glyph}{" "}
                          {BODY_GLYPHS[a.p2] || a.p2}
                          <span className="cel-aspect-orb"> {a.orb.toFixed(1)}°</span>
                        </span>
                      ))}
                    </div>
                  </>
                )}
                <p className="cel-natal-context">
                  <span className="cel-aspect-focal">
                    {ASPECTS.conjunction.glyph} conjunction
                  </span>{" "}
                  stacks a voice ·{" "}
                  <span className="cel-aspect-consonant">
                    {ASPECTS.trine.glyph} trine {ASPECTS.sextile.glyph} sextile
                  </span>{" "}
                  lift theirs ·{" "}
                  <span className="cel-aspect-tense">
                    {ASPECTS.square.glyph} square {ASPECTS.opposition.glyph}{" "}
                    opposition
                  </span>{" "}
                  set the pair beating
                </p>
              </div>
            )}
            <div className="cel-natal-legend">
              {Object.entries(BODY_GLYPHS).map(([name, glyph]) => (
                <span key={name} className="cel-legend-item">{glyph} {name}</span>
              ))}
            </div>
          </div>
          )}
        </div>
        )}

        {!perform && (
          <section className="cel-guide" aria-label="What am I hearing?">
            <h2 className="cel-guide-title">what am I hearing?</h2>
            <p>
              The twelve signs are the twelve notes of the chromatic scale,
              C through B. That mapping is Lionel Williams' chromatic
              calendar: the zodiac year laid over one octave, with Aquarius
              at C and Aries, the spring equinox, at D.
            </p>
            <p>
              Enter a birth and every planet lights the sign it occupies.
              Each lit key plays its sign's note. The Sun and Moon come in
              loudest, Jupiter and Saturn sit low in the mix, and each sign
              keeps its ruling planet's temperament: Mars signs attack fast
              and saw-edged, Saturn signs bloom slowly.
            </p>
            <p>
              Where a planet sits inside its sign bends the tuning. The
              first degree sounds 50 cents flat, the middle is true, the
              last degree 50 cents sharp. Two people with the Sun in the
              same sign play two tunings of one note, and the slow shimmer
              between them is the distance between their charts.
            </p>
            <p>
              Aspects, the angles between planets, color the mix. A trine
              or sextile lifts its voices. A square or opposition pulls one
              of the pair a few cents off pitch, so the two grind quietly
              against each other. A conjunction stacks planets on a single
              voice and it steps forward.
            </p>
            <p>
              Underneath it all, every note carries its ruling planet's
              Cousto tone at half strength: the planet's orbital period,
              octave-doubled up into pitch. Orbit mode does the same thing
              to time. Each voice swells and fades at its planet's pace,
              the Moon in seconds, Saturn in minutes, so the chord never
              repeats itself.
            </p>
            <p className="cel-guide-system">
              tropical zodiac · whole-sign · traditional rulers · Sun
              through Pluto, Chiron, Ascendant · 100 cents per sign ·
              Cousto tuning ×0.5
            </p>
          </section>
        )}

        {!perform && (
        <details className="cel-veil">
          <summary className="cel-oracle">
            {/* <span className="cel-oracle-line">.</span>
            <span className="cel-oracle-line">. .</span>
            <span className="cel-oracle-line">. . .</span>*/}
            <span className="cel-oracle-line">
              . . . . . . . . . . . . . . .
            </span>
            <span className="cel-oracle-line">
              . . . &nbsp; l o o k &nbsp; . . .
            </span>
            <span className="cel-oracle-line">
              . . &nbsp;w i t h i n&nbsp; . .
            </span>
            <span className="cel-oracle-line">. . . . . . . .</span>
          </summary>
          <div className="cel-controls">
            <button
              type="button"
              className={`cel-btn cel-shadow-btn${shadow ? " cel-shadow-active" : ""}`}
              onClick={toggleShadow}
            >
              <span className="cel-btn-glyph">&nbsp;{"\u25D0"}&nbsp;</span>
              <span className="cel-btn-label">eclipse</span>
            </button>
            <button
              type="button"
              className="cel-btn cel-breathe-btn"
              onClick={breathe}
            >
              <span className="cel-btn-label">
                {oscIndex === null ? "dynamic" : OSC_TYPES[oscIndex]}
              </span>
              <span className="cel-btn-glyph">{"\u3030"}</span>
            </button>
            <button
              type="button"
              className="cel-btn cel-randomize-btn"
              onClick={randomizeParams}
            >
              <span className="cel-btn-label">randomize</span>
              <span className="cel-btn-glyph">{"\u2042"}</span>
            </button>
          </div>
          <div className="cel-macros">
            {groupedKnobs.map((item) =>
              item.type === "row" ? (
                <div
                  key={item.groups.map((g) => g.key).join("-")}
                  className="cel-group-row"
                >
                  {item.groups.map((g) => (
                    <div key={g.key} className="cel-group">
                      <span className="cel-group-label">{g.label}</span>
                      <div className="cel-group-knobs">
                        {g.knobs.map(([name, def]) => (
                          <Knob
                            key={name}
                            label={def.label}
                            value={params[name]}
                            defaultValue={def.default}
                            min={def.min}
                            max={def.max}
                            {...knobScaleProps[name]}
                            format={formatFns[name]}
                            onChange={paramSetters[name]}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div key={item.key} className="cel-group">
                  <span className="cel-group-label">{item.label}</span>
                  <div className="cel-group-knobs">
                    {item.knobs.map(([name, def]) => (
                      <Knob
                        key={name}
                        label={def.label}
                        value={params[name]}
                        defaultValue={def.default}
                        min={def.min}
                        max={def.max}
                        {...knobScaleProps[name]}
                        format={formatFns[name]}
                        onChange={paramSetters[name]}
                      />
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
          <div className="cel-chains">
            {CHAIN_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={`cel-listen-pill${activeChain === key ? " cel-listen-active" : ""}`}
                onClick={chainHandlers[key]}
              >
                {key}
              </button>
            ))}
          </div>
          <div className="cel-listen">
            {Object.entries(LISTEN_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                type="button"
                className={`cel-listen-pill${listenPreset === key ? " cel-listen-active" : ""}`}
                onClick={listenHandlers[key]}
              >
                {preset.label}
              </button>
            ))}
            {midiSupported() && (
              <button
                type="button"
                className={`cel-listen-pill${midiRef.current?.output ? " cel-listen-active" : ""}`}
                onClick={cycleMidi}
                title="Chart A drives hardware: one channel per sign, detune as pitch bend"
              >
                {midiLabel}
              </button>
            )}
          </div>
          <div className="cel-veil-actions">
            <button
              type="button"
              className="cel-btn cel-snapshot-btn"
              onClick={exportSnapshot}
            >
              Save
            </button>
            <button
              type="button"
              className="cel-btn cel-snapshot-btn"
              onClick={() => loadInputRef.current?.click()}
            >
              Load
            </button>
            <button
              type="button"
              className="cel-btn cel-snapshot-btn"
              onClick={shareLink}
              title="Copy a link that carries the whole state, charts included. Birth data stays in the URL fragment and never reaches a server."
            >
              {linkFeedback ? "Linked!" : "Link"}
            </button>
            {CAN_RECORD && (
              <button
                type="button"
                className={`cel-btn cel-snapshot-btn${recording ? " cel-record-active" : ""}`}
                onClick={toggleRecord}
              >
                {recording ? "■ Stop" : "● Record"}
              </button>
            )}
            <button
              type="button"
              className="cel-btn cel-snapshot-btn"
              onClick={togglePerform}
            >
              Perform
            </button>
            <input
              ref={loadInputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              onChange={loadSnapshotFile}
            />
          </div>
        </details>
        )}

        {perform && (
          <button
            type="button"
            className="cel-perform-exit"
            onClick={togglePerform}
            aria-label="Exit performance mode"
          >
            ✕
          </button>
        )}
      </div>
      {!perform && (
        <div className="cel-footer">
          <p>v14 &middot; 12&times;2</p>
          <h1 className="cel-title">celezdial selekta</h1>
        </div>
      )}
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const CSS = `
  @font-face {
    font-family: 'Spiral ST';
    src: url('${import.meta.env.BASE_URL}fonts/spiral-st/SpiralST.woff2') format('woff2'),
         url('${import.meta.env.BASE_URL}fonts/spiral-st/SpiralST.ttf') format('truetype');
    font-display: swap;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: #0c0c0c;
    overflow-x: hidden;
  }

  .cel-root {
    position: relative;
    min-height: 100vh;
    background: #0c0c0c;
    color: #d8d0e8;
    font-family: ${FONTS.body};
    display: flex;
    flex-direction: column;
    align-items: center;
    contain: layout;
    padding: 2.5rem 1rem calc(3rem + env(safe-area-inset-bottom, 0px));
    user-select: none;
    -webkit-user-select: none;
    isolation: isolate;
  }

  .cel-emanation {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: -1;
    pointer-events: none;
    contain: strict;
    will-change: transform;   /* promote to GPU layer; scroll won't repaint it */
  }

  /* ── Title + Oracle ────────────────────────────────── */

  .cel-title {
    font-family: ${FONTS.title};
    font-size: 1rem;
    font-weight: 400;
    letter-spacing: 0.15em;
    color: #504868;
    margin: 0;
  }

  /* Pin the veil to the viewport. Without this the details element grows
     to its widest non-wrapping child (the action row's 7 buttons), which
     on a phone balloons past the screen and stops every row inside from
     wrapping. */
  .cel-veil {
    width: 100%;
    max-width: 600px;
  }

  .cel-oracle {
    text-align: center;
    color: #a098b8;
    font-size: 0.75rem;
    letter-spacing: 0.35em;
    line-height: 1.3;
    cursor: pointer;
    list-style: none;
    padding: 8px;
    margin-bottom: 0.5rem;
    opacity: 0.5;
    transition: opacity 0.3s ease;
  }

  .cel-oracle::-webkit-details-marker { display: none; }

  .cel-oracle:hover { opacity: 0.7; }

  .cel-veil[open] > .cel-oracle { opacity: 0.2; margin-bottom: 8px; }

  .cel-oracle-line {
    display: block;
  }

  /* ── Guide (what am i hearing) — always visible ─────── */

  .cel-guide {
    width: 100%;
    max-width: 560px;
    margin: 0 auto 1.5rem;
    padding: 1.1rem 0 0.2rem;
    border-top: 1px solid rgba(180, 140, 255, 0.1);
  }

  .cel-guide-title {
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(180, 140, 255, 0.5);
    margin-bottom: 0.8rem;
  }

  .cel-guide p {
    color: #8878a0;
    font-size: 0.8rem;
    line-height: 1.7;
    margin-bottom: 0.8rem;
  }

  .cel-guide-system {
    font-family: ${FONTS.mono};
    font-size: 0.64rem;
    color: #504868;
    letter-spacing: 0.03em;
    margin-top: 0.3rem;
  }

  /* ── Piano keyboard layout ──────────────────────────── */

  .cel-keyboard {
    position: relative;
    display: flex;
    gap: 2px;
    max-width: 560px;
    width: 100%;
    height: 160px;
    margin-bottom: 1.2rem;
    overflow: visible;
    contain: layout;
  }

  .cel-key {
    border: none;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    gap: 0.15rem;
    color: #d8d0e8;
    transition: background 0.15s ease, border-color 0.15s ease;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    outline: none;
    padding-bottom: 0.6rem;
    position: relative;
    contain: layout style;
  }

  .cel-key::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow: 0 0 16px currentColor;
    opacity: var(--glow-opacity, 0);
    color: var(--glow-hue, transparent);
    pointer-events: none;
    will-change: opacity;
  }

  .cel-key:active {
    transform: scale(0.97);
  }

  .cel-key-natural {
    position: relative;
    flex: 1;
    height: 100%;
    background: #161616;
    border: 1px solid rgba(180, 140, 255, 0.12);
    border-radius: 0 0 8px 8px;
    z-index: 1;
  }

  .cel-key-natural:hover {
    background: #19162f;
    border-color: rgba(180, 140, 255, 0.3);
  }

  .cel-key-sharp {
    position: absolute;
    top: 0;
    width: 9%;
    height: 58%;
    background: #1d0f38;
    border: 1px solid rgba(180, 140, 255, 0.25);
    border-radius: 0 0 6px 6px;
    z-index: 2;
    padding-bottom: 0.4rem;
  }

  .cel-key-sharp:hover {
    background: #301a4e;
    border-color: rgba(180, 140, 255, 0.45);
  }

  .cel-key-natural[data-active] {
    background: #221a3a;
    border-color: rgba(180, 140, 255, 0.55);
  }

  .cel-key-natural[data-active]:hover {
    background: #2c2046;
    border-color: rgba(180, 140, 255, 0.65);
  }

  .cel-key-sharp[data-active] {
    background: #4e288a;
    border-color: rgba(200, 160, 255, 0.6);
  }

  .cel-key-sharp[data-active]:hover {
    background: #6032a0;
    border-color: rgba(200, 160, 255, 0.7);
  }

  .cel-key-glyph {
    font-size: 1.3rem;
    color: #c4a0ff;
  }

  .cel-key-sharp .cel-key-glyph {
    font-size: 1rem;
  }

  .cel-key[data-active] .cel-key-glyph {
    color: #e0c8ff;
    text-shadow: 0 0 10px rgba(200, 160, 255, 0.6);
  }

  .cel-key-glyph-sm {
    font-size: 0.9rem;
  }

  .cel-key-name {
    font-weight: 600;
    font-size: 0.7rem;
    letter-spacing: 0.02em;
  }

  .cel-key-sharp .cel-key-name {
    font-size: 0.55rem;
  }

  .cel-key-note {
    font-size: 0.6rem;
    color: #8070a0;
  }

  .cel-key[data-active] .cel-key-note {
    color: #b8a0d8;
  }

  .cel-key-uncertain {
    opacity: 0.4;
  }

  /* ── Eclipse mode ─────────────────────────────────────── */

  .cel-eclipse-active .cel-key::before {
    box-shadow: 0 0 20px currentColor, 0 0 40px currentColor;
  }

  /* ── Controls row (Eclipse + Breathe + Randomize) ───── */

  .cel-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.8rem;
    justify-content: center;
    margin-bottom: 1rem;
    contain: layout;
  }

  /* ── Base button ─────────────────────────────────────── */

  .cel-btn {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(180, 140, 255, 0.15);
    border-radius: 10px;
    color: #d8d0e8;
    padding: 0.6rem 1.2rem;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .cel-btn:hover:not(:disabled) {
    background: rgba(180, 140, 255, 0.1);
    border-color: rgba(180, 140, 255, 0.35);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(140, 100, 220, 0.12);
  }

  .cel-btn:active:not(:disabled) {
    transform: translateY(0);
    background: rgba(180, 140, 255, 0.18);
  }

  .cel-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .cel-btn-glyph {
    font-size: 1.1rem;
    color: #c4a0ff;
  }

  .cel-btn-label {
    font-weight: 600;
    font-size: 0.85rem;
    letter-spacing: 0.03em;
  }

  /* ── Shadow button ───────────────────────────────────── */

  .cel-shadow-btn {
    border-color: rgba(255, 120, 60, 0.2);
    flex-direction: row;
    gap: 0.4rem;
    padding: 0.6rem 1.4rem;
  }

  .cel-shadow-btn:hover:not(:disabled) {
    background: rgba(255, 120, 60, 0.08);
    border-color: rgba(255, 120, 60, 0.35);
    box-shadow: none;
  }

  .cel-shadow-btn .cel-btn-glyph {
    color: #ff9060;
  }

  .cel-shadow-active {
    position: relative;
    background: rgba(255, 80, 30, 0.16);
    border-color: rgba(255, 120, 60, 0.6);
    box-shadow: 0 0 16px rgba(255, 80, 30, 0.3), inset 0 0 12px rgba(255, 120, 60, 0.08);
  }

  .cel-shadow-active::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    box-shadow: 0 0 28px rgba(255, 80, 30, 0.5), inset 0 0 16px rgba(255, 120, 60, 0.12);
    opacity: 0;
    animation: cel-shadow-pulse 2s ease-in-out infinite;
    pointer-events: none;
  }

  .cel-shadow-active:hover:not(:disabled) {
    background: rgba(255, 80, 30, 0.24);
    border-color: rgba(255, 120, 60, 0.7);
  }

  .cel-shadow-active .cel-btn-glyph {
    color: #ffb080;
    text-shadow: 0 0 12px rgba(255, 100, 40, 0.7);
  }

  @keyframes cel-shadow-pulse {
    0%, 100% { opacity: 0; }
    50% { opacity: 1; }
  }

  /* ── Breathe button ─────────────────────────────────── */

  .cel-breathe-btn {
    border-color: rgba(255, 180, 140, 0.15);
    padding: 0.6rem 2rem;
    flex-direction: row;
    gap: 0.4rem;
    justify-content: center;
  }

  .cel-breathe-btn:hover:not(:disabled) {
    background: rgba(255, 180, 140, 0.1);
    border-color: rgba(255, 180, 140, 0.35);
    box-shadow: none;
  }

  /* ── Randomize button (controls-row peer) ───────────── */

  .cel-randomize-btn {
    flex-direction: row;
    gap: 0.4rem;
    padding: 0.6rem 1.4rem;
  }

  .cel-randomize-btn:hover:not(:disabled) {
    background: rgba(180, 140, 255, 0.1);
    border-color: rgba(180, 140, 255, 0.35);
    box-shadow: none;
  }

  .cel-osc-indicator {
    display: block;
    text-align: center;
    font-size: 0.6rem;
    font-family: ${FONTS.mono};
    color: rgba(180, 140, 255, 0.35);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 0.5rem;
  }

  /* ── Listen preset pills ─────────────────────────────── */

  .cel-listen {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    justify-content: center;
    margin-bottom: 1.5rem;
    contain: layout;
  }

  .cel-listen-pill {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(180, 140, 255, 0.12);
    border-radius: 20px;
    color: #8878a0;
    padding: 0.3rem 0.8rem;
    font-size: 0.7rem;
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .cel-listen-pill:hover {
    background: rgba(180, 140, 255, 0.08);
    color: #d8d0e8;
  }

  .cel-listen-active {
    background: rgba(180, 140, 255, 0.14);
    border-color: rgba(180, 140, 255, 0.5);
    color: #e0c8ff;
  }

  .cel-veil-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
    margin: 0.8rem auto 0;
  }

  .cel-snapshot-btn {
    font-size: 0.75rem;
    padding: 0.4rem 1.2rem;
    opacity: 0.6;
  }

  /* ── Macro Knobs ───────────────────────────────────── */

  .cel-macros {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    max-width: 600px;
    width: 100%;
    margin-bottom: 1.5rem;
    contain: layout;
  }

  .cel-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 6px 8px 4px;
    border: 1px solid rgba(180, 140, 255, 0.08);
    border-radius: 8px;
    background: rgba(180, 140, 255, 0.02);
    contain: layout style;
  }

  .cel-group-label {
    font-size: 0.55rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: rgba(180, 140, 255, 0.35);
    text-transform: uppercase;
    margin-bottom: 1px;
  }

  .cel-group-knobs {
    display: flex;
    gap: 2px;
  }

  .cel-group-row {
    display: flex;
    gap: 4px;
    justify-content: center;
  }

  .cel-knob {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
    flex: 1;
    max-width: 80px;
    contain: layout style;
  }

  .cel-knob-label {
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: #8878a0;
    text-transform: uppercase;
  }

  .cel-knob-svg {
    cursor: ns-resize;
    touch-action: none;
  }

  .cel-knob-value-arc {
    fill: none;
    stroke: var(--knob-accent, #9070cc);
    stroke-width: 3;
    stroke-linecap: round;
    transition: stroke 0.25s ease-out;
  }

  .cel-knob-pointer {
    fill: var(--knob-accent, #b490e8);
    transition: fill 0.25s ease-out;
  }

  .cel-knob-value {
    font-size: 0.6rem;
    color: #504868;
    font-family: ${FONTS.mono};
  }

  /* ── Natal chart section ─────────────────────────────── */

  .cel-natal {
    max-width: 400px;
    width: 100%;
    margin-bottom: 1.5rem;
  }

  .cel-natal-body {
    padding: 0.8rem 0;
  }

  .cel-natal-inputs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    margin-bottom: 0.8rem;
  }

  .cel-natal-input {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(180, 140, 255, 0.15);
    border-radius: 8px;
    color: #d8d0e8;
    padding: 1.1rem 0.5rem 0.35rem;
    font-size: 0.8rem;
    font-family: inherit;
    width: 100%;
    min-width: 0;
  }

  .cel-natal-field {
    position: relative;
    display: block;
    min-width: 0;
  }
  .cel-natal-field span {
    position: absolute;
    left: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.75rem;
    color: #605878;
    letter-spacing: 0.03em;
    pointer-events: none;
    transition: top 0.15s ease, font-size 0.15s ease, color 0.15s ease, transform 0.15s ease;
  }
  .cel-natal-field:focus-within span,
  .cel-natal-field.has-value span,
  .cel-natal-field.cel-pinned span {
    top: 0.25rem;
    transform: none;
    font-size: 0.5rem;
    color: #807098;
  }
  .cel-natal-city-wrap {
    grid-column: 1 / -1;
    position: relative;
    min-width: 0;
  }
  .cel-city-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 50;
    list-style: none;
    margin: 0;
    padding: 0.25rem 0;
    background: rgba(20, 16, 32, 0.96);
    border: 1px solid rgba(180, 140, 255, 0.2);
    border-radius: 8px;
    max-height: 200px;
    overflow-y: auto;
  }
  .cel-city-option {
    padding: 0.5rem 0.6rem;
    font-size: 0.75rem;
    color: #c0b8d4;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cel-city-option:hover,
  .cel-city-option.highlighted {
    background: rgba(180, 140, 255, 0.12);
    color: #e8e0f8;
  }
  .cel-city-spinner {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    color: #605878;
    font-size: 0.8rem;
    pointer-events: none;
  }

  .cel-natal-play {
    width: 100%;
    border-color: rgba(180, 140, 255, 0.25);
  }

  /* ── Info / footer ───────────────────────────────────── */

  .cel-info {
    text-align: center;
    max-width: 420px;
    font-size: 0.85rem;
    line-height: 1.6;
    color: #706888;
  }

  .cel-info p {
    margin-bottom: 0.4rem;
  }

  .cel-chain {
    margin-top: 0.8rem;
    font-size: 0.75rem;
    color: #504868;
    font-family: ${FONTS.mono};
    line-height: 1.8;
  }

  .cel-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.3rem 1rem calc(0.3rem + env(safe-area-inset-bottom, 0px));
    background: rgba(12, 12, 12, 0.85);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-top: 1px solid rgba(180, 140, 255, 0.06);
    font-size: 0.6rem;
    color: #3a3050;
    z-index: 10;
  }
  .cel-footer p { margin: 0; }

  .cel-natal-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 0;
  }
  .cel-natal-item {
    font-size: 11px;
    opacity: 0.7;
  }
  .cel-natal-shared {
    opacity: 1;
    font-weight: 600;
  }
  /* ── Chart indicator dots on keys ─────────────────────── */

  .cel-chart-dots {
    position: absolute;
    top: 4px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    gap: 3px;
  }

  .cel-chart-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .cel-chart-dot-a {
    background: ${CHART_A_COLOR};
    box-shadow: 0 0 4px ${CHART_A_COLOR};
  }

  .cel-chart-dot-b {
    background: ${CHART_B_COLOR};
    box-shadow: 0 0 4px ${CHART_B_COLOR};
  }

  .cel-key-sharp .cel-chart-dots {
    top: 3px;
  }
  .cel-key-sharp .cel-chart-dot {
    width: 5px;
    height: 5px;
  }

  /* ── Shared key breathing glow ───────────────────────── */

  @keyframes cel-shared-breathe {
    0%, 100% {
      box-shadow: 0 0 4px rgba(212, 160, 60, 0.3), 0 0 4px rgba(60, 168, 212, 0.3);
    }
    50% {
      box-shadow: 0 0 10px rgba(212, 160, 60, 0.5), 0 0 10px rgba(60, 168, 212, 0.5);
    }
  }

  .cel-key-shared {
    animation: cel-shared-breathe 3s ease-in-out infinite;
  }

  /* ── Body glyphs on natural keys ────────────────────── */

  .cel-key-bodies {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1px;
    font-size: 0.55rem;
    line-height: 1;
    max-width: 100%;
    overflow: hidden;
  }

  .cel-body-glyph {
    font-size: 0.55rem;
  }

  .cel-body-a { color: ${CHART_A_COLOR}; }
  .cel-body-b { color: ${CHART_B_COLOR}; }

  /* ── Shared key (both charts active) — amber accent ── */

  .cel-key-natural[data-both] {
    background: #2a2218;
    border-color: rgba(212, 160, 60, 0.55);
  }

  .cel-key-sharp[data-both] {
    background: #3a2a10;
    border-color: rgba(212, 160, 60, 0.6);
  }

  /* ── Playback controls ───────────────────────────────── */

  .cel-playback-controls {
    display: flex;
    justify-content: center;
    margin-bottom: 0.8rem;
  }

  /* ── Dual natal chart layout ────────────────────────── */

  .cel-natal-dual {
    max-width: 560px;
  }

  .cel-natal-dual .cel-natal-body {
    padding: 0.5rem 0;
  }

  .cel-natal-chart-label {
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 0.3rem;
    opacity: 0.8;
  }

  /* ── Info panel ─────────────────────────────────────── */

  .cel-natal-info-panel {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0.5rem 0;
  }

  .cel-natal-context {
    text-align: center;
    color: #8878a0;
    font-size: 0.7rem;
    margin: 0 0 0.5rem 0;
    opacity: 0.8;
  }

  .cel-natal-info-section {
    margin-bottom: 0.5rem;
  }

  .cel-natal-section-header {
    font-size: 0.7rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
    padding-bottom: 0.15rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .cel-natal-shared-header {
    background: linear-gradient(90deg, ${CHART_A_COLOR}, ${CHART_B_COLOR});
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .cel-natal-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.15rem 0.6rem;
    margin-top: 0.5rem;
    padding-top: 0.4rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .cel-legend-item {
    font-size: 0.6rem;
    color: #6a5e80;
    white-space: nowrap;
  }

  @media (max-width: 600px) {
    .cel-root { padding: 8px 8px calc(3rem + env(safe-area-inset-bottom, 0px)); }
    .cel-keyboard { gap: 2px; }
    .cel-key-natural { min-width: 36px; padding: 8px 2px; }
    .cel-key-sharp { width: 28px; }
    .cel-key-name { font-size: 8px; }
    .cel-key-glyph { font-size: 14px; }
    .cel-group-row { flex-direction: column; }
    .cel-key-bodies { font-size: 0.45rem; }
    .cel-body-glyph { font-size: 0.45rem; }
  }

  /* ── Playback row: Play + Orbit ─────────────────────── */

  .cel-playback-controls {
    gap: 0.5rem;
  }

  .cel-natal-play {
    flex: 1;
    width: auto;
  }

  .cel-orbit-btn {
    border-color: rgba(60, 168, 212, 0.2);
    padding: 0.6rem 1.2rem;
  }

  .cel-orbit-btn:hover:not(:disabled) {
    background: rgba(60, 168, 212, 0.08);
    border-color: rgba(60, 168, 212, 0.4);
    box-shadow: none;
  }

  .cel-orbit-active {
    background: rgba(60, 168, 212, 0.14);
    border-color: rgba(60, 168, 212, 0.55);
    box-shadow: 0 0 14px rgba(60, 168, 212, 0.25);
  }

  /* ── Now buttons (transits) ─────────────────────────── */

  .cel-now-btn {
    background: none;
    border: 1px solid rgba(180, 140, 255, 0.2);
    border-radius: 6px;
    color: #8878a0;
    font-size: 0.55rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 2px 8px;
    margin-left: 8px;
    cursor: pointer;
    vertical-align: middle;
  }

  .cel-now-btn:hover {
    color: #d8d0e8;
    border-color: rgba(180, 140, 255, 0.45);
  }

  /* ── Aspects ────────────────────────────────────────── */

  .cel-aspect {
    font-size: 11px;
    opacity: 0.85;
    white-space: nowrap;
  }

  .cel-aspect-orb {
    color: #605878;
    font-size: 10px;
  }

  .cel-aspect-consonant { color: #8fb89f; }
  .cel-aspect-tense { color: #c98f7a; }
  .cel-aspect-focal { color: #b8a0d8; }

  /* ── Chain pills ────────────────────────────────────── */

  .cel-chains {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    justify-content: center;
    margin-bottom: 0.8rem;
    contain: layout;
  }

  /* ── Record ─────────────────────────────────────────── */

  .cel-record-active {
    opacity: 1;
    border-color: rgba(255, 80, 60, 0.6);
    color: #ff9080;
    animation: cel-rec-pulse 1.6s ease-in-out infinite;
  }

  @keyframes cel-rec-pulse {
    0%, 100% { box-shadow: 0 0 4px rgba(255, 80, 60, 0.2); }
    50% { box-shadow: 0 0 14px rgba(255, 80, 60, 0.5); }
  }

  /* ── Perform mode — keyboard + emanation only ───────── */

  .cel-perform {
    justify-content: center;
  }

  .cel-perform .cel-keyboard {
    max-width: 900px;
    height: 220px;
  }

  .cel-perform-exit {
    position: fixed;
    top: 12px;
    right: 14px;
    z-index: 20;
    background: none;
    border: none;
    color: #504868;
    font-size: 1.1rem;
    cursor: pointer;
    opacity: 0.5;
  }

  .cel-perform-exit:hover {
    opacity: 1;
    color: #d8d0e8;
  }

  /* ── QWERTY hints on keys ───────────────────────────── */

  .cel-key-kbd {
    font-size: 0.5rem;
    color: #504868;
    font-family: ${FONTS.mono};
  }

  @media (hover: none) {
    .cel-key-kbd { display: none; }
  }

  /* ── Knob keyboard focus ────────────────────────────── */

  .cel-knob-svg:focus-visible {
    outline: 1px solid rgba(180, 140, 255, 0.5);
    border-radius: 50%;
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;
