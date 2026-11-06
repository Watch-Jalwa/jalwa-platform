# Retained-original repairs completed

Completed on 6 November 2026 at approximately 10.30 UTC, 15.30 PKT, on the shared demo used by watch-jalwa.com and jalwa-platform.codistan.org. The verified application release is `0c8f09c0a59d0e98d9725c40c7bdffa8a989eb44`.

Sintel and VHS Static were repaired from their existing originals, cleared editorially and published. Their existing content, asset and job identities are recorded in the source manifest. [originals.json](originals.json)

## Published catalogue state

| Title | Catalogue duration | Editorial audience | Delivery | Licence | Final state |
| --- | --- | --- | --- | --- | --- |
| sintel | 888 s | teens | HLS | CC-BY-3.0 | published / ready |
| vhs-static-cc0-clip | 45 s | general | MP4 | CC0-1.0 | published / ready |

Sintel retains the full 14m 48s film and closing credits. The Jalwa editorial audience was set to `teens` for fantasy fighting and themes of loss. The published descriptions include Blender Foundation attribution and the CC BY 3.0 link. The source closing-credit images were manually inspected. [Editorial record](review.json)

VHS Static uses the planned 45-second excerpt, with 45.012 seconds measured in the encoded file. The original display shape and audio were retained. Descriptions identify the rapidly changing black-and-white patterns and continuous hiss, with Caleb Minear attribution and a CC0 link. [Editorial record](review.json)

## Original identity

| Title | Original bytes | Original SHA-256 |
| --- | --- | --- |
| sintel | 673935402 | `60cff51761641626e82eeb4e1c248c471375b2536bb1089f49825b7fb58d8723` |
| vhs-static-cc0-clip | 1018579121 | `fbebfa29cfc663d981b12b1f13e92d96e5c4806fe705f54a5d670133b0de7b86` |

## Corrected failures

The first Sintel attempt exhausted the worker's 2 GiB temporary filesystem while the retained originals and outputs occupied it. Strict playlist and segment checks caught the incomplete output. The retry released the completed VHS local source after verifying the remote original and output, removed failed Sintel output, and checked actual available capacity before consuming another attempt. [Successful full-film repair](https://github.com/Watch-Jalwa/jalwa-platform/actions/runs/42196689935)

Independent segment decoding then exposed AAC channel configuration inherited from the source `5.1(side)` layout. Later AAC segments depended on an initial program configuration element. Re-encoding the original AC3 audio as standard six-channel `5.1` gave each segment a self-contained channel configuration. Each rendition's encoded video packet hash matched across repackaging. First, middle and final segments independently decoded in all three renditions. The measured audio-video offset was 0.021333 seconds, matching one 1024-sample AAC priming frame at 48 kHz. [Successful audio repair](https://github.com/Watch-Jalwa/jalwa-platform/actions/runs/42201453626)

Original audio packets extend through 888.032 seconds. This observation corrected the earlier silent-tail hypothesis. Six focused regression tests passed in the final workflow. [Verification run](https://github.com/Watch-Jalwa/jalwa-platform/actions/runs/42202699701)

## Signed-in Premium browser verification

All four checks passed using signed-in Premium playback and same-host signed media tokens. Each check verified a 200 token response, visible poster, media responses, playback-clock advancement, decoded video frames and preserved display aspect.

| Title | Domain | Initial playback | Decoded frames | Video dimensions | Additional checks |
| --- | --- | --- | --- | --- | --- |
| vhs-static-cc0-clip | jalwa-platform.codistan.org | 15.12 s | 451 | 640×480 | 45-second excerpt |
| vhs-static-cc0-clip | watch-jalwa.com | 15.15 s | 449 | 640×480 | 45-second excerpt |
| sintel | jalwa-platform.codistan.org | 15.22 s | 364 | 1694×720 | Midpoint, fresh-player resume and closing seek passed |
| sintel | watch-jalwa.com | 15.22 s | 364 | 1694×720 | Midpoint, fresh-player resume and closing seek passed |

For Sintel, both domains decoded after a seek to 444 seconds, persisted progress, resumed in a freshly loaded player near 447 seconds, and decoded the closing section after seeking to 880.032 seconds. The latest check completed at 10.30.25 UTC. [Browser and final-state evidence](https://github.com/Watch-Jalwa/jalwa-platform/actions/runs/42202699701/artifacts/13494459902)

## Evidence

- Final publication and Premium verification succeeded in run `42202699701` at operations commit `d51602576dc043e722f462d606c5ea0ec82cd721`. [Run](https://github.com/Watch-Jalwa/jalwa-platform/actions/runs/42202699701)
- The final artifact is `retained-results-42202699701-1`, ID `13494459902`, SHA-256 `d6b5f0ee2a228ca2537bea3bef31b276ed66d1e768c87ac725b73a9d444b771c`. It includes publication logs, database state, account evidence, regression results and browser captures. [Artifact](https://github.com/Watch-Jalwa/jalwa-platform/actions/runs/42202699701/artifacts/13494459902)
- The source-credit artifact is ID `13492499027`, SHA-256 `b3b7ace290a0eb1221404321e9f150e79b4f75d39e9bf4b73aab07ebbff88c99`. [Repair run](https://github.com/Watch-Jalwa/jalwa-platform/actions/runs/42196689935)
- The requested eight-title Pakistan documentary rights review is open, with evidence and independent sign-off pending. [Rights review](../pakistan-rights-20261106/review.md)
