# Alert-sound slot — `assets/audio/`

The site's alert prefers a **real cash-register cha-ching recording** installed
here as `cha-ching.mp3` (or `.wav`, `.ogg`, `.m4a` — probed in that order by
`assets/js/reviews-feed.js` → `primeAlertSound()`). When no recording is
installed, the site plays a **synthesized cha-ching** instead, so a fresh clone
is never silent. See [`docs/alert-sound.md`](../../docs/alert-sound.md) for how
the fallback was measured against real recordings.

## Installing a recording (no code changes)

1. Get a recording you are licensed to ship (see "Where to get one" below).
2. Either drop it on [`sound-lab.html`](../../sound-lab.html) and click
   **Install on this server** (requires `node server.mjs`), or copy it here by
   hand as `assets/audio/cha-ching.mp3`.
3. Record its licence in [`LICENCE.md`](LICENCE.md) **before committing**.
4. `git add assets/audio/cha-ching.mp3 assets/audio/LICENCE.md` and commit.

Installed recordings are normalized to **−2.0 dBFS peak** on install
(`gainForPeak` in `reviews-feed.js`), so loud and quiet files play at a
consistent level. Design target: **1–2 seconds**; upload cap **12 MB**
(`server.mjs` `AUDIO_MAX_BYTES`).

## Where to get one you are allowed to ship

The reference video for this request (YouTube `trR5YxZjfes`, channel
*cashregistersound*) links in its own description to a **paid Bandcamp
release**. It is not free to copy, and nothing in this repo is ripped from it.

Two freely hosted alternatives were checked page by page (see
`sound-lab.html` → "Where to get one you are allowed to ship"):

| Recording | Licence | Link |
| --- | --- | --- |
| Cash Register (Kaching) — Sound Effect, Modestas123123, 0:03 | Pixabay Content Licence | https://pixabay.com/sound-effects/film-special-effects-cash-register-kaching-sound-effect-125042/ |
| Cash Register Fake, freesound_community / CapsLok, 0:02 (underlying Freesound 184438 is CC0) | Pixabay Content Licence | https://pixabay.com/sound-effects/film-special-effects-cash-register-fake-88639/ |

Pixabay Content Licence summary:
https://pixabay.com/service/license-summary/ — free for commercial use, no
attribution required, may not be sold or redistributed standalone.

Neither is *the* video's sound. Nothing freely hosted is; the exact recording
has to be bought from that Bandcamp release, and then its own terms decide
whether it can ship in a public repository.
