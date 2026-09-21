# Evidence: fix: hand focus back when overlays close

## What was reproduced

Six overlays in the library take focus away from the page — or simply let it fall away — and never
hand it back when they close: the bottom sheet, the command palette, the select and morph select
panels, the attachment image preview and the swap token picker. When one of them closes, focus is
left on `<body>`, so the next Tab starts again at the top of the document instead of continuing from
the control that opened the overlay.

WebKit is the harsher case. Safari does not focus a button when it is clicked, so a mouse-opened
overlay has nothing to hand focus back to, and the page ends on `<body>` every time. In Chrome the
click does focus the trigger, so the overlays that leave focus alone (the bottom sheet, the plain
select) already recovered; the four that move focus into themselves — the command palette, the morph
select, the image preview and the token picker — stranded it on `<body>` in Chrome too, on both the
mouse and the keyboard path.

The pull request gives each overlay a capture-on-open / restore-on-close effect, and where the
trigger is owned by the library it also makes the trigger claim focus on click, so WebKit has
something to return to.

## How it was captured

Two production builds were already running and were neither restarted nor rebuilt:

- BEFORE — upstream main, http://localhost:3300
- AFTER — the pull request branch `fix/focus-return-on-close`, http://localhost:3301

Overlays and pages (identical paths on both origins):

| overlay | page | trigger |
|---|---|---|
| Bottom sheet | /components/motion/bottom-sheet | "Open bottom sheet" |
| Command palette | /components/blocks/command-palette | "Open command palette" |
| Select | /components/motion/select (`#default-preview`) | the select trigger, "Next.js" |
| Morph select | /components/motion/select (`#morph-preview`) | the morph select trigger, "Next.js" |
| Attachment image preview | /components/blocks/file-upload (`#attachment-upload-preview`) | the thumbnail, aria-label "Preview orange-flowers.jpg" |
| Swap token picker | /components/blocks/swap | the token chip "ETH" |

Browsers: **Chrome 153.0.8010.50** driven by Playwright with the installed Chrome
(`chromium.launch({ channel: "chrome", headless: false })`), and **Safari 26.6.2** on macOS 26.6.2
driven by safaridriver over W3C WebDriver (port 4491). Both at a 1440x900 viewport. Only one Safari
session ran at a time, and Safari confirmed `document.visibilityState === "visible"` at every step.

Each measurement starts from a fresh page load. The preview is scrolled so its top sits 96 px below
the viewport top, any focus is cleared, and the trigger is located inside that preview root. Then
one of two paths runs:

1. **Mouse** — a real click at the centre of the trigger, with no prior focus call of any kind.
   Wait 900 ms for the overlay, press Escape, wait 1000 ms for the exit, then read
   `document.activeElement` through `window.__audit.focus()` and record its tag, id, aria-label and
   text.
2. **Keyboard** — focus the trigger with `window.__audit.focusAt(x, y, label)`, press Enter, wait,
   press Escape, wait, read the same.

"Returned to the trigger" is decided by identity, not by looks: the trigger is marked before the
run, and the element that holds focus afterwards has to be that same element (by marker, by id, or
by an identical description).

In Safari, one page screenshot was taken after the close on the mouse path for every overlay and
every build. The focus ring is a `:focus-visible` ring, so it is deliberately not painted after a
mouse interaction — the screenshots show the page state, the txt captures are the evidence.

## Results

Each cell is `mouse path / keyboard path`: where `document.activeElement` ended up after the overlay
closed. "trigger" means focus came back to the control that opened it, "BODY" means focus was lost
to `<body>`.

| overlay | Chrome before (mouse / keyboard) | Chrome after | Safari before | Safari after |
|---|---|---|---|---|
| Bottom sheet | trigger / trigger | trigger / trigger | BODY / trigger | BODY / trigger |
| Command palette | BODY / BODY | trigger / trigger | BODY / BODY | BODY / trigger |
| Select | trigger / trigger | trigger / trigger | BODY / trigger | trigger / trigger |
| Morph select | BODY / BODY | trigger / trigger | BODY / BODY | trigger / trigger |
| Attachment image preview | BODY / BODY | trigger / trigger | BODY / BODY | trigger / trigger |
| Swap token picker | BODY / BODY | trigger / trigger | BODY / BODY | trigger / trigger |

In every run the overlay did open and Escape did close it, in both browsers and both builds; the
only thing that differs is where focus lands afterwards.

A few details worth reading off the captures:

- The bottom sheet and the plain select never moved focus before the fix, which is why their Chrome
  runs and their Safari keyboard runs already ended on the trigger: focus had simply never left it.
  In Safari on the mouse path nothing was focused to begin with, so the close had nothing to
  restore.
- The command palette, the morph select, the image preview and the token picker all move focus into
  themselves on open (the palette and the picker focus their search field, the morph select focuses
  an option). Before the fix that focus was dropped when the overlay unmounted, which is the
  `BODY / BODY` in both browsers.
- After the fix, four of the six overlays return focus to the trigger on both paths in both
  browsers.

## Known limitation

The bottom-sheet and command-palette demos open from plain consumer-owned `onClick` triggers — the
demo, not the library, owns the button, and the component never sees it. WebKit leaves a clicked
button unfocused, so when those overlays open there is nothing focused for them to capture and
nothing to hand back to. Both therefore still end on `<body>` on the **mouse path in Safari** after
the fix, exactly as the table shows. Their keyboard path does return to the trigger, which is the
path that matters for keyboard users, and the four overlays whose triggers the library owns
(select, morph select, image thumbnail, token chip) return on both paths because the fix also makes
those triggers claim focus on click.

Also worth stating plainly: Chrome focuses a button on click, so the Chrome "before" column
understates the defect. Safari's mouse column is the one that shows it in full.

## Files

Naming is `<overlay>-<browser>-<before|after>.txt` for the capture and
`<overlay>-safari-<before|after>.png` for the Safari screenshot taken after the close on the mouse
path. Each capture repeats the URL, the browser version, the trigger, both paths step by step, and
the element that held focus at each stage. `summary.json` holds the same data per overlay, browser
and build in machine-readable form, including the overlay descriptions and whether Escape closed
the overlay.

- README.md
- attachment-preview-chrome-after.txt
- attachment-preview-chrome-before.txt
- attachment-preview-safari-after.png
- attachment-preview-safari-after.txt
- attachment-preview-safari-before.png
- attachment-preview-safari-before.txt
- bottom-sheet-chrome-after.txt
- bottom-sheet-chrome-before.txt
- bottom-sheet-safari-after.png
- bottom-sheet-safari-after.txt
- bottom-sheet-safari-before.png
- bottom-sheet-safari-before.txt
- command-palette-chrome-after.txt
- command-palette-chrome-before.txt
- command-palette-safari-after.png
- command-palette-safari-after.txt
- command-palette-safari-before.png
- command-palette-safari-before.txt
- select-chrome-after.txt
- select-chrome-before.txt
- select-morph-chrome-after.txt
- select-morph-chrome-before.txt
- select-morph-safari-after.png
- select-morph-safari-after.txt
- select-morph-safari-before.png
- select-morph-safari-before.txt
- select-safari-after.png
- select-safari-after.txt
- select-safari-before.png
- select-safari-before.txt
- summary.json
- swap-token-picker-chrome-after.txt
- swap-token-picker-chrome-before.txt
- swap-token-picker-safari-after.png
- swap-token-picker-safari-after.txt
- swap-token-picker-safari-before.png
- swap-token-picker-safari-before.txt
