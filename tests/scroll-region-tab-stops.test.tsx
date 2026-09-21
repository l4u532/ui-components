import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";

import { AgentActivity } from "@/components/agents/agent-activity";
import { CodeBlock } from "@/components/agents/code-block";
import { MessageScroller } from "@/components/agents/message-scroller";
import { InstallCommand } from "@/components/app/docs/install-command";
import { InfiniteMasonry } from "@/components/motion/infinite-masonry";
import { PullToRefresh } from "@/components/motion/pull-to-refresh";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { Table, type TableColumn } from "@/components/motion/table";
import { ParallaxPreview } from "@/components/previews/motion/parallax.preview";
import { ScrollProgressPreview } from "@/components/previews/motion/scroll-progress.preview";
import { ScrollRevealPreview } from "@/components/previews/motion/scroll-reveal.preview";

/**
 * A box the browser lets the user scroll needs a tab stop, or a keyboard-only
 * user can never reach the content below the fold — axe reports it as
 * `scrollable-region-focusable`. axe itself needs layout to decide whether a
 * box overflows, which the test DOM has none of, so these tests assert the
 * markup axe would look at: the element that carries a scrolling `overflow`
 * utility carries `tabindex="0"` too.
 *
 * The token is matched whole rather than by prefix: `overflow-hidden`,
 * `overflow-clip` and `overflow-visible` share the prefix and scroll nothing,
 * and `[overflow-anchor:none]` is not an overflow utility at all.
 */
const SCROLLING_OVERFLOW = /(?:^|\s)overflow-(?:x-|y-)?(?:auto|scroll)(?:\s|$)/;

function scrollRegions(root: HTMLElement) {
  return [root, ...root.querySelectorAll<HTMLElement>("*")].filter((element) =>
    SCROLLING_OVERFLOW.test(element.getAttribute("class") ?? ""),
  );
}

function tabStopsOf(root: HTMLElement) {
  return scrollRegions(root).map((element) => element.getAttribute("tabindex"));
}

/**
 * AgentActivity caps its viewport against the measured content height, and the
 * test DOM measures every box at zero. Stubbing `offsetHeight` is what puts the
 * component in its capped state, the only one where the viewport scrolls.
 */
function withContentHeight<T>(height: number, run: () => T): T {
  const original = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetHeight",
  );
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get: () => height,
  });
  try {
    return run();
  } finally {
    if (original) {
      Object.defineProperty(HTMLElement.prototype, "offsetHeight", original);
    } else {
      // Restoring the prototype needs the property gone, not set to undefined.
      Reflect.deleteProperty(HTMLElement.prototype, "offsetHeight");
    }
  }
}

/**
 * The shared setup answers every media query as reduced motion, which is the
 * branch SmoothScroll renders a plain div from. Undoing it for one render is
 * what puts the Lenis wrapper — a different element, with the same gate — in
 * the tree.
 */
function withoutReducedMotion<T>(run: () => T): T {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList) as typeof window.matchMedia;
  try {
    return run();
  } finally {
    window.matchMedia = original;
  }
}

const CODE = Array.from({ length: 40 }, (_, i) => `const line${i} = ${i};`).join(
  "\n",
);

type Row = { id: string; name: string; role: string };

const ROWS: Row[] = [
  { id: "r1", name: "Ava Cole", role: "Owner" },
  { id: "r2", name: "Ben Diaz", role: "Editor" },
];

const COLUMNS: TableColumn<Row>[] = [
  { key: "name", header: "Name" },
  { key: "role", header: "Role" },
];

const MASONRY_ITEMS = Array.from({ length: 6 }, (_, i) => ({ id: `card-${i}` }));

const ACTIVITY_ITEMS = Array.from({ length: 8 }, (_, i) => ({
  id: `step-${i}`,
  type: "step" as const,
  label: `Step ${i + 1}`,
}));

/** A case may narrow the search to one region when the tree holds several. */
type Case = [
  name: string,
  render: () => ReactElement,
  scope?: (container: HTMLElement) => HTMLElement,
];

const cases: Case[] = [
  ["CodeBlock viewport", () => <CodeBlock code={CODE} filename="demo.ts" />],
  [
    "Table body",
    () => <Table data={ROWS} columns={COLUMNS} getRowId={(row) => row.id} />,
  ],
  [
    "InfiniteMasonry",
    () => (
      <InfiniteMasonry
        items={MASONRY_ITEMS}
        getItemKey={(item) => item.id}
        renderItem={(item) => <div>{item.id}</div>}
        onLoadMore={() => {}}
        hasMore={false}
        ariaLabel="Gallery"
      />
    ),
  ],
  [
    "PullToRefresh",
    () => (
      <PullToRefresh onRefresh={() => {}}>
        <p>Refreshable content.</p>
      </PullToRefresh>
    ),
  ],
  [
    "MessageScroller",
    () => (
      <MessageScroller>
        <p>A streamed answer.</p>
      </MessageScroller>
    ),
  ],
  ["Parallax preview", () => <ParallaxPreview />],
  ["ScrollReveal preview", () => <ScrollRevealPreview />],
  ["ScrollProgress preview", () => <ScrollProgressPreview />],
  [
    "docs install command",
    () => <InstallCommand slug="button" />,
    // The package-manager tab row above the command carries a scroller of its
    // own, which these commits leave alone; scope to the command line.
    (container) =>
      container.querySelector<HTMLElement>("[class~='font-mono']")
        ?.parentElement as HTMLElement,
  ],
];

afterEach(cleanup);

describe("scroll region tab stops", () => {
  for (const [name, renderCase, scope] of cases) {
    test(`${name} is reachable from the keyboard`, () => {
      const { container } = render(renderCase());
      const root = scope ? scope(container) : container;
      expect(root).toBeTruthy();
      const stops = tabStopsOf(root);

      expect(stops.length).toBeGreaterThan(0);
      expect(stops).toEqual(stops.map(() => "0"));
    });
  }
});

describe("AgentActivity viewport tab stop", () => {
  // The viewport stays mounted in every state and swaps `overflow-y-auto` for
  // `overflow-y-hidden`, so each case can assert on the same element rather
  // than on its absence.
  const viewportOf = (container: HTMLElement) => {
    const viewport = Array.from(
      container.querySelectorAll<HTMLElement>("*"),
    ).find((element) =>
      /(?:^|\s)overflow-y-(?:auto|hidden)(?:\s|$)/.test(
        element.getAttribute("class") ?? "",
      ),
    );
    if (!viewport) throw new Error("AgentActivity viewport not rendered");
    return viewport;
  };

  test("takes a tab stop once capped content is expanded", () => {
    const { container } = withContentHeight(320, () =>
      render(
        <AgentActivity
          status="complete"
          duration={4}
          defaultOpen
          items={ACTIVITY_ITEMS}
        />,
      ),
    );

    const viewport = viewportOf(container);
    expect(scrollRegions(container)).toEqual([viewport]);
    expect(viewport.getAttribute("tabindex")).toBe("0");
  });

  test("takes none while the content fits", () => {
    const { container } = render(
      <AgentActivity
        status="complete"
        duration={4}
        defaultOpen
        items={ACTIVITY_ITEMS}
      />,
    );

    expect(scrollRegions(container)).toEqual([]);
    expect(viewportOf(container).getAttribute("tabindex")).toBeNull();
  });

  test("takes none while collapsed", () => {
    const { container } = withContentHeight(320, () =>
      render(
        <AgentActivity status="complete" duration={4} items={ACTIVITY_ITEMS} />,
      ),
    );

    expect(scrollRegions(container)).toEqual([]);
    expect(viewportOf(container).getAttribute("tabindex")).toBeNull();
  });

  test("takes none while the agent is still working", () => {
    const { container } = withContentHeight(320, () =>
      render(<AgentActivity status="working" items={ACTIVITY_ITEMS} />),
    );

    expect(scrollRegions(container)).toEqual([]);
    expect(viewportOf(container).getAttribute("tabindex")).toBeNull();
  });
});

describe("SmoothScroll tab stop", () => {
  const contained = (
    <SmoothScroll root={false} className="h-64 overflow-y-auto">
      <p>Contained content.</p>
    </SmoothScroll>
  );
  const page = (
    <SmoothScroll>
      <p>Page content.</p>
    </SmoothScroll>
  );

  test("the contained reduced-motion scroller takes one", () => {
    const { container } = render(contained);

    expect(container.firstElementChild?.getAttribute("tabindex")).toBe("0");
  });

  test("the reduced-motion page root takes none", () => {
    const { container } = render(page);

    expect(container.firstElementChild?.getAttribute("tabindex")).toBeNull();
  });

  test("the contained Lenis scroller takes one", () => {
    const { container } = withoutReducedMotion(() => render(contained));

    expect(container.firstElementChild?.getAttribute("tabindex")).toBe("0");
  });

  test("the Lenis page root takes none", () => {
    const { container } = withoutReducedMotion(() => render(page));

    expect(container.firstElementChild?.getAttribute("tabindex")).toBeNull();
  });
});
