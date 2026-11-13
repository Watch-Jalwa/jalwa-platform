# Handoff: continue staging live-test 50 (#156 / #157)

**Scope:** staging only (`https://jalwa-platform.codistan.org`). Production unauthorized.

### Owner DoD (accepted 2026-11-04)
- Staging rights DoD = **38 approved + 12 HOLD** (#156 **closed**).
- Remaining approved encodes authorized on staging (not HOLD, not production).
- Continue #157 encode backlog.

---

## Status as of 2026-11-05 (this machine resume)

| Item | State |
|------|--------|
| Branch | `fix/staging-certification-blockers` @ `ec0a76f` (or later after wave5 push) |
| Summary SQL cast | **Fixed** (`ci.id::text`) in `7fe166e` |
| #156 | **Closed** |
| #157 | **Open** — encode backlog in progress |
| #162 | Open P0 aspect-ratio / portrait padding (separate track; do not claim media accepted until fixed) |

### Proven playable on staging (browser 2026-11-05)
Self-hosted video ready: `mossy-tree-cc0`, `elephants-dream`, `big-buck-bunny` (and watch-next lists show ESO casts, Pakistan films, fossils, Proxima, Wikipedia, wave1 shorts).

Unavailable / incomplete: `sintel`, `tears-of-steel` (wave4 left processing; SSH inventory step then reset). Audio trio never ingested (`source_audio` invalid enum).

### Wave4 failure root causes
1. `media_asset_kind` has no `source_audio` — insert failed for bird audio.
2. Inventory SSH `Connection reset by peer` after long encode.
3. `sintel` / `tears-of-steel` still processing at job end.

### Wave5 (next / in flight)
- Fix: audio uses `kind: "source_video"` + `audio/ogg` mime.
- Recover: 3 audio + `vhs-static-cc0-clip` + `sintel` + `tears-of-steel`.
- Workflow: `.github/workflows/staging-live-test-wave5-publish.yml`
- Script: `scripts/staging-ingest-live-test-wave5.mjs`

### Remaining approved-but-unpublished after wave5 (HOLD untouched)
NASA/SVS/NPS/Apollo/GRCA + Blender Studio films:
- `artemis-ii-lunar-flyby-svs`, `artemis-ii-trajectory-svs`, `earth-views-from-iss-nasa`, `hst-fly-by-nasa`, `hd-earth-views-svs`, `hst-sm4-rendezvous-nasa`, `apollo-11-eagle-has-landed`
- `grca-south-rim-summer-timelapse`, `grca-animals-broll`, `grca-south-rim-winter-scenic`
- `sprite-fright`, `spring-blender`, `cosmos-laundromat`, `caminandes-llamigos`

---

## Immediate next steps

1. Confirm wave5 Actions run green; capture inventory JSON.
2. Browser-check audio + VHS + Sintel + Tears on staging.
3. Comment evidence on #157 (do not close until remaining approved backlog + #162 acceptance policy clarified).
4. Plan wave6 for NASA/NPS/Blender Studio downloads (distinct source URLs; runner→scp path).
5. Keep HOLD pending. Never production.

## Useful commands

```bash
git checkout fix/staging-certification-blockers && git pull
# list / watch wave5
# (API) POST .../actions/workflows/staging-live-test-wave5-publish.yml/dispatches
```
