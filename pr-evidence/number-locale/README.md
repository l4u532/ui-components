# Evidence: fix: format library numbers in an explicit locale

## What was reproduced

Library and preview code formatted numbers with `toLocaleString()` and no locale argument. The
server renders in en-US, this Mac runs de-DE, so the browser re-formatted the same values on
hydration: "48,273" from the server against "48.273" in the client. React treats that as a
hydration mismatch and reports it — in a production build as the minified error #418
("Hydration failed because the server rendered HTML didn't match the client").

Four pages are affected: /components/blocks/swap, /components/blocks/wallet-card,
/components/motion/number and /components/motion/table. The pull request pins "en-US" (and adds
`locale` props) so server and client agree.

Both builds were captured with the same script, the same viewport and the same browser locale.
Before the change every one of the four pages throws exactly one hydration error in both browsers;
after the change none of them throws anything at all — no errors, no warnings.

## How it was captured

Two production builds were already running and were not restarted or rebuilt:

- BEFORE — upstream main, http://localhost:3300
- AFTER — the pull request branch, http://localhost:3303

Pages (identical paths on both origins):

- http://localhost:3300/components/blocks/swap and http://localhost:3303/components/blocks/swap
- http://localhost:3300/components/blocks/wallet-card and http://localhost:3303/components/blocks/wallet-card
- http://localhost:3300/components/motion/number and http://localhost:3303/components/motion/number
- http://localhost:3300/components/motion/table and http://localhost:3303/components/motion/table

Machine: macOS 26.6.2, system locale de_DE.

**Chrome 153.0.8010.50**, driven by Playwright 1.63.0 with the installed Chrome
(`chromium.launch({ channel: "chrome" })`). Chrome was launched with the locale de-DE: every page
ran in a fresh context created with `newContext({ locale: "de-DE", viewport: { width: 1440, height: 900 } })`,
which reports `navigator.language === "de-DE"` and resolves `Intl.NumberFormat()` to de-DE. Console
errors and warnings (`page.on("console")`) and uncaught page errors (`page.on("pageerror")`) were
collected from navigation until five seconds after load.

**Safari 26.6.2**, driven by safaridriver over WebDriver. Safari has no locale
override: it uses the Mac's de-DE system locale, which the capture confirms per page
(`navigator.language === "de-DE"`). Safari also exposes no console through WebDriver, so errors were
read from an in-page wrapper around `console.error`, `console.warn`, `window`'s `error` event and
`unhandledrejection`. The hydration error fires while the page is still loading, so the wrapper has
to be installed before hydration: the session is created with `pageLoadStrategy: "none"`, which makes
navigation return immediately, and the wrapper is injected in a tight retry loop — in these runs 32
to 113 ms after navigation started. Installed the usual way, after the load event (about 280 ms in),
the wrapper sees nothing at all; that variant was tried first and missed the error on a page where
Chrome clearly shows it.

For each page the screenshot is a browser page capture (Playwright's `page.screenshot` in Chrome,
WebDriver's screenshot endpoint in Safari) of the viewport, scrolled so that the relevant preview is
centred: `#preview` on the swap and wallet-card pages, `#ticker-preview` on the number page and
`#data-preview` on the table page. No desktop captures were taken.

## Hydration errors per page and browser

| page | Chrome before | Chrome after | Safari before | Safari after |
|---|---|---|---|---|
| /components/blocks/swap | 1 | 0 | 1 | 0 |
| /components/blocks/wallet-card | 1 | 0 | 1 | 0 |
| /components/motion/number | 1 | 0 | 1 | 0 |
| /components/motion/table | 1 | 0 | 1 | 0 |

Every "before" entry is the same single message, an uncaught error:

```
Minified React error #418; visit https://react.dev/errors/418?args[]=text&args[]= for the full
message or use the non-minified dev environment for full errors and additional helpful warnings.
```

React error #418 is "Hydration failed because the server rendered HTML didn't match the client".
Every "after" entry is empty: zero errors and zero warnings.

## What the screenshots show

The layout, spacing and type are unchanged; the component renders exactly as before. What does
change is the separators inside the numbers, because before the fix the browser re-formatted them in
de-DE after hydration, and after the fix they stay in the en-US form the server sent:

| page | numbers rendered before (de-DE, Chrome) | numbers rendered after (en-US, Chrome) |
|---|---|---|
| /components/blocks/swap | 3.142, 1,245 | 3,142, 1.245 |
| /components/blocks/wallet-card | 12.480,32 | 12,480.32 |
| /components/motion/number | 48.321 (read off the screenshot) | 48,34x (read off the screenshot) |
| /components/motion/table | 10.000 | 10,000 |

So the wallet card reads "$12.480,32" before and "$12,480.32" after, and the number ticker groups
its thousands with a dot before and with a comma after. Nothing else on the pages moves.

One thing to keep in mind when comparing the two number-page screenshots: that ticker is live and
picks a new value every 2.5 seconds, so the digits themselves differ between the before and after
capture. Only the separator between them is the point. The table page also shows its row count as
"10.000" before and "10,000" after.

## Files

- README.md
- number-chrome-after-console.txt
- number-chrome-after.png
- number-chrome-before-console.txt
- number-chrome-before.png
- number-safari-after-console.txt
- number-safari-after.png
- number-safari-before-console.txt
- number-safari-before.png
- summary.json
- swap-chrome-after-console.txt
- swap-chrome-after.png
- swap-chrome-before-console.txt
- swap-chrome-before.png
- swap-safari-after-console.txt
- swap-safari-after.png
- swap-safari-before-console.txt
- swap-safari-before.png
- table-chrome-after-console.txt
- table-chrome-after.png
- table-chrome-before-console.txt
- table-chrome-before.png
- table-safari-after-console.txt
- table-safari-after.png
- table-safari-before-console.txt
- table-safari-before.png
- wallet-card-chrome-after-console.txt
- wallet-card-chrome-after.png
- wallet-card-chrome-before-console.txt
- wallet-card-chrome-before.png
- wallet-card-safari-after-console.txt
- wallet-card-safari-after.png
- wallet-card-safari-before-console.txt
- wallet-card-safari-before.png

Naming is `<page>-<browser>-<before|after>.png` for the screenshot and
`<page>-<browser>-<before|after>-console.txt` for the captured console output. Each console file
repeats the URL, the browser version, the locale actually in force, the capture method and the
messages themselves. `summary.json` holds the same counts and the first error text per page and
browser in machine-readable form.
