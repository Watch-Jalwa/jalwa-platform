# Internal Alpha Content Platform

**Status:** repository implementation for protected staging validation
**Owner tracker:** GitHub issue #59
**Source approval register:** `content/alpha-approved-sources.json`

## Purpose

This implementation turns the approved open-content source register into a controlled internal-alpha operating system. It does not treat a source-level approval as automatic permission to publish every item.

The release adds:

- 151 approved source lanes for metadata discovery;
- an item-level review and governed draft queue;
- source-, content-, playback- and asset-level kill switches;
- rights holds, expiry enforcement and immutable audit events;
- invite-only alpha access controlled in PostgreSQL;
- R2/FFmpeg and AWS/MediaConvert media-provider boundaries;
- private S3, SQS/DLQ, MediaConvert, CloudFront signed playback and cost alarms;
- protected exact-SHA infrastructure and alpha activation workflows.

## Availability rule

A catalogue item is visible and playable only when every applicable condition passes:

```text
internal alpha access is valid
AND content is published and explicitly available
AND source is enabled, approved and current
AND rights evidence is publishable and has no hold
AND primary playback is active and explicitly available
AND self-hosted media is ready and explicitly available
```

The database owns this rule through `is_content_effectively_available`. Public catalogue RLS, search, playback-source RLS and token issuance all use the same decision.

Disabling a source cascades availability off for its content, playback and media and requests cancellation of queued/processing jobs. Re-enabling a source does not silently restore child items. Every item must be restored explicitly after review.

## Source and item workflow

```text
Approved source lane
→ metadata-only harvest
→ source_items candidate
→ item-level rights approve/reject/hold
→ governed content draft
→ rights evidence completed
→ media upload or provider link
→ transcode and playback QA
→ editorial publish
→ explicit availability ON
→ internal alpha catalogue
```

No harvester downloads or publishes media. The harvester currently supports controlled adapters for Wikimedia Commons, NASA, Smithsonian, the Met, Art Institute of Chicago, Cleveland Museum of Art and compatible Openverse image/audio discovery. Unsupported lanes remain installed but are skipped until an adapter is implemented.

Run locally:

```bash
npm run harvest:alpha -- --source WM-001 --limit 100 --out artifacts/wikimedia.jsonl
```

The protected **Harvest approved alpha content metadata** workflow can retain an immutable JSONL artifact and optionally import candidates into the staging review queue.

## Studio operations

`/studio/alpha` provides:

- emergency alpha shutdown status; protected exact-SHA workflows are the only activation path;
- tester grants and revocation;
- all 151 source toggles;
- source-candidate rights review and draft promotion;
- content availability controls;
- immediate rights holds.

A rights hold disables the item immediately. Releasing the hold never republishes or restores availability automatically.

## Media backends

### Existing rollback path

```text
MEDIA_BACKEND=r2
TRANSCODE_BACKEND=ffmpeg
```

This retains the existing signed R2 media gateway and local FFmpeg MP4/HLS worker.

### AWS path

```text
MEDIA_BACKEND=aws
TRANSCODE_BACKEND=mediaconvert
```

The AWS path is:

```text
Studio upload request
→ HMAC-authenticated AWS media-control Lambda
→ private KMS-encrypted S3 incoming object
→ worker creates an HMAC-authenticated job marker
→ S3 event to SQS
→ submit Lambda creates an idempotent MediaConvert job
→ MediaConvert writes HLS/MP4 to private processed S3
→ EventBridge completion Lambda
→ service-role RPC reconciles asset, playback and job state
→ CloudFront OAC + signed cookies
```

The DigitalOcean application host does not require a long-lived AWS access key. It receives only:

- the media-control Function URL;
- the matching HMAC secret;
- the CloudFront signing private key;
- public bucket/CDN identifiers needed by runtime configuration.

### Video outputs

Short-form:

- portrait 720 × 1280 H.264/AAC MP4;
- progressive download metadata;
- explicit availability remains off after processing.

Long-form:

- Apple HLS multivariant playlist;
- 360p, 480p and 720p H.264/AAC;
- six-second segments;
- private S3 origin and signed CloudFront session.

The existing FFmpeg implementation remains available if MediaConvert is unavailable or cost policy changes.

## AWS provisioning

`infrastructure/aws-media` provisions separate staging/production resources:

- KMS key and aliases;
- incoming, processed and log buckets;
- public-access blocks, versioning, encryption, lifecycle and upload CORS;
- SQS processing queue and DLQ;
- MediaConvert on-demand queue and least-privilege job role;
- media-control, submit and completion Lambda functions;
- S3 notifications and EventBridge completion rule;
- CloudFront OAC, signed key group and private-origin policy;
- CloudWatch logs and queue alarms;
- monthly AWS budget notifications;
- Secrets Manager placeholders for callback and media-control credentials.

Use **Apply AWS media plane** first with `apply=false`. Review the exact Terraform plan, then repeat through the protected environment with `apply=true`.

The protected apply workflow populates the AWS Secrets Manager callback and control values, verifies the CloudFront public/private key pair, and publishes non-secret runtime outputs to the selected GitHub environment. The private signing key and media-control secret remain protected environment secrets.

After deploying the exact release SHA, run **Set media backend** to write the optional `/opt/jalwa/.env.media` overlay and switch web/worker transactionally. The workflow retains `backend=r2` as the rollback path.

## Internal-alpha activation

The protected **Set internal alpha state** workflow is the only supported environment activation path.

Enablement verifies:

- the exact deployed main commit SHA;
- all 151 source approvals are enabled and current;
- the requested minimum content count is published, playable and explicitly available;
- current item-level rights and no rights holds;
- at least one active tester grant when invite-only;
- deployed health reports the exact release SHA.

A failed enablement is rolled back to disabled/invite-only.

## Required staging acceptance

Before calling the internal alpha ready:

- migrations and all CI checks are green;
- AWS Terraform plan and apply are retained against the exact release SHA;
- raw S3 origins return access denied;
- signed CloudFront HLS and MP4 playback works;
- at least 50 mixed items pass rights, media and editorial QA;
- source and item kill switches block catalogue and new playback;
- MediaConvert failure, queue retry and DLQ recovery are exercised;
- Android Chrome, iPhone Safari and desktop journeys pass;
- startup time, buffering, playback errors and delivered minutes are visible;
- AWS budget and queue alarms are confirmed;
- named rights, operations and incident owners sign off.

## External configuration boundary

Repository code cannot create or infer the following owner-controlled values:

- AWS account, region, OIDC deploy role and Terraform state backend;
- staging DNS and media domain certificate;
- CloudFront signing key pair;
- media-control, CloudFront signing and Supabase callback secret values;
- deployed host environment values;
- staging Supabase service-role callback details;
- tester user UUIDs;
- actual item-level rights decisions and editorial QA evidence.

Internal alpha remains disabled until those values are configured and the protected activation workflow succeeds.
