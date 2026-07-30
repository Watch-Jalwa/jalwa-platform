# Phase 2 Catalogue and Rights Foundation

## Delivered

- catalogue taxonomy and database schema;
- rights records, licence evidence and publish guard;
- public PostgreSQL search function;
- mobile search and category filters;
- content detail pages with official YouTube embeds;
- staff-only Jalwa Studio;
- YouTube URL import through official oEmbed metadata;
- manual Jalwa content drafts;
- rights review and publish workflow;
- collections schema;
- source, licence and audit foundations.

## Operational rule

No content can move to `published` unless an approved rights record exists. YouTube imports create embed-only drafts and never download source media.

## Required setup

1. Apply both Supabase migrations.
2. Promote initial staff profiles to `editor`, `rights_reviewer` or `admin` through a trusted database/admin path.
3. Configure Supabase environment variables.
4. Review imported source and embedding status before approving rights.
