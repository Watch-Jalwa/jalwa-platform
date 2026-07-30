# Core Data Model

## Identity

### users

- id
- email
- phone
- phone_verified_at
- status
- preferred_language
- created_at
- deleted_at

### profiles

- id
- user_id
- display_name
- avatar
- is_kids
- language
- maturity_limit
- created_at

MVP may expose one profile while retaining a schema that supports multiple profiles later.

## Catalogue

### content_items

- id
- slug
- content_type
- hosting_mode
- access_level
- status
- title_en
- title_ur
- title_roman_ur
- description_en
- description_ur
- description_roman_ur
- primary_category_id
- duration_seconds
- language
- audience
- sensitivity
- publish_at
- unpublish_at
- is_featured
- created_by
- updated_by
- created_at
- updated_at

### content_versions

Stores immutable editorial snapshots for audit and rollback.

### categories

- id
- parent_id
- slug
- name_en
- name_ur
- name_roman_ur
- sort_order
- is_active

### collections

- id
- slug
- title
- description
- access_level
- hero_asset_id
- publish_at

### collection_items

- collection_id
- content_id
- sort_order

### content_tags and tags

Use tags for discovery, not as a substitute for categories.

## Playback and media

### playback_sources

- id
- content_id
- source_type
- provider
- provider_content_id
- embed_url
- manifest_url
- mp4_url
- external_url
- drm_policy
- region_policy
- starts_at
- ends_at
- status

### media_assets

- id
- owner_type
- owner_id
- kind
- storage_key
- mime_type
- size_bytes
- checksum
- width
- height
- duration_seconds
- status
- created_at

### media_renditions

- id
- media_asset_id
- format
- codec
- width
- height
- bitrate
- storage_key

### captions

- id
- content_id
- language
- format
- storage_key
- source
- reviewed_at

### transcripts

- id
- content_id
- language
- body
- source
- reviewed_at
- embedding_status

## Rights and provenance

### source_accounts

Approved channels, organisations or libraries.

- id
- provider
- external_id
- name
- source_url
- trust_level
- import_policy
- active

### source_items

Raw imported metadata before publication.

### licenses

- id
- code
- version
- commercial_use_allowed
- derivatives_allowed
- share_alike_required
- attribution_required
- terms_url

### rights_records

- id
- content_id
- source_url
- creator
- copyright_holder
- license_id
- jurisdiction_note
- commercial_use_confirmed
- modification_confirmed
- self_hosting_confirmed
- embedding_confirmed
- verified_by
- verified_at
- expires_at
- status

### license_evidence

- id
- rights_record_id
- evidence_type
- storage_key
- source_snapshot_url
- captured_at
- hash

### attributions

- id
- content_id
- display_text
- creator_url
- licence_url
- change_notice

## Viewing

### watch_sessions

- id
- profile_id
- content_id
- playback_source_id
- started_at
- ended_at
- seconds_watched
- completion_percent
- device_class

### watch_progress

One current progress record per profile and content item.

### favourites

- profile_id
- content_id
- created_at

## Plans and payments

### plans

Logical offering such as Free or Premium.

### prices

- id
- plan_id
- currency
- amount_minor
- billing_period
- active_from
- active_to
- provider_price_reference

### checkout_orders

- id
- user_id
- price_id
- amount_minor
- currency
- provider
- provider_order_reference
- status
- idempotency_key
- created_at

### payment_attempts

- id
- checkout_order_id
- provider_transaction_id
- status
- amount_minor
- raw_event_hash
- created_at

### subscriptions

- id
- user_id
- plan_id
- provider
- provider_subscription_id
- status
- current_period_start
- current_period_end
- cancel_at_period_end

### entitlements

The source of truth for access.

- id
- user_id
- benefit_code
- starts_at
- ends_at
- source_type
- source_id
- status

### webhook_events

- provider
- provider_event_id
- signature_valid
- received_at
- processed_at
- status
- payload_hash

## AI

### ai_conversations

- id
- user_id
- profile_id
- context_content_id
- language
- created_at

### ai_messages

- conversation_id
- role
- redacted_body
- cited_content_ids
- model_key
- prompt_version
- input_tokens
- output_tokens
- safety_status

### ai_usage_ledger

- user_id
- date
- feature
- units
- estimated_cost

### prompt_versions

- key
- version
- instructions
- response_schema
- status
- created_by

### evaluation_cases and evaluation_runs

Used to prevent prompt and model regressions.

## Operations

### ingestion_jobs

### moderation_reviews

### audit_logs

### feature_flags

### support_cases

### takedown_requests

### notification_deliveries

## Important constraints

- unique provider event IDs;
- unique idempotency key per checkout action;
- one active watch-progress record per profile/content;
- no published content without an approved rights record unless it is Jalwa-owned;
- no premium playback token without active entitlement;
- no hard delete of payments, rights decisions or audit records.
