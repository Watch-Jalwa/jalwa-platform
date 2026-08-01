# Institutional and public-affairs live sources

## Release scope

This release expands Jalwa's approved live catalogue from nine to fifteen user-facing entries.

The six added entries are:

1. European Parliament Plenary
2. European Parliament Committee Rooms
3. UN Web TV
4. UN General Assembly
5. UN Security Council
6. UN Human Rights Council

Together with the existing NASA, NOAA and USGS inventory, the database contains 21 underlying live content records and two USGS collections.

## Delivery mode

All six institutional entries use `official_live_link` and `external_link`.

Jalwa:

- displays the source title, description, Urdu title, attribution and current source-health state;
- sends the viewer to the institution's official live or category page;
- does not download, capture, proxy, reproduce, cache, record or restream the institutional video;
- does not render a hidden or arbitrary iframe;
- does not place advertising over institutional footage;
- keeps the entries public and free;
- keeps comments and social actions disabled on the live-source watch page.

The official page is checked through the same HTTPS allowlist, public-DNS, private-address rejection, redirect and response-size controls used by the existing live-source system.

## European Parliament boundary

European Parliament material may be reused subject to its legal notice, source acknowledgement and third-party rights. Its Multimedia Centre can provide iframe codes, but live meeting codes are event-specific.

The two European Parliament entries therefore ship as official links. An entry may be changed to inline playback only when the exact official iframe or written authorization for the selected event is retained in the rights record and the committed allowlist is updated through review and CI.

Required attribution:

`© European Union, 2026 – Source: European Parliament.`

Jalwa must not imply Parliament endorsement or use Parliament logos as Jalwa branding.

## United Nations boundary

United Nations Web TV footage is not public domain. Use of UN footage requires written authorization and a signed licence agreement; fees may apply.

The four UN entries are approved only as direct links to the official UN Web TV service. Their rights records deliberately set:

- `hosting_mode = external_link`
- `delivery_adapter = official_live_link`
- `embedding_confirmed = false`
- `self_hosting_confirmed = false`
- `commercial_use_confirmed = false`
- licence basis `UNITED_NATIONS_OFFICIAL_LINK_ONLY`

No UN entry may be converted to an inline player, cached video, clip, replay or restream until a written UN licence reference is retained and a separately reviewed migration changes that boundary.

## Database and activation behavior

Migration `202608010003_institutional_public_affairs_live_sources.sql` installs all six records with current rights-review metadata and keeps them disabled and unpublished.

The protected live-source activation workflow then changes all 21 underlying records transactionally:

1. verify current approved rights and review dates;
2. enable the live-source configurations;
3. publish the 21 content items and two collections;
4. enable the environment feature flag;
5. run source health and mobile browser acceptance;
6. roll back both database and runtime state if acceptance fails.

The browser acceptance test verifies that all fifteen user-facing entries appear, all six institutional watch pages contain the official-source action, and none of those six pages contains an iframe.

## Review dates

Institutional review recorded: `2026-08-01T11:07:00Z`

Next mandatory review: `2026-10-30T11:07:00Z`

An expired review causes the entries to fail closed.

## Upgrade path

To add inline European Parliament playback later:

1. obtain the event-specific official iframe code or written authorization;
2. retain the event, URL, date, permitted environments and expiry in the rights record;
3. add only the required official host to the committed allowlist;
4. update the adapter and hosting mode through a forward-only migration;
5. add provider-specific health and browser acceptance;
6. pass exact-head CI and protected staging activation.

To add inline United Nations playback later, complete the same process only after a signed UN licence agreement is retained.
