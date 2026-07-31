# Initial Public-Domain Live Source Integration

## Decision

Jalwa will begin external live-content integration with nine owner-approved NASA, NOAA and USGS entries. This is a production integration plan, not approval to publish immediately.

The implementation must be completed and accepted in isolated staging first. Production code should be deployed with the feature disabled, then enabled only after rights evidence, source health, mobile-browser acceptance and an explicit content/rights approval are retained against the exact release SHA.

The approved scope is intentionally narrow:

1. NASA Space Station Views.
2. NOAA Ocean Exploration Camera 1.
3. NOAA Ocean Exploration Camera 2.
4. NOAA Ocean Exploration Camera 3.
5. USGS Kīlauea V1 camera.
6. USGS Kīlauea V2 camera.
7. USGS Kīlauea V3 camera.
8. USGS Mauna Loa webcam collection.
9. USGS rivers and lakes webcam collection.

This plan does not include Pakistani television, radio, sports feeds, proprietary religious channels, unofficial restreams or Jalwa-originated linear channels.

Implementation is tracked in [issue #52](https://github.com/Watch-Jalwa/jalwa-platform/issues/52).

## Source and rights basis

### NASA Space Station Views

Official source:

- [NASA Live](https://www.nasa.gov/live/)
- [NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)

NASA content is generally not subject to United States copyright, but NASA identifiers, insignia and logotypes remain protected. Jalwa must present the feed factually, provide an official-source link, avoid suggesting NASA endorsement and avoid using NASA branding to promote Jalwa or an advertiser.

Delivery decision:

- `content_type`: `live`
- `hosting_mode`: `embed_only`
- adapter: `official_live_embed`
- access: always `public`
- no recording, raw-stream extraction, proxy restream or Premium gate

### NOAA Ocean Exploration Cameras 1–3

Official sources:

- [NOAA Ocean Exploration livestreams](https://oceanexplorer.noaa.gov/livestreams/)
- [NOAA Ocean Exploration media kit](https://oceanexplorer.noaa.gov/about/media-kit/)

NOAA Ocean Exploration states that its portal video is public domain and should be credited to NOAA Ocean Exploration. Camera availability changes with expedition operations. A camera may be off air without representing a Jalwa failure.

Delivery decision for each camera:

- `content_type`: `live`
- `hosting_mode`: `embed_only`
- adapter: `official_live_embed`
- access: always `public`
- attribution: `Courtesy of NOAA Ocean Exploration`
- no recording, raw-stream extraction or proxy restream

### USGS Kīlauea V1–V3

Official sources:

- [Kīlauea summit webcams](https://www.usgs.gov/volcanoes/kilauea/summit-webcams)
- [V1 camera](https://www.usgs.gov/volcanoes/kilauea/v1cam-kilauea-volcano-hawaii-west-halemaumau-crater)
- [V2 camera](https://www.usgs.gov/media/webcams/v2cam-kilauea-volcano-hawaii-east-halemaumau-crater)
- [V3 camera](https://www.usgs.gov/media/webcams/v3cam-kilauea-volcano-hawaii-south-halemaumau-crater)

The official USGS pages mark these camera outputs as public domain. The implementation may use an official USGS/YouTube player when one is explicitly provided, or a reviewed current-image endpoint when the camera is image-based.

Delivery decision:

- `content_type`: `live`
- `hosting_mode`: `embed_only` for official video players
- `hosting_mode`: `self_host_open` only for a current public-domain image copied through the approved snapshot adapter
- adapter: `official_live_embed` or `public_domain_live_image`
- access: always `public`
- attribution: `Source: U.S. Geological Survey`

### USGS Mauna Loa webcam collection

Official source:

- [Mauna Loa webcams](https://www.usgs.gov/volcanoes/mauna-loa/webcams)

This entry is a Jalwa catalogue collection, not a single invented channel. It contains only currently active USGS camera items whose official pages identify the outputs as public domain.

Delivery decision:

- one published collection: `usgs-mauna-loa-live`
- child items use `public_domain_live_image`, except an official video player may use `official_live_embed`
- one reviewed child may be designated the collection hero
- unavailable children are removed from active discovery without deleting rights or health history

### USGS rivers and lakes webcam collection

This entry is also a Jalwa catalogue collection. Camera membership must be selected from active official USGS pages during implementation. Every child requires its own public-domain statement, official source page, current-image endpoint and attribution record.

Delivery decision:

- one published collection: `usgs-rivers-lakes-live`
- initial collection target: four to six reliable cameras
- no bulk crawling or automatic publication
- child membership changes only through the existing editorial and rights workflow

## Product representation

The existing catalogue model should remain authoritative.

### Individual items

NASA, the three NOAA cameras and Kīlauea V1–V3 are represented as seven `content_items`:

- `content_type = live`
- `access_level = public`
- primary category: `live`
- one primary `playback_source`
- one approved `rights_record`
- visible official-source and attribution copy

### Collections

Mauna Loa and Rivers & Lakes are represented using the existing `collections` and `collection_items` tables. Each camera remains an independently reviewable content item with its own playback source, rights record and health state.

A collection must not remain in `Live now` when it has no healthy children.

## Technical architecture

### Adapter registry

Add a provider-owned adapter registry. Editors must select an approved provider/source definition; they must not paste arbitrary iframe, image or media URLs that become publicly rendered or server-fetched.

Initial adapters:

#### `official_live_embed`

Used for official NASA, NOAA, USGS or approved official YouTube players.

Responsibilities:

- validate the provider and source ID against a committed or database-backed allowlist;
- produce the approved iframe/player URL server-side;
- use a source-page fallback when embedding is unavailable;
- retain provider controls, branding and advertising;
- prevent arbitrary iframe origins;
- expose no raw HLS or DASH extraction path.

#### `public_domain_live_image`

Used only for an explicitly public-domain USGS current image or panorama.

Responsibilities:

- HTTPS-only official-host allowlist;
- DNS resolution and private/reserved address rejection;
- at most three reviewed redirects;
- strict image MIME allowlist;
- byte-size and dimension limits;
- request timeout and bounded retry;
- conditional requests with `ETag` and `Last-Modified` where supported;
- refresh no faster than the source itself;
- write only the current image and metadata to a short-lived Jalwa cache;
- retain the source timestamp and Jalwa retrieval timestamp;
- never expose a generic public URL proxy.

The initial implementation must not archive a historical image sequence. Archiving requires a separate retention, storage and editorial decision.

### Data contract

Extend the current provider contract with `noaa` and `usgs`.

Add a typed live-source configuration keyed to `playback_sources`. The implementation may use a dedicated `live_source_configs` table or an equivalently constrained schema, but it must provide typed fields for:

- delivery adapter;
- official source page;
- official terms/media-guideline URL;
- allowed origin hosts;
- expected media type;
- refresh interval;
- freshness threshold;
- availability policy;
- required attribution;
- rights verification timestamp;
- next terms review timestamp;
- feature-flag state;
- operations owner.

Do not hide operationally important source configuration inside an unconstrained editor-controlled JSON blob.

### Catalogue repository

Extend the existing `PlaybackSource` contract with the minimum required live fields, including:

- live delivery format;
- current availability;
- current-image URL where applicable;
- source timestamp;
- last successful health check;
- fallback source URL.

The public catalogue query must return only published content with approved rights and a healthy or explicitly off-air state. A degraded source may remain visible with a warning; an unavailable source must be removed from active `Live now` discovery.

### Player components

Add separate components rather than expanding the YouTube player with provider-specific conditionals:

- `OfficialLiveEmbedPlayer`
- `PublicDomainLiveImagePlayer`
- `LiveAvailabilityNotice`

Player requirements:

- no audible autoplay;
- tap-to-play for video;
- stable 16:9 responsive frame where appropriate;
- source name and official-source link adjacent to the player;
- required attribution always visible;
- `Live`, `Off air`, `Unavailable` and `Last updated` states;
- keyboard and screen-reader support;
- reduced-motion support;
- no advertising overlay on external players;
- no false agency endorsement language.

## Source health and availability

Extend the existing protected source-health route rather than creating a second monitoring service.

Provider-aware checks must distinguish:

- official source page reachable;
- official embed/player available;
- current image reachable;
- image changed or refreshed within the configured freshness threshold;
- attribution and terms review still current.

Recommended state transitions:

```text
healthy
→ degraded after one failed check
→ unavailable after three consecutive failed checks
→ healthy after one complete successful provider-aware check
```

NOAA operational downtime should be shown as `Off air` where the official source indicates that no expedition stream is active. It should not be treated as a copyright or platform failure.

Monitoring requirements:

- bounded schedule appropriate to the source;
- no unbounded concurrent origin requests;
- operations alert for sustained unavailability;
- alert for stale USGS images;
- alert before rights/terms review becomes overdue;
- immediate staff unpublish control;
- preserve health history and last known reason.

## Security boundary

Required controls:

- provider-specific host allowlists;
- no arbitrary iframe source;
- no generic server-side media proxy;
- SSRF protections equivalent to or stronger than the existing source-health implementation;
- strict response MIME and size checks;
- CSP changes limited to approved official domains;
- `frame-src`, `img-src` and `connect-src` reviewed separately;
- no client-visible service credentials;
- no mutable or unreviewed provider configuration in production;
- no production source enabled from an unreviewed database edit alone.

## Monetisation boundary

Jalwa may monetise its own page, navigation, recommendations and editorial context. It must not:

- place advertisements over or inside an official external player;
- replace or suppress provider advertising or controls;
- imply NASA, NOAA or USGS endorsement;
- use protected agency identifiers as Jalwa branding;
- place any of the nine sources behind Premium access;
- claim ownership of agency footage or camera outputs.

Analytics must distinguish Jalwa page engagement from provider-player behaviour. A still-image refresh is not a video play and must not generate watch-minutes.

## Staging plan

### Stage 1 — Schema and adapter implementation

- add provider/source contracts and migrations;
- implement adapters and allowlists;
- add deterministic fixtures and unit/contract tests;
- extend source-health checks;
- keep the feature flag off.

### Stage 2 — Catalogue and player experience

- add `/live` discovery;
- add the seven individual items and two collections as staging fixtures;
- implement status, attribution and fallback states;
- add mobile and accessibility tests.

### Stage 3 — Rights and live-origin acceptance

For each source:

- store official source and terms evidence;
- approve the rights record;
- verify the exact embed or image endpoint;
- verify attribution;
- verify page monetisation does not alter the external player;
- verify source failure and removal behaviour.

### Stage 4 — Seven-day staging observation

Retain at least seven days of:

- source-health results;
- source availability and off-air transitions;
- browser errors;
- mobile performance;
- stale-image checks;
- manual unpublish rehearsal;
- terms/attribution review confirmation.

## Production rollout

1. Select the exact green `main` SHA that passed staging acceptance.
2. Deploy web, worker and migrations with `public_domain_live_sources` disabled.
3. Verify readiness, migrations, health, backups and rollback evidence.
4. Run provider-aware checks against all nine approved entries.
5. Confirm rights and content approval against the exact source inventory.
6. Enable the feature flag.
7. Verify `/live`, all seven individual items and both collections on representative Android and iOS browsers.
8. Verify no source is Premium-gated and no ad overlays an external player.
9. Retain the enabled source inventory in the production release record.
10. Monitor continuously and fail closed when a source becomes unavailable or its rights review expires.

## Acceptance matrix

| Area | Required evidence |
|---|---|
| Rights | Official source, official terms, evidence hash, attribution and approved rights record for every item |
| Data | Typed provider/live-source contract and forward-only migration |
| Security | Host allowlists, SSRF rejection, CSP tests and no arbitrary proxy/iframe path |
| Playback | Official embed or approved current-image adapter only |
| UX | Mobile-first layout, status states, attribution, source link and accessible controls |
| Operations | Provider-aware health checks, alerts, kill switch and retained history |
| Monetisation | Ads confined to Jalwa-owned page regions; no endorsement or Premium gate |
| Testing | Unit, migration, source-health, browser, failure-state and production-container gates |
| Rollout | Default-off flag, seven-day staging evidence and explicit production enablement approval |

## Expansion rule

Additional live sources may be proposed later, but no source inherits approval from NASA, NOAA or USGS. Every new provider requires its own official-source evidence, commercial-use analysis, adapter/host allowlist, attribution contract, health behaviour and staging acceptance.
