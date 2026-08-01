# Open-government live catalogue expansion

## Release scope

This release expands the approved live catalogue from 15 to 46 user-facing entries:

- 52 underlying source records;
- 44 direct watch entries;
- two existing USGS collections;
- 23 secured current-image sources;
- 22 official-link-only sources;
- seven existing official embeds.

The new batch contains 31 entries:

- five DVIDS public-affairs categories;
- three additional NASA schedules and services;
- fifteen National Park Service current-image cameras;
- NIH VideoCast;
- FDA advisory committee coverage;
- SEC public meetings;
- FCC open meetings;
- Europe by Satellite and EbS+;
- U.S. House FloorCast;
- U.S. Senate floor webcast.

## Rights and delivery boundary

“Available to the public” is not treated as equivalent to “copyright free.” Each record has a source-specific rights basis and committed delivery mode.

### National Park Service cameras

The fifteen selected cameras use the existing `public_domain_live_image` adapter. Only images that:

- originate from `www.nps.gov` or `home.nps.gov`;
- use public HTTPS;
- resolve to public network addresses;
- match the committed `/webcams-*` image path pattern;
- pass media type, size and freshness checks;

may be served through Jalwa. Partner-hosted park cameras and page artwork are rejected. Attribution and non-endorsement remain visible, and the NPS Arrowhead is not used as Jalwa branding.

### DVIDS, NASA event services and Tier B

These sixteen entries use `official_live_link`. Jalwa presents catalogue and health state, then opens the institution’s official page. The release does not:

- create an iframe;
- extract or proxy a stream;
- download, cache or record footage;
- restream video;
- infer event-level rights from agency ownership;
- automatically upgrade a source to inline playback.

This boundary is required because DVIDS events, NASA programmes, scientific presentations, regulatory meetings and institutional broadcasts can contain third-party footage, music, slides, speakers or trademarks.

House, Senate, EbS and EbS+ are treated as ad-free source experiences.

## Database behavior

Migrations install all new records with:

- public access level;
- `editorial_review` status;
- source configuration disabled;
- approved rights records limited to the committed delivery mode;
- current rights review timestamps;
- initial degraded health state pending activation.

The `approved_live_catalogue_manifest` is the operational source of truth for all 52 underlying records. Collection children are marked non-user-facing; the two USGS collections complete the 46-entry user experience.

## Controlled activation

The protected activation workflow:

1. checks that the exact deployed SHA is on `main`;
2. verifies all 52 manifest records have current approved rights;
3. transactionally publishes and enables the database inventory;
4. enables the runtime flag;
5. executes provider-aware source health;
6. runs 390×844 mobile browser acceptance across all 46 entries;
7. verifies no iframe exists on any of the 22 official-link watch pages;
8. verifies representative USGS and NPS current-image routes;
9. rolls back runtime and database state on any failure.

Normal deployment alone never exposes the catalogue.

## Review deadline

The earliest mandatory terms review remains `2026-10-30T09:51:00Z`. The new open-government batch has its own review deadline of `2026-10-30T12:27:00Z`. Runtime and database gates fail closed after the applicable deadline.
