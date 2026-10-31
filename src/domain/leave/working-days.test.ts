import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { countLeaveDays, type Holiday } from "./working-days";
import type { Weekday } from "@/domain/calendar/local-date";

// Pazartesi=1 … Cumartesi=6, Pazar=0
const SAINT: ReadonlySet<Weekday> = new Set([1, 2, 3, 4, 5]);
const DERMODIES: ReadonlySet<Weekday> = new Set([1, 2, 3, 4, 5, 6]);

const REPUBLIC_DAY_2026: Holiday[] = [
  { date: "2026-10-28", kind: "HALF" }, // arife
  { date: "2026-10-29", kind: "FULL" },
];

// spec.md 5.3 — I4 (çalışma günleri, tatiller) ve I5 (yarım gün tatiller)
describe("countLeaveDays", () => {
  describe("I4 — şirketin çalışma günleri", () => {
    it("Pazartesi–Cumartesi: Dermodies 6, Saint 5 gün (spec 7. bölüm)", () => {
      const range = { start: "2026-11-02", end: "2026-11-07" };
      expect(countLeaveDays(range, DERMODIES, [])).toBe(6);
      expect(countLeaveDays(range, SAINT, [])).toBe(5);
    });

    it("Pazar hiçbir şirkette düşülmez", () => {
      const range = { start: "2026-11-02", end: "2026-11-08" };
      expect(countLeaveDays(range, DERMODIES, [])).toBe(6);
      expect(countLeaveDays(range, SAINT, [])).toBe(5);
    });

    it("tek günlük talep: çalışılmayan gün 0, çalışma günü 1", () => {
      const saturday = { start: "2026-11-07", end: "2026-11-07" };
      expect(countLeaveDays(saturday, SAINT, [])).toBe(0);
      expect(countLeaveDays(saturday, DERMODIES, [])).toBe(1);
    });

    it("tam gün resmi tatil düşülür; yıl sonunu kesen aralık tek talepte sayılır", () => {
      const range = { start: "2026-12-28", end: "2027-01-02" };
      const newYear: Holiday[] = [{ date: "2027-01-01", kind: "FULL" }];
      expect(countLeaveDays(range, SAINT, newYear)).toBe(4);
      expect(countLeaveDays(range, DERMODIES, newYear)).toBe(5);
    });

    it("hafta tatiline denk gelen resmi tatil ayrıca düşülmez", () => {
      const range = { start: "2026-11-02", end: "2026-11-08" };
      const sundayHoliday: Holiday[] = [{ date: "2026-11-08", kind: "FULL" }];
      expect(countLeaveDays(range, SAINT, sundayHoliday)).toBe(5);
    });
  });

  describe("I5 — yarım gün tatiller (arife)", () => {
    it("28 Ekim arifesi 0,5; 29 Ekim 0 sayılır", () => {
      const range = { start: "2026-10-26", end: "2026-10-31" };
      expect(countLeaveDays(range, SAINT, REPUBLIC_DAY_2026)).toBe(3.5);
      expect(countLeaveDays(range, DERMODIES, REPUBLIC_DAY_2026)).toBe(4.5);
    });

    it("çalışılmayan güne denk gelen arife 0 sayılır", () => {
      const saturdayEve: Holiday[] = [{ date: "2026-11-07", kind: "HALF" }];
      const range = { start: "2026-11-07", end: "2026-11-07" };
      expect(countLeaveDays(range, SAINT, saturdayEve)).toBe(0);
      expect(countLeaveDays(range, DERMODIES, saturdayEve)).toBe(0.5);
    });
  });

  describe("geçersiz girdi", () => {
    it("bitiş başlangıçtan önceyse hata fırlatır", () => {
      expect(() =>
        countLeaveDays({ start: "2026-11-07", end: "2026-11-02" }, SAINT, []),
      ).toThrow(RangeError);
    });

    it.each(["2026-02-30", "2026-13-01", "02.11.2026", ""])(
      "geçersiz tarih (%s) için hata fırlatır",
      (bad) => {
        expect(() =>
          countLeaveDays({ start: bad, end: "2026-11-07" }, SAINT, []),
        ).toThrow(RangeError);
      },
    );
  });

  describe("özellikler", () => {
    const isoDate = fc
      .date({
        min: new Date("2020-01-01T00:00:00Z"),
        max: new Date("2030-12-31T00:00:00Z"),
        noInvalidDate: true,
      })
      .map((d) => d.toISOString().slice(0, 10));
    const range = fc
      .tuple(isoDate, isoDate)
      .map(([a, b]) => (a <= b ? { start: a, end: b } : { start: b, end: a }));

    it("sonuç takvim gün sayısını aşmaz ve 0,5'in katıdır", () => {
      fc.assert(
        fc.property(range, (r) => {
          const days = countLeaveDays(r, DERMODIES, REPUBLIC_DAY_2026);
          const calendarDays =
            (Date.parse(r.end) - Date.parse(r.start)) / 86_400_000 + 1;
          return days >= 0 && days <= calendarDays && (days * 2) % 1 === 0;
        }),
      );
    });

    it("Cumartesi çalışan şirkette sayım hiçbir zaman daha az olmaz", () => {
      fc.assert(
        fc.property(
          range,
          (r) =>
            countLeaveDays(r, DERMODIES, REPUBLIC_DAY_2026) >=
            countLeaveDays(r, SAINT, REPUBLIC_DAY_2026),
        ),
      );
    });
  });
});
