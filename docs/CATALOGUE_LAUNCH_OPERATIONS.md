# Catalogue launch operations

Jalwa uses one deliberately small content-operations workflow for staging and launch. It supports manual drafts, official YouTube embeds and governed batch intake from JSONL or CSV. Imported records always enter as drafts and never receive automated rights approval.

## Intake paths

- **Manual draft:** Studio → Content → Add content.
- **YouTube embed:** paste a public video URL in Studio. Jalwa uses the official privacy-enhanced player and does not download the video.
- **Batch file:** prepare JSONL from `content/launch-catalogue.example.jsonl` or CSV from `content/launch-catalogue.example.csv`.

Validate a batch without writing data:

```bash
node scripts/launch-catalogue.mjs content/launch-catalogue.csv --min=1
node scripts/import-launch-catalogue.mjs content/launch-catalogue.csv --min=1
```

Commit a validated batch to a configured staging backend:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://api.staging.example \
SUPABASE_SERVICE_ROLE_KEY=... \
node scripts/import-launch-catalogue.mjs content/launch-catalogue.csv --min=1 --commit
```

The service-role key must only be used from an administrator workstation or protected CI job. It must never be exposed to the browser.

## Rights approval gate

A rights reviewer cannot approve a record until all of the following are present:

- original source URL;
- source organisation or creator;
- licence or permission basis;
- required attribution;
- evidence URL or internal evidence reference;
- takedown owner/contact;
- future expiry date when rights are time-limited;
- embedding permission for embed-only content;
- rehosting permission for self-hosted content;
- commercial-use permission for self-hosted or Premium content.

Changing a rights record resets it to `pending`. PostgreSQL blocks publication when the approved record is missing, incomplete, expired or incompatible with the selected hosting mode.

Expired rights are also excluded from public catalogue and playback policies immediately, even when the content row still says `published`.

## Safe re-import behaviour

Batch re-import updates catalogue metadata but preserves the current content status. It does not demote published records to drafts. Human-approved rights records are preserved and are never overwritten by an import.

## Takedown and expiry operations

Use Studio’s **Unpublish immediately** action for a complaint, source removal, permission dispute or legal hold. The action records an audit event and removes the item from public catalogue routes.

Use the catalogue operations filters to find:

- pending or missing rights;
- published items;
- unavailable items;
- expired rights;
- rights expiring within 30 days.

## Staging acceptance

Before production deployment:

1. Import a small authorised staging catalogue from CSV.
2. Confirm incomplete records cannot be approved.
3. Approve one embed-only item with evidence and takedown ownership.
4. Publish it and verify it appears in Explore and playback works.
5. Set its expiry in the past directly in staging and verify public catalogue access is blocked.
6. Restore a future expiry, reapprove and republish.
7. Use **Unpublish immediately** and verify the item disappears.
8. Re-import the same CSV and confirm publication state and approved rights are preserved.
9. Retain the audit events and screenshots as staging acceptance evidence.
