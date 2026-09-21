import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, waitFor } from "@testing-library/react";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { NumberTicker } from "@/components/motion/number-ticker";
import { SWAP_LOCALE, formatAmount } from "@/components/motion/swap/utils";

afterEach(cleanup);

const VALUE = 1234567;
const EN_US = "1,234,567";
const DE_DE = "1.234.567";

/**
 * Run `body` as if the runtime's default locale were `tag`.
 *
 * The runner cannot be pushed off en-US from the outside: Bun resolves the
 * default ICU locale from the host, and `LANG=de_DE.UTF-8 bun test` still
 * reports `Intl.DateTimeFormat().resolvedOptions().locale === "en-US"`.
 * Replacing the global `Intl.NumberFormat` does not help either, because
 * `Number.prototype.toLocaleString` is native and never reads it. So the
 * substitution happens on `toLocaleString` itself: a call that omits a locale
 * — exactly the call whose result a de-DE browser and an en-US server
 * disagree on — is redirected to `tag`, while a call that names a locale is
 * passed through untouched. Something that still renders en-US grouping under
 * this patch is formatting with an explicit locale.
 *
 * The body may be async: `AnimatedNumber` reaches its value a frame after
 * mount, and the patch has to still be installed for that render.
 */
async function withDefaultLocale<T>(
  tag: string,
  body: () => T | Promise<T>,
): Promise<T> {
  const original = Number.prototype.toLocaleString;
  Number.prototype.toLocaleString = function patched(
    this: number,
    locales?: Intl.LocalesArgument,
    options?: Intl.NumberFormatOptions,
  ) {
    return original.call(this, locales ?? tag, options);
  };
  try {
    return await body();
  } finally {
    Number.prototype.toLocaleString = original;
  }
}

test("the default-locale patch really does change locale-less formatting", async () => {
  // Guards every test below: if the patch stopped biting they would pass
  // without proving anything.
  expect(await withDefaultLocale("de-DE", () => VALUE.toLocaleString())).toBe(
    DE_DE,
  );
  expect(
    await withDefaultLocale("de-DE", () => VALUE.toLocaleString("en-US")),
  ).toBe(EN_US);
  expect(VALUE.toLocaleString("en-US")).toBe(EN_US);
});

describe("AnimatedNumber", () => {
  test("groups in en-US even when the runtime default locale is de-DE", async () => {
    await withDefaultLocale("de-DE", async () => {
      const { container } = render(
        <AnimatedNumber value={VALUE} startOnView={false} duration={0} />,
      );
      await waitFor(() => expect(container.textContent).toBe(EN_US));
    });
  });

  test("honours an explicit locale", async () => {
    const { container } = render(
      <AnimatedNumber
        value={VALUE}
        locale="de-DE"
        startOnView={false}
        duration={0}
      />,
    );

    await waitFor(() => expect(container.textContent).toBe(DE_DE));
  });
});

describe("NumberTicker", () => {
  // The ticker renders its digits as roll columns; the formatted string is
  // only readable as text through the screen-reader copy.
  const readout = (container: HTMLElement) =>
    container.querySelector(".sr-only")?.textContent;

  test("locale groups in en-US when the runtime default locale is de-DE", async () => {
    await withDefaultLocale("de-DE", () => {
      const { container } = render(
        <NumberTicker value={VALUE} locale startOnView={false} />,
      );
      expect(readout(container)).toBe(EN_US);
    });
  });

  test("honours a BCP 47 tag", () => {
    const { container } = render(
      <NumberTicker value={VALUE} locale="de-DE" startOnView={false} />,
    );

    expect(readout(container)).toBe(DE_DE);
  });

  test("still omits separators without the locale prop", async () => {
    await withDefaultLocale("de-DE", () => {
      const { container } = render(
        <NumberTicker value={VALUE} startOnView={false} />,
      );
      expect(readout(container)).toBe("1234567");
    });
  });
});

describe("formatAmount", () => {
  test("pins the swap locale whatever the runtime default is", async () => {
    expect(SWAP_LOCALE).toBe("en-US");
    await withDefaultLocale("de-DE", () => {
      expect(formatAmount(1234567.891)).toBe("1,234,567.89");
      expect(formatAmount(0.1234567)).toBe("0.123457");
    });
  });

  test("takes an explicit locale override", () => {
    expect(formatAmount(1234567.891, 6, "de-DE")).toBe("1.234.567,89");
  });
});
