import {
  fromEpochDay,
  toEpochDay,
  weekdayOf,
  type LocalDate,
  type Weekday,
} from "@/domain/calendar/local-date";

export type Holiday = {
  date: LocalDate;
  /** HALF: arifeler ve 28 Ekim gibi öğleden sonra başlayan tatiller */
  kind: "FULL" | "HALF";
};

export type DateRange = { start: LocalDate; end: LocalDate };

/**
 * Bir izin aralığının yıllık izin bakiyesinden düşülecek gün sayısı.
 * Aralık iki ucu dahil sayılır.
 *
 * @param workdays Şirketin çalıştığı haftanın günleri
 * @see docs/spec.md 5.3 — I4, I5
 */
export function countLeaveDays(
  range: DateRange,
  workdays: ReadonlySet<Weekday>,
  holidays: readonly Holiday[],
): number {
  const first = toEpochDay(range.start);
  const last = toEpochDay(range.end);
  if (last < first) {
    throw new RangeError(
      `Bitiş tarihi başlangıçtan önce olamaz: ${range.start} → ${range.end}`,
    );
  }

  const holidayByDate = new Map(holidays.map((h) => [h.date, h.kind]));

  let total = 0;
  for (let day = first; day <= last; day++) {
    // I4: hafta tatili düşülür
    if (!workdays.has(weekdayOf(day))) continue;

    const holiday = holidayByDate.get(fromEpochDay(day));
    // I4: tam gün resmi tatil düşülür; I5: yarım gün tatil 0,5 sayılır
    total += holiday === "FULL" ? 0 : holiday === "HALF" ? 0.5 : 1;
  }
  return total;
}
