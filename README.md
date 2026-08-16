# Patriot Claim Tracker

Patriot Claim Tracker is a local-first Chrome extension that helps veterans organize VA.gov claim, message, document, benefit, payment, health, and form data into a cleaner dashboard.

The extension is designed to run locally in the browser. It does not require an external server, does not sell user data, and is intended to help veterans better understand and organize information already available to them through VA.gov.

## Current Features

- Claim overview and status extraction
- VA.gov API response capture after login
- Messages, folders, and message metadata organization
- Document and letter link detection
- Benefits and disability-rating summary
- Health appointment signal extraction
- Payment-history signal extraction
- Forms and claim-prep resource tab
- Local JSON export and veteran packet export
- Redaction of sensitive identifiers in exports

## Install in Chrome

> Chrome extensions installed from GitHub must be extracted first. Do **not** try to load the ZIP file itself in Chrome.

1. Download the latest source ZIP: https://github.com/GabrielAllit1/Patriot-Claim-Tracker/archive/refs/heads/main.zip
2. Extract `Patriot-Claim-Tracker-main.zip` completely.
3. Confirm the extracted `Patriot-Claim-Tracker-main` folder contains `manifest.json`, `popup.html`, `popup.js`, `content.js`, and `background.js`.
4. Open Chrome and go to `chrome://extensions`.
5. Turn on **Developer mode**.
6. Click **Load unpacked**.
7. Select the extracted `Patriot-Claim-Tracker-main` folder — the folder that directly contains `manifest.json`.

If Chrome reports a missing or unreadable manifest, the wrong folder was selected. Select the folder that directly contains `manifest.json` rather than the ZIP file or a parent directory.

## Repository Layout

The installable extension files intentionally live at the repository root so GitHub's generated source ZIP can be extracted and loaded directly:

```text
Patriot-Claim-Tracker/
├── manifest.json
├── background.js
├── content.js
├── injected.js
├── popup.html
├── popup.css
├── popup.js
├── icon16.png
├── icon48.png
└── icon128.png
```

## Privacy

This extension processes sensitive veteran-related information. Data is stored locally in the user's browser through Chrome storage. The extension should not be used on shared or untrusted devices.

## Disclaimer

This project is not affiliated with, endorsed by, or sponsored by the U.S. Department of Veterans Affairs. It is an independent tool intended to help users organize their own VA.gov information.
