# Frontend audit

## Overview
- The landing page is a single static document with anchors for hero, features, catalog, platform, gallery, and contact sections, plus deep links to the catalog and category listings. Navigation and calls-to-action rely on inline text for three languages. 【F:index.html†L60-L164】
- Language toggles are implemented by duplicating content in multiple `<span>`/`<p>` blocks that are selectively hidden based on a `data-lang` attribute. 【F:index.html†L34-L164】
- Runtime configuration is read from `config.js`, which populates API host and Google OAuth client ID data attributes at load time instead of embedding credentials in HTML. 【F:config.js†L1-L35】【F:index.html†L20-L33】
- PWA support is wired through a service worker registration and custom install prompts that show any button marked with `data-install-trigger`. 【F:pwa.js†L2-L77】【F:index.html†L47-L128】

## Strengths
- Clear PWA affordances: install buttons appear in the header and hero areas, and the code falls back to opening the manifest if the install prompt is unavailable. 【F:index.html†L47-L128】【F:pwa.js†L32-L36】
- Navigation is concise and action-oriented, keeping the focus on catalog access and category browsing without clutter. 【F:index.html†L60-L200】
- Language initialization now respects the saved preference or the current selector value, keeping the dropdown and rendered copy in sync and persisting the choice. 【F:index.html†L34-L45】【F:lang.js†L1-L36】

## Risks & issues
- Internationalization requires duplicating every string in the markup, which increases page weight and maintenance overhead. A dictionary-based renderer (e.g., JSON locale bundles consumed by JavaScript) would be more scalable and accessible. 【F:index.html†L34-L164】【F:lang.js†L2-L8】
- Runtime config ships with empty defaults; deployments must inject real API base URLs and OAuth IDs into `window.__APP_CONFIG__` (or query parameters) to keep authentication and catalog APIs functional. Consider providing environment-specific builds or CI substitutions to prevent shipping empty settings. 【F:config.js†L1-L35】

## Recommendations
- Externalize environment-specific values (API base URL, OAuth client IDs) into configuration files or environment variables that are injected during the build/deploy pipeline rather than hard-coded attributes. 【F:index.html†L20-L33】【F:config.js†L1-L35】
- Align language initialization with the selected option or persist the user’s preference in storage to avoid conflicting defaults. Replace the current `setLanguage('tm')` call with logic that reads the selector value or a saved preference. 【F:index.html†L34-L45】【F:lang.js†L1-L36】
- Move translations into JSON locale files and render text via a lightweight i18n utility so that markup stays DRY and future languages do not require tripling every block of content. 【F:index.html†L34-L164】【F:lang.js†L2-L8】
- Consider lazy-loading heavier catalog assets and deferring non-critical scripts to improve initial render on low-end devices, keeping the landing experience focused on the primary CTAs. 【F:index.html†L74-L200】
