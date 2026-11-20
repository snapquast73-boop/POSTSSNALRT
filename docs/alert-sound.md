# Alert sound — cha-ching slot + synthesized fallback

> Reconstruction note: the original `docs/` tree was missing from the upload
> (see `COORDINATION.md` T6 and `flagged-for-review.html` F-06). This file is
> an honest reconstruction from `README.md`, `sound-lab.html` and `server.mjs`.
> Figures below are the reference measurements recorded in `sound-lab.html`
> (`REF` table) and `README.md`; they were **not** re-measured in the build
> sandbox (no audio tooling / no network to the reference recordings there).
> Treat them as recorded reference values, flagged F-05.

## 1. Two paths, one alert

The alert sound has two paths (`assets/js/reviews-feed.js`):

1. **Real recording** — `assets/audio/cha-ching.{mp3,wav,ogg,m4a}`, probed in
   that order by `primeAlertSound()`. Installed recordings are normalized to
   **−2.0 dBFS peak** (`gainForPeak`). Install via `sound-lab.html` (needs
   `node server.mjs`) or by hand; record the licence in
   `assets/audio/LICENCE.md` before committing. See
   [`assets/audio/README.md`](../assets/audio/README.md).
2. **Synthesized fallback** — a ~2 s ring-up rendered with WebAudio when no
   recording is installed: a bright percussive "cha" (key slam + gear train),
   a metal bell struck **once** for the "ching" at **0.5 s**
   (`alertSoundSpec.bellStrikes[0].at`), and the drawer sliding out and
   thudding to a stop. Total duration **2.019 s** (`alertSoundSpec.duration`).

`ReplayFeed.playAlertSound()` obeys a **2.5 s cooldown** so a burst of
simultaneous events raises one alert; `playSynthAlertNow()` /
`playAlertSampleNow()` bypass it for A/B auditioning in the Sound Lab.

## 2. Reference measurements (recorded in `sound-lab.html`)

Measured from a real cash-register cha-ching recording decoded to PCM at
48 kHz. The Sound Lab recomputes these on any dropped file with the same
frame sizes / windows / FFT (2048-point Hann, 1024 hop) so numbers are
directly comparable.

| Measurement | Reference value | Source |
| --- | --- | --- |
| Body level (p90, first 0.6 s) | −6.5 dB | `sound-lab.html` `REF.bodyP90` (repo) |
| Loudest 25 ms frame | −6.3 dB | `sound-lab.html` `REF.loudestFrame` (repo) |
| Peak | −0.0 dBFS (hard-limited in mastering) | `sound-lab.html` `REF.peak` (repo) |
| Audible above −40 dB | 1.070 s | `sound-lab.html` `REF.audible40` (repo) |
| Onset rise (first frame → loudest) | 14.7 dB | `sound-lab.html` `REF.onsetRise` (repo) |
| Plateau spread (p95−p50, 2 ms) | 1.06 dB | `sound-lab.html` `REF.plateauSpread` (repo) |
| Attacks (4 ms rises ≥ 6 dB) | 3 | `sound-lab.html` `REF.attacks` (repo) |
| Spectral centroid of the "cha" | 6033 Hz (second reference: 6219 Hz) | `sound-lab.html` `REF.centroid` (repo) |

README.md records the synthesized fallback's verification against these
references: spectral centroid **5602 Hz** (references 6219/6033 Hz), flat to
within **1.4 dB** across 150 Hz–6 kHz, **3 attacks** (references 3 and 10),
bell on a **2098 Hz prime** struck once, audible **1.33 s** above −40 dB and
to **2.019 s**. Those fallback figures are recorded claims from the original
build; they could not be re-verified in the sandbox (flagged F-05).

## 3. Why no recording is committed

The exact recording the request pointed at is a **paid Bandcamp release**
(the reference YouTube clip says so in its own description) and cannot be
copied. The two legally usable recordings found (Pixabay 125042, Pixabay
88639 — the second CC0 underneath) sit behind a JavaScript CDN that a build
environment cannot fetch. So `assets/audio/` ships as a documented slot.

Licence summary: https://pixabay.com/service/license-summary/
