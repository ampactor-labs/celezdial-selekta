// Web MIDI out — the chart drives hardware. Bank A (Chart A) voices go
// out on channels 1–12, one channel per sign, so each voice's natal
// detune can ride its own pitch bend (standard ±2 semitone bend range).
// Bank B stays browser-only; 12 signs × 2 banks won't fit 16 channels
// without note-pairing conflicts.

const NOTE_SEMITONE = {
  C: 0,
  Db: 1,
  D: 2,
  Eb: 3,
  E: 4,
  F: 5,
  Gb: 6,
  G: 7,
  Ab: 8,
  A: 9,
  Bb: 10,
  B: 11,
};

export const midiSupported = () =>
  typeof navigator !== "undefined" && !!navigator.requestMIDIAccess;

export function midiNoteNumber(note, octave) {
  return 12 * (octave + 1) + NOTE_SEMITONE[note];
}

export class MidiOut {
  constructor() {
    this.access = null;
    this.output = null;
  }

  async init() {
    if (!this.access) {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
    }
    return this.outputs();
  }

  outputs() {
    return this.access ? [...this.access.outputs.values()] : [];
  }

  setOutput(output) {
    if (this.output && this.output !== output) this.allOff();
    this.output = output || null;
  }

  noteOn(channel, note, octave, velocity, detuneCents = 0) {
    if (!this.output) return;
    const bend = Math.max(
      0,
      Math.min(16383, Math.round(8192 + (detuneCents / 200) * 8192)),
    );
    this.output.send([0xe0 | channel, bend & 0x7f, (bend >> 7) & 0x7f]);
    this.output.send([
      0x90 | channel,
      midiNoteNumber(note, octave),
      Math.max(1, Math.min(127, Math.round(velocity * 127))),
    ]);
  }

  noteOff(channel, note, octave) {
    if (!this.output) return;
    this.output.send([0x80 | channel, midiNoteNumber(note, octave), 64]);
  }

  allOff() {
    if (!this.output) return;
    for (let ch = 0; ch < 12; ch++) {
      this.output.send([0xb0 | ch, 123, 0]); // CC123 all notes off
    }
  }
}
