# ScopePing

**A private, local-first scope checker for client messages.**

ScopePing is a dependency-free Chrome and Edge Manifest V3 extension for reviewing messages in Gmail and Upwork against scope you have already agreed with each client. It helps you spot requests that may need a conversation before you commit to extra work.

> ScopePing makes suggestions, not decisions. It never blocks or sends a message.

## What it does

- Add a small review control to supported Gmail and Upwork message views.
- Compare a message with the active client's approved scope only when you click the control.
- Show whether a request looks within scope or possibly out of scope, along with the closest matching scope item.
- Prepare an editable response draft from a template; you decide whether to copy, edit, and send it.
- Manage multiple clients, scope lists, response templates, and JSON backups in extension Options.
- Keep review data on your device. ScopePing does not send message text to a server or use analytics.

## Install for development

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Turn on **Developer mode**, choose **Load unpacked**, and select the repository folder.
4. Open ScopePing's **Options** page and complete the short onboarding flow.
5. Save a client and its agreed scope, then choose that client before reviewing a conversation.
6. On a supported message, click the ScopePing shield to see a local review and optional draft.

## Important: license gate is a placeholder

The current first-run gate accepts any key in the format `SCP-XXXX-XXXX-XXXX`. It checks the format locally, discards the entered key, and stores only a local activation flag. **It does not verify a purchase or provide production licensing.** This project has no payment integration or license server. See [`LICENSE_PLACEHOLDER.md`](LICENSE_PLACEHOLDER.md) before treating the gate as a real license system.

## Privacy and permissions

ScopePing is designed to work locally:

- Client names, approved scope, templates, the activation flag, and badge state use `chrome.storage.local`.
- Message text is inspected in the page only after you click the review control; it is not sent to an external service or saved by the service worker.
- The badge counts unique suspected messages reviewed that day. It stores opaque message keys and a count locally, not message contents.
- The extension requests `storage`, `alarms`, and `activeTab`. Its content scripts are limited to Gmail and Upwork message pages.
- There are no accounts, analytics, remote APIs, or server components.

## How matching works

Matching is deterministic and intended as a helpful prompt, not a substitute for reading the conversation or agreement:

1. ScopePing splits the reviewed text into sentences and checks for task-like request wording.
2. For each sentence and approved scope item, it scores exact token overlap (70%) and a whole-phrase match bonus (30%).
3. A task-like sentence is labeled **Possibly out of scope** only when its best scope-item score is below the client's threshold.
4. Long messages are bounded before analysis. Empty text and missing scope receive their own status.

The threshold is adjustable per client. ScopePing does not block messages or take action on your behalf.

## Development

The project has no build step or package installation. Run the tests with Node.js:

```sh
node --test
```

### Project layout

| Path | Purpose |
| --- | --- |
| `manifest.json` | Extension manifest and supported page matches |
| `background.js` | Service worker and local daily badge |
| `content/` | Gmail and Upwork message controls and review panel |
| `lib/` | Scope storage, matching, and response templates |
| `options/` | Client setup and scope management |
| `_locales/en/` | English interface strings |
| `tests/` | Node.js tests for matching, storage, manifest, and background behavior |

## Icons

The source icon is [`icons/scopeping.svg`](icons/scopeping.svg). Chrome extension manifest icons should be PNG; export it at 16×16, 48×48, and 128×128 pixels and add those files to `manifest.json` before packaging for store distribution.

## License

This project is distributed under the [Apache License 2.0](LICENSE).
