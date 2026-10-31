import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { annualLeaveDays } from "./entitlement";

// spec.md 5.3 — I2 (kıdem baremleri) ve I3 (yaş istisnası)
describe("annualLeaveDays", () => {
  const ADULT_AGE = 30;

  describe("I2 — kıdem baremleri", () => {
    it.each([
      [0, 0],
      [1, 14],
      [3, 14],
      [5, 14],
      [6, 20],
      [10, 20],
      [14, 20],
      [15, 26],
      [30, 26],
    ])("%i tamamlanmış yıl → %i gün", (years, expected) => {
      expect(annualLeaveDays(years, ADULT_AGE)).toBe(expected);
    });
  });

  describe("I3 — yaş istisnası", () => {
    it.each([
      [1, 18, 20],
      [1, 17, 20],
      [1, 19, 14],
      [3, 49, 14],
      [3, 50, 20],
      [3, 51, 20],
      [10, 55, 20],
      [15, 60, 26],
    ])("%i yıl, %i yaş → %i gün", (years, age, expected) => {
      expect(annualLeaveDays(years, age)).toBe(expected);
    });

    it("ilk yıl dolmadan yaş istisnası hak doğurmaz", () => {
      expect(annualLeaveDays(0, 17)).toBe(0);
      expect(annualLeaveDays(0, 55)).toBe(0);
    });
  });

  describe("geçersiz girdi", () => {
    it.each([
      [-1, ADULT_AGE],
      [1.5, ADULT_AGE],
      [Number.NaN, ADULT_AGE],
      [1, -1],
      [1, 20.5],
    ])("(%d yıl, %d yaş) için hata fırlatır", (years, age) => {
      expect(() => annualLeaveDays(years, age)).toThrow(RangeError);
    });
  });

  describe("özellikler", () => {
    const years = fc.integer({ min: 0, max: 60 });
    const age = fc.integer({ min: 14, max: 80 });

    it("sonuç her zaman 0, 14, 20 veya 26'dır", () => {
      fc.assert(
        fc.property(years, age, (y, a) =>
          [0, 14, 20, 26].includes(annualLeaveDays(y, a)),
        ),
      );
    });

    it("aynı yaşta kıdem arttıkça hak azalmaz", () => {
      fc.assert(
        fc.property(years, age, (y, a) =>
          annualLeaveDays(y + 1, a) >= annualLeaveDays(y, a),
        ),
      );
    });

    it("1 yılı dolduran 18 yaş ve altı / 50 yaş ve üstü en az 20 gün alır", () => {
      const exceptionAge = fc.oneof(
        fc.integer({ min: 14, max: 18 }),
        fc.integer({ min: 50, max: 80 }),
      );
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 60 }), exceptionAge, (y, a) =>
          annualLeaveDays(y, a) >= 20,
        ),
      );
    });
  });
});
