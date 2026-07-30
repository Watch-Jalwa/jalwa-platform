# Product Requirements Document

## 1. Product identity

**Name:** Jalwa  
**Domain:** watch-jalwa.com  
**Form factor:** mobile-first responsive web application and installable PWA  
**Primary market:** Pakistan  
**Primary languages:** Urdu, Roman Urdu and English

## 2. User groups

### Viewer

Discovers and watches free or paid content.

### Subscriber

Has an active paid entitlement and receives premium benefits.

### Parent or family viewer

Needs family-safe discovery and restricted playback.

### Content editor

Creates, imports, classifies and schedules content.

### Rights reviewer

Verifies licences, attribution and distribution permissions.

### Support agent

Investigates payments, account access and playback problems.

### Administrator

Controls plans, pricing, categories, feature flags and staff access.

## 3. Core user journeys

### Anonymous discovery

1. User lands on home page.
2. User sees hero feature, trending rows and category shortcuts.
3. User opens a content page.
4. Free item plays immediately; premium item shows a preview and upgrade action.
5. User can create an account to save progress.

### Account onboarding

1. User selects email or supported social login.
2. User accepts terms and privacy notice.
3. User chooses language preferences.
4. User optionally provides a mobile number.
5. User reaches a personalised home page.

Phone OTP should not block MVP launch unless a low-cost, reliable local provider is contracted.

### Subscription purchase

1. User selects monthly or annual plan.
2. Server creates an immutable checkout order.
3. User is redirected to the payment provider's hosted checkout.
4. Provider returns user to Jalwa.
5. Jalwa waits for a verified server callback or reconciliation result.
6. Entitlement activates.
7. User receives a receipt and sees premium status.

A browser redirect alone must never activate premium access.

### Playback

1. User opens content.
2. Policy engine resolves access.
3. Player type is selected:
   - YouTube embed;
   - self-hosted MP4;
   - self-hosted HLS;
   - article/Quran reader;
   - external link.
4. Watch progress is persisted.
5. Related items are shown.
6. Premium upsell appears only where appropriate.

### Ask Jalwa

1. User asks a question from a content page or global assistant.
2. The system retrieves approved catalogue passages and metadata.
3. AI returns an answer in the user's preferred language.
4. Answer cites Jalwa content cards.
5. Unsafe or unsupported requests are refused or redirected.
6. Usage is recorded against the user's allowance.

## 4. Functional requirements

### Catalogue

- categories and subcategories;
- collections and playlists;
- content detail pages;
- free, registered and premium access levels;
- content availability dates;
- language, duration, rating and tags;
- source and attribution display;
- related content;
- editorial ranking and hero placement.

### Search and discovery

- title and description search;
- Urdu and Roman Urdu aliases;
- filters by category, language, duration and access level;
- trending and recently added;
- continue watching;
- favourites;
- editorial collections;
- semantic search after core keyword search is stable.

### Accounts

- authentication;
- profile and language preferences;
- watch history;
- continue watching;
- favourites;
- subscription and payment history;
- account deletion request;
- logout from all sessions.

### Studio

- dashboard;
- content editor;
- media upload;
- external URL import;
- source allowlist;
- rights review;
- attribution generator;
- publishing workflow;
- category management;
- collection builder;
- hero/banner scheduling;
- plan and price management;
- subscriber lookup;
- payment reconciliation;
- AI usage reporting;
- audit log.

### Media

- direct-to-storage upload;
- video metadata extraction;
- poster and thumbnail generation;
- captions;
- HLS renditions for long-form content;
- MP4 optimisation for shorts;
- signed premium playback;
- playback error telemetry.

### Payments

- provider abstraction;
- hosted checkout;
- webhook verification;
- idempotency;
- paid entitlement;
- expiry;
- cancellation;
- refund tracking;
- reconciliation;
- manual support correction with audit log.

### AI

- catalogue-grounded Q&A;
- summary;
- Urdu/Roman Urdu explanation;
- quiz generation;
- editorial metadata suggestions;
- transcript and caption assistance;
- moderation;
- duplicate detection;
- prompt and model version tracking;
- quotas and budget controls.

## 5. Non-functional requirements

### Mobile-first

- design at 360-pixel width first;
- tap targets at least 44px;
- no hover-only interactions;
- portrait shorts player;
- bottom navigation on small screens;
- fast first contentful render;
- skeleton states;
- PWA manifest and installability.

### Low-data mode

- no hero autoplay by default;
- compressed WebP/AVIF images;
- 360p and 480p playback options;
- disable prefetch for video;
- text-only thumbnails option later;
- remember data-saving preference.

### Accessibility

- keyboard operation;
- focus states;
- captions where available;
- semantic headings;
- alt text;
- colour contrast;
- screen-reader labels;
- reduced motion;
- RTL-safe Urdu layouts.

### Reliability

- payment actions must be idempotent;
- watch progress writes must not block playback;
- unavailable embeds must fail gracefully;
- content imports must not auto-publish;
- background jobs must be retryable;
- all privileged actions must be audited.

## 6. MVP acceptance criteria

- responsive home, category, search and content pages;
- account creation and session management;
- YouTube embed playback;
- self-hosted short playback;
- HLS playback for at least one long-form item;
- watch progress and favourites;
- admin import, rights review and publishing;
- monthly and annual checkout;
- verified payment callback and entitlement;
- premium access control;
- Ask Jalwa with cited catalogue results;
- analytics events;
- error monitoring;
- published legal and support pages.
