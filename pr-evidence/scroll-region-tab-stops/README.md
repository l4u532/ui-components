# Evidence: fix: give scroll regions a tab stop

## What was reproduced

Several containers in the library scroll their own content but are not focusable, so a keyboard user
cannot scroll them: the code block viewport, the table body, the masonry scroller, the pull-to-refresh
container, the agent activity viewport, the message scroller conversation, the three contained
scrollers in the scroll-animation demos, and the docs install command box that sits on every
component page. Two independent measurements were taken, one per browser.

In Chrome, axe-core reports these containers under the rule `scrollable-region-focusable`
("Ensure elements that have scrollable content are accessible by keyboard"). In Safari, a Tab walk
that starts inside the preview passes straight over them — the region never receives focus, so there
is no way to scroll it with the keyboard.

The pull request adds `tabIndex={0}` and a `focus-visible` inset ring to each of these containers.

## How it was captured

Two production builds were already running and were neither restarted nor rebuilt:

- BEFORE — upstream main, http://localhost:3300
- AFTER — the pull request branch `fix/scroll-region-tab-stops`, http://localhost:3304

Pages (identical paths on both origins):

- /components/agents/code-block
- /components/motion/table — also the page used for the docs install command box
- /components/blocks/infinite-masonry
- /components/motion/pull-to-refresh
- /components/agents/agent-activity
- /components/agents/message-scroller
- /components/motion/scroll-animation — holds the scroll-reveal, parallax and scroll-progress demos

**Chrome 153.0.8010.50**, driven by Playwright with the installed Chrome
(`chromium.launch({ channel: "chrome", headless: false })`), 1440x900. Each page is loaded and then
walked from top to bottom in 600 px steps with 700 ms per step, so every lazily mounted preview
renders and every streaming demo settles, and then scrolled back to the top. axe-core 4.13.0 from
the audit harness is injected and run over the whole document with the tags `wcag2a`, `wcag2aa`,
`wcag21a`, `wcag21aa` and `best-practice`. The capture records the node count and the target
selectors of `scrollable-region-focusable`, the scroll regions present in `main` with their
tabIndex, and the other rules that fire on the page (unchanged by this PR, listed for context).

**Safari 26.6.2** on macOS 26.6.2, driven by safaridriver over W3C WebDriver (port 4491), 1440x900,
one session at a time, with `document.visibilityState === "visible"` asserted at every page. For
each scroll region the preview root is scrolled so its top sits 96 px below the viewport top, its
top-left padding is clicked at `(root.left + 6, 102)` to set WebKit's focus-navigation starting
point, and Tab is then pressed eight times, reading `document.activeElement` after each press. A
step counts as a scroll region when the focused element carries an `overflow-auto` /
`overflow-scroll` class and is not a natively focusable control — a `<textarea>` scrolls its own
content too, but it was always a tab stop and is not what this PR is about, so the captures label it
separately.

Screenshots are browser page captures, one pair per region: the "after" shot is taken with the
region focused (Tab pressed exactly as far as the walk says the region sits), and the "before" shot
is the same viewport after the same number of Tab presses. No desktop captures were taken.

## Results — axe-core in Chrome

`scrollable-region-focusable` violating nodes per page:

| page | before | after |
|---|---|---|
| /components/agents/code-block | 1 | 0 |
| /components/motion/table | 1 | 0 |
| /components/blocks/infinite-masonry | 1 | 0 |
| /components/motion/pull-to-refresh | 0 | 0 |
| /components/agents/agent-activity | 0 | 0 |
| /components/agents/message-scroller | 1 | 0 |
| /components/motion/scroll-animation | 3 | 0 |
| **total** | **7** | **0** |

Every violation is gone after the change, and no new rule appears in its place: the other rules that
fire (`color-contrast`, `landmark-unique`, `region`) fire identically in both builds and belong to
the docs chrome, not to this PR.

## Results — Tab walk in Safari

Where the scroll region appears in the Tab sequence, starting from a click in the preview's top-left
padding:

| scroll region | before | after |
|---|---|---|
| Code block viewport | never reached in 8 tabs | Tab 2 |
| Table, data preview scroller | never reached in 8 tabs | Tab 1 |
| Table, async preview scroller (the one axe flags) | never reached in 8 tabs | Tab 1 |
| Infinite masonry scroller | never reached in 8 tabs | Tab 1 |
| Pull-to-refresh container | never reached in 8 tabs | Tab 1 |
| Agent activity page (see limitations) | never reached in 8 tabs | Tab 2 — the install command box |
| Message scroller conversation | never reached in 8 tabs | Tab 1 |
| Scroll progress demo scroller | never reached in 8 tabs | Tab 1 |
| Parallax demo scroller | never reached in 8 tabs | Tab 1 |
| Scroll reveal demo scroller | never reached in 8 tabs | Tab 1 |
| Docs install command box | never reached in 8 tabs | Tab 2 |

Before the change, eight Tab presses from inside the preview reach the copy button, the sponsor
links and the site header, and then start over — the region itself is never in the sequence. After
the change the region is the first or second stop, with `tabIndex=0`, and the focused element is the
one the PR touched (for example
`section[aria-label="Conversation"]`, `section[aria-label="Activity feed"]`,
`section[aria-label="Visual inspiration gallery"]`, the code viewport, and the `$ bunx …` line in
the install box).

## What the screenshots show

The pairs are the same viewport with the same number of Tab presses. The only difference is the
`focus-visible` inset ring the PR adds around the focused region; on the dark theme it is a thin,
low-contrast rim just inside the container's edge, so it is subtle in a still. The txt captures and
`summary.json` carry the element identity and tabIndex, which is the unambiguous evidence.

## Deviations from the expectation, and limitations

The expectation for this topic was 12 axe violations before the change and 0 after. The measurement
finds **7 before and 0 after**. Nothing regressed — the three sources of the missing five simply do
not produce a violation at this viewport, in either build:

- **Pull to refresh**: its container does not overflow at 1440x900, so there is no scrollable region
  for axe to flag in either build. The tab stop the PR adds is unconditional, so Safari does reach it
  after the change (Tab 1), which is what the walk shows.
- **Agent activity**: none of the six demos caps its viewport at this width, so the element stays
  `overflow-y-hidden`, and the tab stop the PR adds there is gated on `capped && expanded && !working`
  and never applies. No violation before, none after, and the only region Safari reaches on that page
  is the docs install command box. On this page the PR is effectively a no-op at 1440x900.
- **Docs install command box**: the install command fits inside the card at this width, so the box
  does not scroll and axe does not flag it. It does get its tab stop after the change, and the Safari
  walk picks it up on every page it appears on.

One more thing worth stating, because it explains the table page: that page has three scrollers, but
only one is flagged. The data preview's scroller contains 33 focusable descendants (sort buttons,
row inputs) and the axe rule deliberately exempts a scrollable region whose content is already
reachable by keyboard; the async preview's scroller has no focusable content and is flagged. Both
get a tab stop after the change, and the Safari walk covers both.

Finally, "never reached in 8 tabs" is a bounded statement: it means the region is not among the
first eight tab stops from the preview's top-left corner, not that it is unreachable in principle.
In practice the sequence loops back to the preview within those eight presses, so the region is not
in the cycle at all.

## Files

`<area>-chrome-<before|after>-axe.txt` is the axe capture for a page and build: the URL, the browser
version, the method, the violating nodes with their target selectors, the scroll regions present
with their tabIndex, and the other rules that fire. `<area>-safari-tabs.txt` is the Safari Tab walk
for one region, both builds side by side, step by step.
`<area>-safari-<before|after>.png` are the paired page captures. `summary.json` holds the axe counts
and targets per page and build, and the full tab sequences per region and build.

- README.md
- agent-activity-chrome-after-axe.txt
- agent-activity-chrome-before-axe.txt
- agent-activity-safari-after.png
- agent-activity-safari-before.png
- agent-activity-safari-tabs.txt
- code-block-chrome-after-axe.txt
- code-block-chrome-before-axe.txt
- code-block-safari-after.png
- code-block-safari-before.png
- code-block-safari-tabs.txt
- infinite-masonry-chrome-after-axe.txt
- infinite-masonry-chrome-before-axe.txt
- infinite-masonry-safari-after.png
- infinite-masonry-safari-before.png
- infinite-masonry-safari-tabs.txt
- install-command-safari-after.png
- install-command-safari-before.png
- install-command-safari-tabs.txt
- message-scroller-chrome-after-axe.txt
- message-scroller-chrome-before-axe.txt
- message-scroller-safari-after.png
- message-scroller-safari-before.png
- message-scroller-safari-tabs.txt
- parallax-safari-after.png
- parallax-safari-before.png
- parallax-safari-tabs.txt
- pull-to-refresh-chrome-after-axe.txt
- pull-to-refresh-chrome-before-axe.txt
- pull-to-refresh-safari-after.png
- pull-to-refresh-safari-before.png
- pull-to-refresh-safari-tabs.txt
- scroll-animation-chrome-after-axe.txt
- scroll-animation-chrome-before-axe.txt
- scroll-progress-safari-after.png
- scroll-progress-safari-before.png
- scroll-progress-safari-tabs.txt
- scroll-reveal-safari-after.png
- scroll-reveal-safari-before.png
- scroll-reveal-safari-tabs.txt
- summary.json
- table-async-safari-after.png
- table-async-safari-before.png
- table-async-safari-tabs.txt
- table-chrome-after-axe.txt
- table-chrome-before-axe.txt
- table-safari-after.png
- table-safari-before.png
- table-safari-tabs.txt
