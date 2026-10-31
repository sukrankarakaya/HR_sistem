import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { wholeYearsBetween } from "./local-date";

// Kıdem yılı (I1, I2) ve yıldönümündeki yaş (I3) için kullanılır
describe("wholeYearsBetween", () => {
  it.each([
    ["2020-03-15", "2020-03-15", 0],
    ["2020-03-15", "2021-03-14", 0],
    ["2020-03-15", "2021-03-15", 1],
    ["2020-03-15", "2026-11-01", 6],
    ["1974-11-02", "2026-11-01", 51],
    ["1974-11-01", "2026-11-01", 52],
  ])("%s → %s: %i tam yıl", (from, to, expected) => {
    expect(wholeYearsBetween(from, to)).toBe(expected);
  });

  it("29 Şubat doğumlu/girişli kişinin yılı artık olmayan yılda 1 Mart'ta dolar", () => {
    expect(wholeYearsBetween("2024-02-29", "2025-02-28")).toBe(0);
    expect(wholeYearsBetween("2024-02-29", "2025-03-01")).toBe(1);
    expect(wholeYearsBetween("2024-02-29", "2028-02-29")).toBe(4);
  });

  it("bitiş başlangıçtan önceyse hata fırlatır", () => {
    expect(() => wholeYearsBetween("2026-11-01", "2026-10-31")).toThrow(
      RangeError,
    );
  });

  it("aynı ay/gün N yıl sonrası her zaman tam N yıldır", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1950, max: 2050 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 0, max: 60 }),
        (year, month, day, n) => {
          const md = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          return wholeYearsBetween(`${year}-${md}`, `${year + n}-${md}`) === n;
        },
      ),
    );
  });
});
