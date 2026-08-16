# Patriot Claim Tracker

Patriot Claim Tracker is a local-first Chrome extension that helps veterans organize information they are already authorized to view on VA.gov into a clearer dashboard for claims, messages, documents, benefits, health, payments, forms, resources, and redacted exports.

Current Chrome Web Store submission build: **v0.3.3**.

Product page: https://salt19.com/patriot-claim-tracker-download-page

## Current Features

- Claim overview and status extraction
- VA.gov response observation after login
- Messages, folders, and message metadata organization
- Document and letter link detection
- Benefits and disability-rating summary
- Health appointment and medication signal extraction
- Payment-history signal extraction
- Forms and claim-prep resources
- Local JSON/report export
- Redaction of sensitive identifiers in exports

## Privacy and Security

Patriot Claim Tracker processes potentially sensitive veteran information locally in Chrome. It does not require a SALT19 account and does not upload captured VA.gov information to SALT19 servers.

The extension may locally process identity/profile data, claims and appeals, disability/benefit information, health information, payment information, message data, documents/forms, and VA.gov page/API content needed to construct the dashboard.

The bundled network observer excludes authorization, cookie, set-cookie, and CSRF-token headers from captured response metadata. The extension does not request or collect the user's VA.gov password.

Because sensitive information can be stored locally in Chrome extension storage, do not use Patriot Claim Tracker on shared or untrusted devices.

Privacy policy: https://salt19.com/patriot-claim-tracker-download-page/privacy.html

## Permissions

The v0.3.3 build uses a deliberately narrow Manifest V3 permission set:

- `storage` — stores captured dashboard data locally in Chrome.
- `https://www.va.gov/*` — limits extension page access to VA.gov.

The extension uses a declarative content script on VA.gov and a bundled local observer script to organize VA.gov page/network information. It does not execute remotely hosted JavaScript.

## Manual / Developer Installation

> Chrome extensions installed from GitHub must be extracted first. Do **not** try to load the GitHub source ZIP itself in Chrome.

1. Download the latest source ZIP: https://github.com/GabrielAllit1/Patriot-Claim-Tracker/archive/refs/heads/main.zip
2. Extract `Patriot-Claim-Tracker-main.zip` completely.
3. Confirm the extracted `Patriot-Claim-Tracker-main` folder directly contains `manifest.json`, `src/`, and `assets/`.
4. Open `chrome://extensions`.
5. Enable **Developer mode**.
6. Click **Load unpacked**.
7. Select the extracted `Patriot-Claim-Tracker-main` folder that directly contains `manifest.json`.

## Repository Layout

```text
Patriot-Claim-Tracker/
├── manifest.json
├── src/
│   ├── background.js
│   ├── content.js
│   ├── injected.js
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── assets/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── README.md
└── LICENSE
```

## Disclaimer

Patriot Claim Tracker is not affiliated with, endorsed by, sponsored by, or operated by the U.S. Department of Veterans Affairs. VA.gov remains the authoritative source for official claims, benefits, health, payments, messages, forms, and records.

Patriot Claim Tracker is an organizational aid. It does not provide legal, medical, financial, or benefits-entitlement advice.
