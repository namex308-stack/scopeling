# Temporary local license stub

The first-run Options page accepts keys in the form `SCP-XXXX-XXXX-XXXX` and stores only `{ "licensed": true }` in `chrome.storage.local`. The supplied key is not stored.

This is a format check only. It does not authenticate a purchase, provide payment processing, or contact a server. Anyone can create a string in the accepted format. Replace the single `validateLicense(key)` function in `options/options.js` only after a Paddle account and production licensing flow are configured.
