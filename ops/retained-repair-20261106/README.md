# Retained-original repairs completed

Closed on 6 November 2026 on the shared staging/demo environment used by `watch-jalwa.com` and `jalwa-platform.codistan.org`. The verified application release is `0c8f09c0a59d0e98d9725c40c7bdffa8a989eb44`.

Sintel and VHS Static were repaired from their retained originals, editorially cleared, published, and re-verified after publication. Production was not touched.

## Final database state

| Title | Slug | Content state | Available | Effective | Media status | Playback | Delivery | Duration | Audience | Licence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sintel | `sintel` | `published` | `true` | `true` | `ready` | `true` | HLS | 888 s | teens | CC-BY-3.0 |
| VHS Static | `vhs-static-cc0-clip` | `published` | `true` | `true` | `ready` | `true` | MP4 | 45 s | general | CC0-1.0 |

Final-state checks also confirmed each media job is `completed`, the primary playback source is active, the media asset is available, and the catalogue poster route is present.

## Media identity and checksums

| Title | Asset ID | Original bytes | Original SHA-256 |
| --- | --- | --- | --- |
| Sintel | `5c5f576c-d1d6-4898-9bd5-2e3616fd0001` | 673935402 | `60cff51761641626e82eeb4e1c248c471375b2536bb1089f49825b7fb58d8723` |
| VHS Static | `301b706e-9bf9-437a-9506-6c1cf27754d6` | 1018579121 | `fbebfa29cfc663d981b12b1f13e92d96e5c4806fe705f54a5d670133b0de7b86` |

The retained R2 originals remain preserved. Local temporary processing caches were removed only after successful final verification.

Sintel HLS variants 360p, 480p and 720p independently decoded with six-channel 5.1 AAC. VHS Static verified as a 45.012-second 640×480 stereo MP4. Source display aspect was preserved for both.

## Published URLs

Sintel:
- https://jalwa-platform.codistan.org/watch/sintel
- https://watch-jalwa.com/watch/sintel

VHS Static:
- https://jalwa-platform.codistan.org/watch/vhs-static-cc0-clip
- https://watch-jalwa.com/watch/vhs-static-cc0-clip

## Fresh signed-in Premium playback QA

Final QA attempt: run `42202699701`, attempt 2.

| Title | Domain | Result | Decoded playback | Decoded frames | Entitlement / delivery | Aspect | Additional proof |
| --- | --- | --- | --- | --- | --- | --- | --- |
| VHS Static | jalwa-platform.codistan.org | PASS | 15.23 s | 454 | token 200, enhanced, signed same-host R2 | preserved | audio present |
| VHS Static | watch-jalwa.com | PASS | 15.09 s | 451 | token 200, enhanced, signed same-host R2 | preserved | audio present |
| Sintel | jalwa-platform.codistan.org | PASS | 15.22 s | 364 | token 200, enhanced, signed same-host R2 | preserved | midpoint seek, resume, closing seek passed |
| Sintel | watch-jalwa.com | PASS | 15.22 s | 364 | token 200, enhanced, signed same-host R2 | preserved | midpoint seek, resume, closing seek passed |

Both hosts also proved the signed-in QA account had active `premium_catalogue` and `enhanced_quality` benefits.

For Sintel, the browser decoded after a midpoint seek around 444 seconds, persisted progress, resumed in a fresh player around 447 seconds, and decoded the closing section after a seek to 880.032 seconds. This also re-verifies that the complete film and closing credits remain playable.

## Attribution / editorial evidence

Sintel retains Blender Foundation attribution, `www.sintel.org`, and CC BY 3.0 in the reviewed published metadata. Original closing-credit evidence independently shows “Licensed as Creative Commons Attribution 3.0”.

VHS Static retains Caleb Minear attribution and CC0 1.0 in the reviewed published metadata.

See [review.json](review.json) for the exact before/after editorial record and rights evidence.

## Exact release and evidence

- Release SHA: `0c8f09c0a59d0e98d9725c40c7bdffa8a989eb44`
- Operations commit used by the final QA workflow: `d51602576dc043e722f462d606c5ea0ec82cd721`
- Final workflow: https://github.com/Watch-Jalwa/jalwa-platform/actions/runs/42202699701
- Final QA attempt: `2`
- Final artifact: `retained-results-42202699701-2`
- Artifact ID: `13495074114`
- Artifact ZIP SHA-256: `73f22d52c48eac3edf0617cda69123388a87e308d05b1217c8d4efaa5a8160d1`
- Artifact size: `1320926` bytes
- Artifact URL: https://github.com/Watch-Jalwa/jalwa-platform/actions/runs/42202699701/artifacts/13495074114
- Source-credit repair artifact: `13492499027`
- Source-credit artifact SHA-256: `b3b7ace290a0eb1221404321e9f150e79b4f75d39e9bf4b73aab07ebbff88c99`

The final artifact contains publication/final-state logs, Premium account evidence, browser playback evidence, screenshots, and regression results.

## Closure decision

**Repair batch CLOSED / PASS.**

Both repaired titles are genuinely available on the shared staging/demo environment: catalogue state is published and effectively available, media assets are ready and available, playback sources are active, signed-in Premium entitlement succeeds, and both aliases decoded real media for at least 15 seconds in the final fresh QA pass.

No production deployment or production payment operation was performed.
