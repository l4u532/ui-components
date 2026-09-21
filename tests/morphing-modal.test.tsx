import { afterEach, describe, expect, mock, test } from "bun:test";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { MorphingModal } from "@/components/motion/morphing-modal";

afterEach(cleanup);

function TestModal({ onClose }: { onClose?: () => void } = {}) {
  const [view, setView] = useState<string | null>(null);

  return (
    <>
      <button type="button" onClick={() => setView("options")}>
        Open wallet options
      </button>
      <MorphingModal
        viewId={view}
        onClose={() => {
          setView(null);
          onClose?.();
        }}
        ariaLabel="Wallet options"
      >
        <p>Wallet options</p>
      </MorphingModal>
    </>
  );
}

// The panel takes focus from a rAF callback, so let one frame run.
async function frame() {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
}

describe("MorphingModal dialog semantics", () => {
  test("names the open panel as a modal dialog", async () => {
    const { getByRole, queryByRole } = render(<TestModal />);

    expect(queryByRole("dialog")).toBeNull();

    fireEvent.click(getByRole("button", { name: "Open wallet options" }));
    await frame();

    const dialog = getByRole("dialog", { name: "Wallet options" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  test("closes on Escape", async () => {
    const onClose = mock(() => {});
    const { getByRole, queryByRole } = render(<TestModal onClose={onClose} />);

    fireEvent.click(getByRole("button", { name: "Open wallet options" }));
    await frame();
    const dialog = getByRole("dialog");

    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    // The panel outlives the close by its exit animation, so it is the release
    // of the overlay — not its removal — that says the modal has closed.
    expect(dialog.style.pointerEvents).toBe("none");
    expect(queryByRole("button", { name: "Close modal" })?.style.pointerEvents)
      .toBe("none");
  });

  test("hands focus back to the trigger after close", async () => {
    const { getByRole } = render(<TestModal />);

    // No `.focus()` before the click: WebKit never focuses a clicked button,
    // so the trigger is not the active element when the modal opens.
    const trigger = getByRole("button", { name: "Open wallet options" });
    fireEvent.click(trigger);
    await frame();

    expect(document.activeElement).toBe(getByRole("dialog"));

    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });

    expect(document.activeElement).toBe(trigger);
  });
});
