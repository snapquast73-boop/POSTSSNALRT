# Alert sound — cha-ching slot + synthesized fallback

> Reconstruction note: the original `docs/` tree was missing from the upload
> (see `COORDINATION.md` T6 and `flagged-for-review.html` F-06). This file is
> an honest reconstruction from `README.md`, `sound-lab.html` and `server.mjs`.
> The original measurement inputs were not uploaded. See the [original Sound Lab](https://github.com/snapquast73-boop/POSTSSNALRT/blob/ad2ea0a19b75252627c1fe80ca6ca5545f3a339f/sound-lab.html) and [Flagged for Review](../flagged-for-review.html).

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

## 2. Reference measurements

The measured-file column is calculated in the browser from the selected audio. Official verification of the reference recording is unavailable. The reference column is intentionally blank; historical figures in the original upload do not validate the reconstructed synth.

## 3. Why no recording is committed

The exact recording the request pointed at is a **paid Bandcamp release**
(the reference YouTube clip says so in its own description) and cannot be
copied. The two legally usable recordings found (Pixabay 125042, Pixabay
88639 — the second CC0 underneath) sit behind a JavaScript CDN that a build
environment cannot fetch. So `assets/audio/` ships as a documented slot.

Licence summary: https://pixabay.com/service/license-summary/
