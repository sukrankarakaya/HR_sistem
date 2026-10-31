/**
 * Saat dilimi içermeyen takvim günü, "YYYY-MM-DD" biçiminde.
 * İzin ve tatil hesapları gün bazındadır; saat dilimi kaymalarını önlemek için
 * Date nesnesi yerine bu biçim kullanılır.
 */
export type LocalDate = string;

/** 0 = Pazar, 1 = Pazartesi, … 6 = Cumartesi (Date.getUTCDay ile aynı) */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** Geçerli bir LocalDate'i UTC gece yarısı zaman damgasına çevirir. */
export function toEpochDay(date: LocalDate): number {
  const ms = LOCAL_DATE_PATTERN.test(date) ? Date.parse(`${date}T00:00:00Z`) : NaN;
  // Date.parse "2026-02-30" gibi taşan günleri kabul eder; geri çevirerek doğrularız
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== date) {
    throw new RangeError(`Geçersiz tarih: "${date}" (beklenen YYYY-MM-DD)`);
  }
  return ms / DAY_MS;
}

export function fromEpochDay(epochDay: number): LocalDate {
  return new Date(epochDay * DAY_MS).toISOString().slice(0, 10);
}

export function weekdayOf(epochDay: number): Weekday {
  return new Date(epochDay * DAY_MS).getUTCDay() as Weekday;
}
