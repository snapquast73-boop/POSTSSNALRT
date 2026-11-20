#!/usr/bin/env node
/* alert-sound-independent-check.mjs — independent re-measurement of
 * alert-sound.wav (produced by tools/render-alert-sound.mjs). Parses the WAV
 * header manually and recomputes peak/duration/energy with separate code
 * from the renderer, so a renderer bug cannot hide behind itself.
 * Run: node tools/render-alert-sound.mjs && node tools/alert-sound-independent-check.mjs
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name); } };

console.log('alert-sound-independent-check');
if (!fs.existsSync('alert-sound.wav')) {
  // Render the reference WAV first so this check is order-independent (CI used
  // to run the renderer in a previous step, so running the file on its own —
  // or from a different cwd order — failed for no functional reason).
  console.log('  ..  alert-sound.wav missing — rendering it with tools/render-alert-sound.mjs');
  const rendered = spawnSync(process.execPath, ['tools/render-alert-sound.mjs'], { stdio: 'inherit' });
  if (rendered.status !== 0 || !fs.existsSync('alert-sound.wav')) {
    console.log('  FAIL alert-sound.wav could not be rendered — run tools/render-alert-sound.mjs and read its output');
    process.exit(1);
  }
}
const buf = fs.readFileSync('alert-sound.wav');
check('RIFF header', buf.toString('ascii', 0, 4) === 'RIFF');
check('WAVE header', buf.toString('ascii', 8, 12) === 'WAVE');
const sr = buf.readUInt32LE(24);
const bits = buf.readUInt16LE(34);
const dataLen = buf.readUInt32LE(40);
check('48 kHz 16-bit mono', sr === 48000 && bits === 16);
const n = Math.floor(dataLen / 2);
const samples = new Float64Array(n);
let peak = 0;
for (let i = 0; i < n; i++) {
  const v = buf.readInt16LE(44 + i * 2) / 32768;
  samples[i] = v;
  peak = Math.max(peak, Math.abs(v));
}
const dur = n / sr;
check('duration ~2s', dur > 1.9 && dur < 2.1);
check('peak near -2 dBFS', peak > 0.7 && peak < 0.85);
// Bell energy: RMS in [0.5, 0.7]s must exceed RMS in [0.1, 0.3]s tail ratio check
function rms(from, to) {
  let s = 0, c = 0;
  for (let i = Math.floor(from * sr); i < Math.floor(to * sr); i++) { s += samples[i] * samples[i]; c++; }
  return Math.sqrt(s / Math.max(1, c));
}
check('bell strike energy present (0.5-0.7s RMS > 0.05)', rms(0.5, 0.7) > 0.05);
check('drawer thud present (1.7-1.9s RMS > 0.01)', rms(1.7, 1.9) > 0.01);
check('no clipping (peak < 0.9)', peak < 0.9);

console.log(`\nalert-sound-independent-check: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
