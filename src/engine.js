// Audio engine — Tone.js graph construction and parameter mapping.
// UI-free: React never reaches in here except through the returned
// engine object and KNOB_MAP. Tone itself is lazy-loaded on first
// user gesture (browser autoplay policy), so this module exports a
// live binding that stays null until createEngine runs.
//
// 12 Tone.PolySynth voices per bank (A and B — two charts), each with
// per-sign oscillator type and planetary ADSR multipliers, panned into
// a summing bus. Voices summing BEFORE saturation is intentional —
// Chebyshev waveshaping on a polyphonic sum creates intermodulation
// (sum/difference tones between partials).
//
// The FX chain is declarative (tuning.js CHAINS) and rewireable at
// runtime: rewireChain tears down chain-level connections and rebuilds
// them in the new order behind a short masking fade.

import { TUNING, CHAINS, ACTIVE_CHAIN, OCTAVE_GAIN } from "./tuning";
import { SIGN_CHARACTER, SIGN_NAMES } from "./signs";

export let Tone = null;

// Nodes can appear in chains as plain Tone nodes or as { in, out } pairs
// (the reverb is a pair: pre-delay in, Freeverb out).
const nIn = (n) => (n && n.in) || n;
const nOut = (n) => (n && n.out) || n;

// Helper: apply a function to both A and B synth banks
export function forBothBanks(eng, fn) {
  fn(eng.synths, eng.oscTypeTracker, eng.spreadTracker);
  if (eng.synthsB) fn(eng.synthsB, eng.oscTypeTrackerB, eng.spreadTrackerB);
}

// Adaptive voicing: boost gain when fewer voices are active.
// Formula: 5 × log10(12 / totalActive) dB
// totalActive = countA + countB across both synth banks.
export function applyAdaptiveVoicing(eng, totalActive) {
  const boost =
    totalActive > 0 ? 5 * Math.log10(12 / Math.max(1, totalActive)) : 0;
  for (const name of SIGN_NAMES) {
    const vol = -9 + (OCTAVE_GAIN[SIGN_CHARACTER[name].octave] || 0) + boost;
    eng.synths[name].set({ volume: vol });
    if (eng.synthsB) eng.synthsB[name].set({ volume: vol });
  }
}

export const KNOB_MAP = {
  // Oscillator internals
  harmonicity: {
    apply: (eng, v) => {
      forBothBanks(eng, (synths, oscTypes) => {
        for (const name of SIGN_NAMES) {
          const t = oscTypes[name];
          if (t.startsWith("am") || t.startsWith("fm")) {
            synths[name].set({ oscillator: { harmonicity: v } });
          }
        }
      });
    },
  },
  modulationIndex: {
    apply: (eng, v) => {
      forBothBanks(eng, (synths, oscTypes) => {
        for (const name of SIGN_NAMES) {
          if (oscTypes[name].startsWith("fm")) {
            synths[name].set({ oscillator: { modulationIndex: v } });
          }
        }
      });
    },
  },
  oscSpread: {
    apply: (eng, v) => {
      forBothBanks(eng, (synths, oscTypes, spreadTrk) => {
        for (const name of SIGN_NAMES) {
          if (oscTypes[name].startsWith("fat")) {
            synths[name].set({ oscillator: { spread: v } });
            spreadTrk[name] = v;
          }
        }
      });
    },
  },
  stagger: {
    apply: () => {}, // read from paramsRef at playback time
  },
  // Voice
  attack: {
    apply: (eng, v) => {
      forBothBanks(eng, (synths) => {
        for (const name of SIGN_NAMES) {
          synths[name].set({ envelope: { attack: v * SIGN_CHARACTER[name].attackMul } });
        }
      });
    },
  },
  decay: {
    apply: (eng, v) => {
      forBothBanks(eng, (synths) => {
        for (const name of SIGN_NAMES) {
          synths[name].set({ envelope: { decay: v * SIGN_CHARACTER[name].decayMul } });
        }
      });
    },
  },
  sustain: {
    apply: (eng, v) => {
      forBothBanks(eng, (synths) => {
        for (const name of SIGN_NAMES) {
          synths[name].set({
            envelope: {
              sustain: Math.min(1, v * SIGN_CHARACTER[name].sustainMul),
            },
          });
        }
      });
    },
  },
  release: {
    apply: (eng, v) => {
      forBothBanks(eng, (synths) => {
        for (const name of SIGN_NAMES) {
          synths[name].set({ envelope: { release: v * SIGN_CHARACTER[name].releaseMul } });
        }
      });
    },
  },
  // Grit
  chebyWet: {
    apply: (eng, v) => {
      eng.fx.chebyshev.wet.value = v;
    },
  },
  chebyOrder: {
    apply: (eng, v) => {
      eng.fx.chebyshev.order = v;
    },
  },
  // EQ
  eqHigh: {
    apply: (eng, v) => {
      eng.fx.eq3.high.value = v;
    },
  },
  eqMid: {
    apply: (eng, v) => {
      eng.fx.eq3.mid.value = v;
    },
  },
  eqLow: {
    apply: (eng, v) => {
      eng.fx.eq3.low.value = v;
    },
  },
  // Vibrato
  vibratoFreq: {
    apply: (eng, v) => {
      eng.fx.vibrato.frequency.value = v;
    },
  },
  vibratoDepth: {
    apply: (eng, v) => {
      eng.fx.vibrato.depth.value = v;
    },
  },
  vibratoWet: {
    apply: (eng, v) => {
      eng.fx.vibrato.wet.value = v;
    },
  },
  // Delay (all ramped — prevents Doppler artifacts + feedback runaway)
  delayTime: {
    apply: (eng, v) => {
      const p = eng.fx.echoDelay.delayTime;
      p.cancelAndHoldAtTime(Tone.now());
      p.rampTo(v, 0.15);
    },
  },
  delayFeedback: {
    apply: (eng, v) => {
      const p = eng.fx.echoFeedbackGain.gain;
      p.cancelAndHoldAtTime(Tone.now());
      p.rampTo(v, 0.08);
    },
  },
  delayWet: {
    apply: (eng, v) => {
      const p = eng.fx.echoCrossfade.fade;
      p.cancelAndHoldAtTime(Tone.now());
      p.rampTo(v, 0.08);
    },
  },
  echoFilterFreq: {
    apply: (eng, v) => {
      const p = eng.fx.echoFilter.frequency;
      p.cancelAndHoldAtTime(Tone.now());
      p.rampTo(v, 0.1);
    },
  },
  // Reverb
  reverbRoom: {
    apply: (eng, v) => {
      eng.fx.reverb.roomSize.value = v;
    },
  },
  reverbDamp: {
    apply: (eng, v) => {
      eng.fx.reverb.dampening = v;
      eng.fx.dampSweep.center = v;
    },
  },
  reverbWet: {
    apply: (eng, v) => {
      eng.fx.reverb.wet.value = v;
    },
  },
  dampSweepRate: {
    apply: (eng, v) => {
      eng.fx.dampSweep.rate = v;
    },
  },
  dampSweepDepth: {
    apply: (eng, v) => {
      eng.fx.dampSweep.depth = v;
    },
  },
  // Space
  panLfoFreq: {
    apply: (eng, v) => {
      Object.values(eng.panLfos).forEach((l) => {
        l.frequency.value = v;
      });
    },
  },
  panLfoAmplitude: {
    apply: (eng, v) => {
      Object.values(eng.panLfos).forEach((l) => {
        l.amplitude.value = v;
      });
    },
  },
  // Phase
  phaserFreq: {
    apply: (eng, v) => {
      eng.fx.phaser.frequency.value = v;
    },
  },
  phaserOctaves: {
    apply: (eng, v) => {
      eng.fx.phaser.octaves = v;
    },
  },
  phaserBase: {
    apply: (eng, v) => {
      eng.fx.phaser.baseFrequency = v;
    },
  },
  phaserQ: {
    apply: (eng, v) => {
      eng.fx.phaser.Q.value = v;
    },
  },
  phaserWet: {
    apply: (eng, v) => {
      eng.fx.phaser.wet.value = v;
      eng.setBypass("phaser", v === 0);
    },
  },
  // Chorus
  chorusWet: {
    apply: (eng, v) => {
      eng.fx.chorus.wet.value = v;
    },
  },
  chorusFreq: {
    apply: (eng, v) => {
      eng.fx.chorus.frequency.value = v;
    },
  },
  chorusDelay: {
    apply: (eng, v) => {
      eng.fx.chorus.delayTime = v;
    },
  },
  chorusDepth: {
    apply: (eng, v) => {
      eng.fx.chorus.depth = v;
    },
  },
  // Saturate
  distortion: {
    apply: (eng, v) => {
      eng.fx.distortion.distortion = v;
    },
  },
  distortionWet: {
    apply: (eng, v) => {
      eng.fx.distortion.wet.value = v;
      eng.setBypass("distortion", v === 0);
    },
  },
  // EQ high frequency
  eqHighFreq: {
    apply: (eng, v) => {
      eng.fx.eq3.highFrequency.value = v;
    },
  },
};

// ─── Audio Engine Factory ────────────────────────────────────
// opts.chain: initial CHAINS key (defaults to ACTIVE_CHAIN).
// opts.diag: optional diagnostics sink ({ ctx, audioInfo, ctxStateLog }).
export async function createEngine(opts = {}) {
  const initialChain = CHAINS[opts.chain] ? opts.chain : ACTIVE_CHAIN;
  const diag = opts.diag || null;
  Tone = await import("tone");
  const yield_ = () => new Promise((r) => setTimeout(r, 0));
  // iOS: route through media channel — bypasses mute switch (iOS 17+)
  if ("audioSession" in navigator) {
    navigator.audioSession.type = "playback";
  }

  const ctx = new Tone.Context({
    latencyHint: "playback",
    // Only pin the rate when a tuning profile asks for one (lo-fi presets);
    // otherwise run at hardware rate — off-rate contexts resample and lose
    // the fast audio path on Android.
    ...(TUNING.sampleRate ? { sampleRate: TUNING.sampleRate } : {}),
    lookAhead: 0.3,
    // 50ms scheduler ticks — half the main-thread timer churn of the old
    // 25ms. Events land on exact audio-clock times regardless; with 300ms
    // lookAhead the coarser check interval changes nothing audible.
    updateInterval: 0.05,
  });
  Tone.setContext(ctx);
  await Tone.start();
  // Belt-and-suspenders: wait for the raw AudioContext to actually resume
  if (ctx.rawContext.state !== "running") {
    await ctx.rawContext.resume();
  }

  // ─── Diagnostic: AudioContext state tracking ───
  if (diag) {
    diag.ctx = ctx;
    diag.audioInfo = {
      baseLatency: ctx.rawContext.baseLatency ?? null,
      outputLatency: ctx.rawContext.outputLatency ?? null,
      bufferSize:
        ctx.rawContext.baseLatency != null
          ? Math.round(ctx.rawContext.baseLatency * ctx.rawContext.sampleRate)
          : null,
      sampleRate: ctx.rawContext.sampleRate,
    };
    diag.ctxStateLog.push({ state: ctx.rawContext.state, time: performance.now() });
    ctx.rawContext.addEventListener("statechange", () => {
      diag.ctxStateLog.push({ state: ctx.rawContext.state, time: performance.now() });
      if (ctx.rawContext.state !== "running")
        console.warn(`[selekta] AudioContext → ${ctx.rawContext.state}`);
    });
  }

  // iOS: silent keepalive prevents context suspension on lock/background.
  // Pre-iOS 17 fallback for mute switch bypass (inaudible at 1e-37 gain).
  const keepAlive = ctx.rawContext.createOscillator();
  const muteGain = ctx.rawContext.createGain();
  muteGain.gain.value = 1e-37;
  keepAlive.connect(muteGain);
  muteGain.connect(ctx.rawContext.destination);
  keepAlive.start();
  await yield_();

  // ─── FX chain (constructed before synths so panners have a target) ───

  const chebyshev = new Tone.Chebyshev(TUNING.chebyOrder);
  chebyshev.wet.value = TUNING.chebyWet;
  chebyshev.oversample = "none";

  const eq3 = new Tone.EQ3({
    high: TUNING.eqHigh,
    mid: TUNING.eqMid,
    low: TUNING.eqLow,
    highFrequency: TUNING.eqHighFreq,
  });

  const vibrato = new Tone.Vibrato({
    frequency: TUNING.vibratoFreq,
    depth: TUNING.vibratoDepth,
  });
  vibrato.wet.value = TUNING.vibratoWet;

  // ─── Custom echo loop (filter + saturation in feedback path) ───
  const echoDelay = new Tone.Delay({
    delayTime: TUNING.delayTime,
    maxDelay: 2,
  });
  const echoFeedbackGain = new Tone.Gain(TUNING.delayFeedback);
  const echoFilter = new Tone.Filter({
    frequency: TUNING.echoFilterFreq,
    type: "lowpass",
    rolloff: -12,
  });
  const echoSat = new Tone.WaveShaper(
    (v) => Math.tanh(v * TUNING.echoSatDrive),
    1024,
  );
  const echoCrossfade = new Tone.CrossFade(TUNING.delayWet);
  const echoInputGain = new Tone.Gain(TUNING.echoInputGain);

  // Feedback loop: delay out → filter → saturator → gain → delay in
  echoDelay.connect(echoFilter);
  echoFilter.connect(echoSat);
  echoSat.connect(echoFeedbackGain);
  echoFeedbackGain.connect(echoDelay);

  const reverb = new Tone.Freeverb({
    roomSize: TUNING.reverbRoom,
    dampening: TUNING.reverbDamp,
  });
  reverb.wet.value = TUNING.reverbWet;

  const reverbPreDelay = new Tone.Delay({ delayTime: 0.025, maxDelay: 0.1 });
  reverbPreDelay.connect(reverb);

  // Damp sweep — sinusoidal modulation of reverb dampening.
  // Sweeps the comb filter cutoff for evolving resonance morphing.
  // depth=0 disables. At depth=1, sweeps full range around center.
  const dampSweep = {
    rate: TUNING.dampSweepRate,
    depth: TUNING.dampSweepDepth,
    center: TUNING.reverbDamp,
    _phase: 0,
    _eventId: null,
    start() {
      if (this._eventId !== null) this.stop();
      if (Tone.Transport.state !== "started") Tone.Transport.start();
      // 10Hz sampling keeps five steps per cycle even with the MOD knob
      // pinned at its 2Hz max, and half the old 20Hz tick's cross-thread
      // filter-param writes (the sweep touches 8 comb filters per tick).
      const tickSec = 0.1;
      this._eventId = Tone.Transport.scheduleRepeat(() => {
        if (this.depth <= 0) return;
        this._phase += 2 * Math.PI * this.rate * tickSec;
        if (this._phase > 2 * Math.PI) this._phase -= 2 * Math.PI;
        const mod = Math.sin(this._phase);
        const logCenter = Math.log(this.center);
        const logRange = this.depth * 2.5;
        const val = Math.exp(logCenter + mod * logRange);
        reverb.dampening = Math.max(200, Math.min(8000, val));
      }, tickSec);
    },
    stop() {
      if (this._eventId !== null) {
        Tone.Transport.clear(this._eventId);
        this._eventId = null;
      }
    },
  };
  dampSweep.start();

  const monitorEQ = new Tone.EQ3({
    low: 0,
    mid: 0,
    high: 0,
    lowFrequency: TUNING.monitorLowFreq,
    highFrequency: TUNING.monitorHighFreq,
  });

  const phaser = new Tone.Phaser({
    frequency: TUNING.phaserFreq,
    octaves: TUNING.phaserOctaves,
    baseFrequency: TUNING.phaserBase,
    Q: TUNING.phaserQ,
  });
  phaser.wet.value = TUNING.phaserWet;

  const chorus = new Tone.Chorus({
    frequency: TUNING.chorusFreq,
    delayTime: TUNING.chorusDelay,
    depth: TUNING.chorusDepth,
  });
  chorus.wet.value = TUNING.chorusWet;
  // Chorus LFO needs an explicit start — without it the effect is a
  // static widener and the RATE/DPTH knobs change nothing audible.
  chorus.start();

  const distortion = new Tone.Distortion({
    distortion: TUNING.distortion,
    oversample: "none",
  });
  distortion.wet.value = TUNING.distortionWet;

  // tanh soft clip — preserves Freeverb resonant peaks that Limiter(-1) killed
  const softClip = new Tone.WaveShaper((val) => Math.tanh(val), 4096);
  softClip.oversample = "none";

  // Summing bus — all panners feed here so voices intermodulate through Chebyshev
  const sumBus = new Tone.Gain(1);

  const highpass = new Tone.Filter({
    frequency: TUNING.highpassFreq,
    type: "highpass",
    rolloff: TUNING.highpassRolloff,
  });
  sumBus.connect(highpass);

  // Recorder taps the chain tail (post soft clip) — same signal the
  // speakers get. Feature-dependent: MediaRecorder may be absent.
  let recorder = null;
  try {
    recorder = new Tone.Recorder();
  } catch {
    recorder = null;
  }

  // ─── Chain builder ───
  // Node values may be { in, out } pairs — the reverb is (pre-delay in,
  // Freeverb out) so the chain actually traverses the Freeverb. Its wet
  // path was silently dangling before this: the chain used to route
  // through the pre-delay alone, leaving the Freeverb output unconnected.
  function wireChain(src, nodes, config) {
    const { order, bypass } = config;
    let prev = src;
    for (const name of order) {
      if (name === "ECHO") {
        nOut(prev).connect(nodes.echoCrossfade.a);
        nOut(prev).connect(nodes.echoInputGain);
        nodes.echoInputGain.connect(nodes.echoDelay);
        nodes.echoDelay.connect(nodes.echoCrossfade.b);
        prev = nodes.echoCrossfade;
      } else {
        nOut(prev).connect(nIn(nodes[name]));
        prev = nodes[name];
      }
    }
    const tail = nOut(prev);
    tail.toDestination();
    if (recorder) tail.connect(recorder);

    const bypassState = {};
    const bypassable = {};
    for (const [name, cfg] of Object.entries(bypass)) {
      bypassState[name] = true;
      bypassable[name] = {
        node: nodes[name],
        prev: nodes[cfg.after],
        next: nodes[cfg.before],
      };
    }
    return { bypassState, bypassable, tail };
  }

  const chainNodes = {
    chebyshev,
    eq3,
    vibrato,
    reverb: { in: reverbPreDelay, out: reverb },
    chorus,
    monitorEQ,
    softClip,
    phaser,
    distortion,
    echoCrossfade,
    echoDelay,
    echoInputGain,
  };
  await yield_();
  let currentChain = initialChain;
  let { bypassState, bypassable } = wireChain(
    highpass,
    chainNodes,
    CHAINS[currentChain],
  );

  function setBypass(name, bypassed) {
    if (bypassState[name] === bypassed) return;
    const b = bypassable[name];
    try {
      if (bypassed) {
        if (b.node.wet) {
          b.node.wet.rampTo(0, 0.05);
          setTimeout(() => {
            try {
              nOut(b.prev).disconnect(nIn(b.node));
              nOut(b.node).disconnect(nIn(b.next));
              nOut(b.prev).connect(nIn(b.next));
            } catch {
              /* ignore */
            }
          }, 60);
        } else {
          nOut(b.prev).disconnect(nIn(b.node));
          nOut(b.node).disconnect(nIn(b.next));
          nOut(b.prev).connect(nIn(b.next));
        }
      } else {
        nOut(b.prev).disconnect(nIn(b.next));
        nOut(b.prev).connect(nIn(b.node));
        nOut(b.node).connect(nIn(b.next));
        if (b.node.wet) b.node.wet.rampTo(b.node.wet.value || 1, 0.05);
      }
      bypassState[name] = bypassed;
    } catch {
      /* ignore */
    }
  }

  // ─── Runtime chain switching ───
  // Tears down every chain-level connection and rebuilds in the new
  // order behind a short sumBus fade. Internal edges severed by the
  // sweep (echo feedback head, reverb pre-delay) are re-established.
  let rewiring = false;
  let pendingChain = null;
  function rewireChain(name) {
    if (!CHAINS[name] || name === currentChain) return;
    if (rewiring) {
      pendingChain = name;
      return;
    }
    rewiring = true;
    sumBus.gain.cancelAndHoldAtTime(Tone.now());
    sumBus.gain.rampTo(0, 0.08);
    setTimeout(() => {
      try {
        highpass.disconnect();
        for (const node of Object.values(chainNodes)) {
          try {
            nOut(node).disconnect();
          } catch {
            /* already disconnected */
          }
        }
        // re-establish internal edges the sweep severed
        echoDelay.connect(echoFilter);
        reverbPreDelay.connect(reverb);
        ({ bypassState, bypassable } = wireChain(
          highpass,
          chainNodes,
          CHAINS[name],
        ));
        currentChain = name;
        // reinsert bypassed nodes whose wet is up
        for (const bname of Object.keys(bypassable)) {
          const wet = bypassable[bname].node.wet;
          if (wet && wet.value > 0.001) setBypass(bname, false);
        }
      } finally {
        sumBus.gain.rampTo(1, 0.18);
        rewiring = false;
        if (pendingChain) {
          const next = pendingChain;
          pendingChain = null;
          rewireChain(next);
        }
      }
    }, 120);
  }

  // ─── Per-sign synths + panners ──────────────────────────

  function buildBank(mirrorPan) {
    const synths = {};
    const panners = {};
    const spreadTracker = {};
    Object.entries(SIGN_CHARACTER).forEach(([name, cfg]) => {
      const panner = new Tone.Panner(
        mirrorPan ? -cfg.panBase * 0.3 : cfg.panBase,
      );
      const synth = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 1,
        voice: Tone.Synth,
        options: {
          oscillator: {
            type: cfg.oscType,
            ...(cfg.oscType.startsWith("fat")
              ? { count: cfg.oscCount, spread: cfg.oscSpread }
              : {}),
          },
          envelope: {
            attack: TUNING.attack * cfg.attackMul,
            decay: TUNING.decay * cfg.decayMul,
            sustain: Math.min(1, TUNING.sustain * cfg.sustainMul),
            release: TUNING.release * cfg.releaseMul,
          },
          volume: -9 + (OCTAVE_GAIN[cfg.octave] || 0),
        },
      });
      synth.set({ detune: cfg.detuneCents });
      synth.connect(panner);
      panner.connect(sumBus);
      synths[name] = synth;
      panners[name] = panner;
      spreadTracker[name] = cfg.oscSpread;
    });
    const oscTypeTracker = Object.fromEntries(
      Object.entries(SIGN_CHARACTER).map(([name, cfg]) => [name, cfg.oscType]),
    );
    const detuneTracker = Object.fromEntries(
      Object.keys(SIGN_CHARACTER).map((s) => [s, SIGN_CHARACTER[s].detuneCents]),
    );
    return { synths, panners, spreadTracker, oscTypeTracker, detuneTracker };
  }

  const bankA = buildBank(false);
  await yield_();
  const bankB = buildBank(true);

  // ─── Group LFOs — one per panGroup, drift all panners in that group ──

  const panLfos = {};
  ["A", "B", "C", "D"].forEach((group) => {
    const lfo = new Tone.LFO({ frequency: TUNING.panLfoFreq, min: -1, max: 1 });
    lfo.amplitude.value = TUNING.panLfoAmplitude;
    lfo.start();
    Object.entries(SIGN_CHARACTER).forEach(([name, cfg]) => {
      if (cfg.panGroup === group) lfo.connect(bankA.panners[name].pan);
    });
    panLfos[group] = lfo;
  });

  return {
    synths: bankA.synths,
    panners: bankA.panners,
    panLfos,
    spreadTracker: bankA.spreadTracker,
    detuneTracker: bankA.detuneTracker,
    oscTypeTracker: bankA.oscTypeTracker,
    synthsB: bankB.synths,
    pannersB: bankB.panners,
    spreadTrackerB: bankB.spreadTracker,
    detuneTrackerB: bankB.detuneTracker,
    oscTypeTrackerB: bankB.oscTypeTracker,
    setBypass,
    rewireChain,
    getChain: () => currentChain,
    recorder,
    fx: {
      reverb,
      echoDelay,
      echoFeedbackGain,
      echoFilter,
      echoSat,
      echoCrossfade,
      echoInputGain,
      chorus,
      vibrato,
      chebyshev,
      eq3,
      monitorEQ,
      phaser,
      distortion,
      dampSweep,
    },
    dispose() {
      dampSweep.stop();
      Object.values(bankA.synths).forEach((s) => s.dispose());
      Object.values(bankA.panners).forEach((p) => p.dispose());
      Object.values(bankB.synths).forEach((s) => s.dispose());
      Object.values(bankB.panners).forEach((p) => p.dispose());
      Object.values(panLfos).forEach((l) => l.dispose());
      if (recorder) recorder.dispose();
      [
        sumBus,
        highpass,
        chebyshev,
        distortion,
        eq3,
        vibrato,
        echoDelay,
        echoFeedbackGain,
        echoFilter,
        echoSat,
        echoCrossfade,
        echoInputGain,
        chorus,
        reverbPreDelay,
        reverb,
        phaser,
        monitorEQ,
        softClip,
      ].forEach((n) => n.dispose());
    },
  };
}
