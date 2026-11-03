# Karsus browser extension

A toolbar popup that starts an encounter on karsusinitiative.com, from scratch or
from one of your presets, then opens it in a new tab. It uses the site's own
sign-in: if you're signed in to Karsus in this browser, the popup is too.

## Try it

1. Open `chrome://extensions` (or `edge://extensions`) and turn on **Developer mode**.
2. Click **Load unpacked** and pick this `extension` folder.
3. Pin Karsus from the puzzle-piece menu and click its icon.

## Publish it

Zip the contents of this folder (not the folder itself) and upload it in the
[Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole).
The store asks for a one-time developer fee, screenshots, and a privacy note: the
extension only talks to karsusinitiative.com and stores nothing itself.

Bump `version` in `manifest.json` for every upload.
