# Phase 3: Media and streaming

Implemented:

- direct browser-to-R2 source uploads;
- staff-only upload creation and completion routes;
- media asset and retryable job tables;
- FFmpeg short MP4 and three-rendition HLS processing;
- worker job claiming with `FOR UPDATE SKIP LOCKED`;
- signed five-minute playback tokens;
- Cloudflare Worker R2 media gateway;
- HLS.js player;
- scroll-snap shorts feed;
- database publish guard for self-hosted media;
- Docker worker with FFmpeg.

## Required setup

1. Apply migration `202607300003_media_pipeline.sql`.
2. Create the `jalwa-media` R2 bucket.
3. Configure R2 S3 credentials in web and worker.
4. Deploy `infrastructure/media-gateway`.
5. Set the same `MEDIA_SIGNING_SECRET` in web and gateway.
6. Run the media worker.
7. Upload only content with approved self-hosting rights.

Premium media currently returns `payment_required`. Phase 4 will connect playback to paid entitlements.
