# Evidence: fix: give the morphing modal dialog semantics, Escape and focus hand-back

## What was reproduced

The morphing modal renders a full-screen backdrop and a panel, but before this change the panel was
a plain `<div>`: no `role="dialog"`, no `aria-modal="true"`, no accessible name, no Escape handler
and no focus management. Three consequences, all reproduced in both browsers:

1. Assistive technology is never told a dialog opened — the panel is an unlabelled group of
   controls sitting over the page.
2. Escape does nothing. The modal can only be dismissed with the pointer, through the demo's own ✕
   control or the backdrop.
3. When it does close, `document.activeElement` is `<body>`: the close control unmounts with the
   panel, and nothing hands focus back to the button that opened it.

In Safari the third point is worse still: WebKit does not focus a button on click, so nothing is
focused even while the modal is open on the mouse path.

## How it was captured

Two production builds were already running and were neither restarted nor rebuilt:

- BEFORE — upstream main, http://localhost:3300/components/motion/morphing-modal
- AFTER — the pull request branch `fix/morphing-modal-dialog`,
  http://localhost:3302/components/motion/morphing-modal

Browsers: **Chrome 153.0.8010.50** driven by Playwright with the installed Chrome
(`chromium.launch({ channel: "chrome", headless: false })`), and **Safari 26.6.2** on macOS 26.6.2
driven by safaridriver over W3C WebDriver (port 4491). Both at a 1440x900 viewport. Only one Safari
session ran at a time and Safari reported `document.visibilityState === "visible"` throughout.

Each run starts from a fresh page load, scrolls the preview so its top sits 96 px below the viewport
top, clears focus, and then follows one of two paths. The trigger is the "Open wallet options"
button.

1. **Mouse** — a real click at the centre of the trigger, with no prior focus call.
2. **Keyboard** — focus the trigger with `window.__audit.focusAt(x, y, label)`, then press Enter.

While the modal is open the capture records whether any visible element carries both `role="dialog"`
and `aria-modal="true"`, that element's `aria-label`, every fixed layer that appeared, and
`document.activeElement`. Escape is then pressed and the page is polled every 100 ms for up to
1200 ms for the panel disappearing or going `pointer-events: none`. When Escape does nothing — every
"before" run — the modal is closed instead with the demo's own close control (`aria-label="Close"`),
and that is recorded as the closing method. Finally `document.activeElement` is read again.

Safari screenshots were taken on the mouse path in both builds: one with the modal open and one
after it closed.

## Results

Each cell is `mouse path / keyboard path`.

| measurement | Chrome before | Chrome after | Safari before | Safari after |
|---|---|---|---|---|
| `role="dialog"` + `aria-modal="true"` present | no / no | yes / yes | no / no | yes / yes |
| dialog `aria-label` | – | "Dialog" | – | "Dialog" |
| activeElement while open | trigger / trigger | the dialog panel / the dialog panel | BODY / trigger | the dialog panel / the dialog panel |
| Escape closes the modal | no / no | yes, within 100 ms / yes, within 100 ms | no / no | yes, within 100 ms / yes, within 100 ms |
| activeElement after close | BODY / BODY | trigger / trigger | BODY / BODY | trigger / trigger |

Reading it in words: before the fix there is no dialog to find, Escape is inert in both browsers and
on both paths, and the close always ends with focus on `<body>`. After the fix the panel is a
labelled modal dialog that takes focus itself while open, Escape closes it inside one polling step
(100 ms), and focus returns to the "Open wallet options" button — including the Safari mouse path,
where nothing was focused at open time at all, because the component remembers the control the last
activation landed on.

The layer list in the captures shows the same panel element before and after; what changes is the
attributes it carries. Before: `div "Options✕View Private Key…"`. After:
`div[role=dialog][aria-label="Dialog"] "Options✕View Private Key…"`.

## What the screenshots show

`morphing-modal-safari-before-open.png` and `morphing-modal-safari-after-open.png` are the same
modal over the same page: the visual design is untouched. `…-before-closed.png` and
`…-after-closed.png` are both the plain page after the modal went away. The difference this PR makes
is not visible in a still — it is in the attributes, the Escape key and where focus is — which is
why the txt captures and `summary.json` carry the evidence.

## Known limitations and caveats

- The accessible name after the fix is the component's default, "Dialog". The PR adds an `ariaLabel`
  prop but the demo on this page does not pass one, so that default is what the capture sees.
- The two builds are not closed the same way, and they cannot be: before the fix Escape is inert, so
  those runs close with the demo's ✕ control. That control unmounts along with the panel, which is
  part of why focus ends on `<body>` — but it is not the whole story, since clicking the backdrop
  before the fix leaves focus on `<body>` just the same, and after the fix the hand-back works no
  matter which of them is used.
- "Closed within 100 ms" is the resolution of the poll, not a measured animation time; it means the
  modal was already gone or non-interactive at the first check after the key.
- Screenshots are browser page captures only (WebDriver's screenshot endpoint); no desktop captures
  were taken.

## Files

`morphing-modal-<browser>-<before|after>.txt` is the full capture for that browser and build, both
paths, step by step. `morphing-modal-safari-<before|after>-<open|closed>.png` are the Safari page
captures on the mouse path. `summary.json` holds the same measurements per browser, build and path
in machine-readable form, including the layers seen while open and the element that held focus at
each stage.

- README.md
- morphing-modal-chrome-after.txt
- morphing-modal-chrome-before.txt
- morphing-modal-safari-after-closed.png
- morphing-modal-safari-after-open.png
- morphing-modal-safari-after.txt
- morphing-modal-safari-before-closed.png
- morphing-modal-safari-before-open.png
- morphing-modal-safari-before.txt
- summary.json
