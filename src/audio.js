export function createAudio() {
  let ctx = null;
  let muted = false;

  function ac() {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, gain, delay = 0, slideTo) {
    if (muted) return;
    const a = ac();
    const t = a.currentTime + delay;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(a.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  return {
    setMuted(v) {
      muted = v;
    },
    unlock() {
      if (!muted) ac();
    },
    jump() {
      tone(520, 0.07, "square", 0.04);
    },
    land() {
      tone(140, 0.05, "triangle", 0.03);
    },
    die() {
      tone(220, 0.22, "sawtooth", 0.05, 0, 70);
    },
    realSave() {
      tone(196, 0.08, "sine", 0.04);
    },
    fakeSave() {
      tone(523, 0.08, "triangle", 0.05, 0);
      tone(659, 0.1, "triangle", 0.05, 0.07);
      tone(784, 0.14, "triangle", 0.05, 0.14);
    },
    near() {
      tone(660, 0.16, "sine", 0.04, 0, 620);
    },
    fakeWin() {
      [523, 659, 784, 698].forEach((f, i) => tone(f, 0.16, "triangle", 0.05, i * 0.14));
    },
    realWin() {
      [523, 659, 784].forEach((f, i) => tone(f, 0.16, "triangle", 0.05, i * 0.14));
    },
    resolve() {
      tone(1046, 0.28, "triangle", 0.05);
    },
    crumble() {
      tone(90, 0.12, "square", 0.03, 0, 50);
    },
  };
}
