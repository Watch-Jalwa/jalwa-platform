# Approved Public-Domain Live Rights Record

## Decision

On 1 August 2026, the Jalwa owner confirmed approval to use the initial NASA, NOAA Ocean Exploration and USGS live-source inventory under the delivery and presentation constraints already committed in the repository.

This approval covers the seven individual live items and the two USGS collections defined in `docs/19-public-domain-live-source-integration.md`. The collections contain eight separately governed USGS image-camera items, so the database inventory contains fifteen underlying content records.

The recorded review timestamp is `2026-08-01T09:51:00Z`. The mandatory next review is `2026-10-30T09:51:00Z`. The application fails closed after that time until a new review is recorded.

## Official basis rechecked

- NASA Live: `https://www.nasa.gov/live/`
- NASA images and media guidelines: `https://www.nasa.gov/nasa-brand-center/images-and-media/`
- NOAA Ocean Exploration livestreams: `https://oceanexplorer.noaa.gov/livestreams/`
- NOAA Ocean Exploration media kit: `https://oceanexplorer.noaa.gov/about/media-kit/`
- USGS Kīlauea summit webcams: `https://www.usgs.gov/index.php/volcanoes/kilauea/summit-webcams`
- USGS Mauna Loa webcams: `https://www.usgs.gov/volcanoes/mauna-loa/webcams`
- USGS copyright and credits: `https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits`

The repository records the approval as an owner decision supported by the official pages above. It does not claim that terms can never change or replace future legal review.

## Enforced conditions

- Use only the committed official NASA, NOAA and USGS adapters and source definitions.
- Use official embeds for NASA, NOAA and the Kīlauea video sources.
- Use `self_host_open` only for the current approved public-domain USGS image fetched through the allowlisted snapshot adapter.
- Do not extract HLS/DASH URLs, proxy video, restream, record or create replay archives.
- Keep every source public and free; never place it behind Premium.
- Preserve the required attribution and official-source link.
- Do not imply NASA, NOAA or USGS sponsorship or endorsement.
- Do not use agency seals, logos or identifiers as Jalwa branding.
- Keep Jalwa advertising outside external players and current camera images.
- Fail closed when a source is disabled, unavailable, stale, unapproved or past its review date.

## Database behavior

Migration `202608010002_approved_public_domain_live_inventory.sql` installs or upgrades the exact approved inventory in staging and production databases.

After migration:

- all fifteen underlying content records exist;
- all fifteen rights records are approved;
- official embeds use `embed_only`;
- the eight USGS image records use `self_host_open`;
- source configurations contain the recorded review and next-review timestamps;
- source configurations remain disabled;
- content remains in editorial review rather than being automatically published;
- collections remain draft;
- the global runtime flag remains disabled.

This preserves separation between rights approval and operational release.

## Controlled activation

The protected **Set public-domain live sources** workflow performs activation transactionally:

1. verify the exact deployed `main` SHA and protected environment;
2. verify all fifteen approved rights records and current review dates;
3. enable the exact allowlisted database source configurations;
4. publish the fifteen underlying items and two collections;
5. enable the runtime feature flag;
6. run provider-aware source health;
7. run mobile live-source acceptance;
8. roll the runtime and database back to a disabled/unavailable state if enablement or acceptance fails;
9. record the result on issue #52.

Production enablement still requires the completed staging observation evidence and protected production-environment approval. Rights approval does not waive infrastructure, backup, source-health, browser, release-SHA or operational gates.
