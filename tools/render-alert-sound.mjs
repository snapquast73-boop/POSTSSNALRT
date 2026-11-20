#!/usr/bin/env node
/* render-alert-sound.mjs — pure-Node render + measurement of the synthesized
 * cha-ching fallback (no deps). Writes alert-sound.wav (gitignored build
 * output) and measures it with the same frame/window/FFT method as
 * sound-lab.html (2048-pt Hann, 1024 hop) so numbers are comparable.
 * Run: node tools/render-alert-sound.mjs
 *
 * Rebuilt for the repair (original tools/ missing from upload; see F-06).
 * Check count is whatever this file actually asserts — printed honestly,
 * not carried over from the original build's "57 checks" claim.
 */
import fs from 'node:fs';

const SR = 48000;
const DUR = 2.019;
const STRIKE = 0.5;
const PRIME = 2098;

function synth() {
  const n = Math.floor(SR * DUR);
  const x = new Float64Array(n);
  let seed = 123456789;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x40000000 - 1; };
  // cha: broadband noise, attack 30ms, release to strike
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    if (t < STRIKE) {
      const env = t < 0.03 ? t / 0.03 : t > STRIKE - 0.08 ? Math.max(0, (STRIKE - t) / 0.08) : 1;
      x[i] += rand() * 0.45 * env;
    }
  }
  // key hits inside the cha
  [0.02, 0.14, 0.27].forEach((off, k) => {
    const f = 2400 + k * 400;
    for (let i = 0; i < n; i++) {
      const t = i / SR - off;
      if (t >= 0 && t < 0.05) x[i] += Math.sin(2 * Math.PI * f * t) * 0.10 * Math.exp(-t / 0.015);
    }
  });
  // bell struck once at 0.5s: inharmonic partials, exp decay
  [1, 2.76, 5.4, 8.9].forEach((ratio, idx) => {
    const f = PRIME * ratio;
    const amp = 0.5 / (idx + 1);
    for (let i = 0; i < n; i++) {
      const t = i / SR - STRIKE;
      if (t >= 0 && t < 1.15) x[i] += Math.sin(2 * Math.PI * f * t) * amp * Math.exp(-t / 0.35);
    }
  });
  // drawer slide 1.3-1.75s (smoothed noise) + thud at 1.72s
  let smooth = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    if (t >= 1.3 && t < 1.75) {
      smooth = smooth * 0.92 + rand() * 0.08;
      const env = Math.sin(Math.PI * (t - 1.3) / 0.45);
      x[i] += smooth * 2.2 * env;
    }
    if (t >= 1.72 && t < 2.019) {
      const dt = t - 1.72;
      const f = 140 * Math.exp(-dt * 3) + 55;
      x[i] += Math.sin(2 * Math.PI * f * dt) * 0.35 * Math.exp(-dt / 0.12);
    }
  }
  // normalize to -2 dBFS peak
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(x[i]));
  const target = Math.pow(10, -2 / 20);
  const g = peak > 0 ? target / peak : 1;
  for (let i = 0; i < n; i++) x[i] *= g;
  return x;
}

function writeWav(path, x) {
  const n = x.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, x[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  fs.writeFileSync(path, buf);
}

const db = (v) => (v > 0 ? 20 * Math.log10(v) : -140);
function frames(x, fromSec, toSec, frameSec) {
  const frame = Math.round(frameSec * SR);
  const out = [];
  for (let i = Math.floor(fromSec * SR); i + frame <= Math.floor(toSec * SR); i += frame) {
    let s = 0;
    for (let k = 0; k < frame; k++) s += x[i + k] * x[i + k];
    out.push({ t: (i + frame / 2) / SR, db: db(Math.sqrt(s / frame)) });
  }
  return out;
}
function percentile(vals, p) {
  if (!vals.length) return -140;
  const s = vals.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
}
function centroid(x, fromSec, toSec) {
  const N = 2048;
  const i0 = Math.floor(fromSec * SR);
  const i1 = Math.min(x.length - N, Math.floor(toSec * SR));
  const acc = new Float64Array(N / 2);
  let count = 0;
  for (let start = i0; start + N < i1; start += N / 2) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = x[start + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
    for (let a = 1, j = 0; a < N; a++) {
      let bit = N >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (a < j) { const tr = re[a]; re[a] = re[j]; re[j] = tr; const ti = im[a]; im[a] = im[j]; im[j] = ti; }
    }
    for (let len = 2; len <= N; len <<= 1) {
      const ang = -2 * Math.PI / len;
      for (let b = 0; b < N; b += len) for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const ur = re[b + k], ui = im[b + k], er = re[b + k + len / 2], ei = im[b + k + len / 2];
        const vr = er * wr - ei * wi, vi = er * wi + ei * wr;
        re[b + k] = ur + vr; im[b + k] = ui + vi; re[b + k + len / 2] = ur - vr; im[b + k + len / 2] = ui - vi;
      }
    }
    for (let q = 0; q < N / 2; q++) acc[q] += Math.sqrt(re[q] * re[q] + im[q] * im[q]);
    count++;
  }
  if (!count) return 0;
  let num = 0, den = 0;
  for (let i = 1; i < N / 2; i++) { const m = acc[i] * acc[i]; num += m * (i * SR / N); den += m; }
  return den > 0 ? num / den : 0;
}

const x = synth();
writeWav('alert-sound.wav', x);
let peak = 0;
for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
const head = frames(x, 0, 0.6, 0.025).map(f => f.db);
const env10 = frames(x, 0, DUR, 0.01).filter(f => f.t > 0.005);
const audible = env10.filter(f => f.db > -40);
const env2 = frames(x, 0, STRIKE, 0.002);
let attacks = 0;
for (let i = 2; i < env2.length; i++) if (env2[i].db - env2[i - 2].db >= 6) attacks++;
const m = {
  duration: x.length / SR,
  peakDb: db(peak),
  bodyP90: percentile(head, 0.90),
  audible40: audible.length ? audible[audible.length - 1].t - audible[0].t : 0,
  attacks,
  centroid: centroid(x, 0, STRIKE),
};
console.log('render-alert-sound: wrote alert-sound.wav');
console.log('  duration ' + m.duration.toFixed(3) + 's, peak ' + m.peakDb.toFixed(1) +
  ' dBFS, bodyP90 ' + m.bodyP90.toFixed(1) + ' dB, audible40 ' + m.audible40.toFixed(3) +
  's, attacks ' + m.attacks + ', centroid ' + Math.round(m.centroid) + ' Hz');

let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name); } };
check('duration ~2s', m.duration > 1.9 && m.duration < 2.1);
check('peak normalized near -2 dBFS', m.peakDb > -2.5 && m.peakDb < -1.5);
check('body is audible (p90 > -25 dB)', m.bodyP90 > -25);
check('audible above -40 dB for >0.8s', m.audible40 > 0.8);
check('cha has >=2 attacks', m.attacks >= 2);
check('cha is bright (centroid >3000 Hz)', m.centroid > 3000);
check('wav file written', fs.existsSync('alert-sound.wav') && fs.statSync('alert-sound.wav').size > 100000);

console.log(`\nrender-alert-sound: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
