// Türkiye ulusal resmi tatilleri (2394 sy. Kanun).
// Dini bayram tarihleri Diyanet İşleri Başkanlığı takviminden alınmıştır;
// her yıl eklenirken resmi kaynaktan yeniden doğrulanmalıdır.

type HolidayRow = { date: string; kind: "FULL" | "HALF"; name: string };

const FIXED: ReadonlyArray<[mmdd: string, kind: "FULL" | "HALF", name: string]> = [
  ["01-01", "FULL", "Yılbaşı"],
  ["04-23", "FULL", "Ulusal Egemenlik ve Çocuk Bayramı"],
  ["05-01", "FULL", "Emek ve Dayanışma Günü"],
  ["05-19", "FULL", "Atatürk'ü Anma, Gençlik ve Spor Bayramı"],
  ["07-15", "FULL", "Demokrasi ve Milli Birlik Günü"],
  ["08-30", "FULL", "Zafer Bayramı"],
  ["10-28", "HALF", "Cumhuriyet Bayramı arifesi"],
  ["10-29", "FULL", "Cumhuriyet Bayramı"],
];

const RELIGIOUS: Record<number, { ramadanEve: string; sacrificeEve: string }> = {
  // Ramazan: arife + 3 gün, Kurban: arife + 4 gün
  2026: { ramadanEve: "2026-03-19", sacrificeEve: "2026-05-26" },
  2027: { ramadanEve: "2027-03-08", sacrificeEve: "2027-05-15" },
};

function addDays(date: string, days: number): string {
  const ms = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

function feast(eve: string, dayCount: number, name: string): HolidayRow[] {
  return [
    { date: eve, kind: "HALF", name: `${name} arifesi` },
    ...Array.from({ length: dayCount }, (_, i) => ({
      date: addDays(eve, i + 1),
      kind: "FULL" as const,
      name: `${name} ${i + 1}. gün`,
    })),
  ];
}

/** Aynı güne denk gelen tatiller (ör. 19 Mayıs 2027) tek satırda birleştirilir. */
export function turkishHolidays(): HolidayRow[] {
  const rows = Object.entries(RELIGIOUS).flatMap(([year, r]) => [
    ...FIXED.map(([mmdd, kind, name]) => ({ date: `${year}-${mmdd}`, kind, name })),
    ...feast(r.ramadanEve, 3, "Ramazan Bayramı"),
    ...feast(r.sacrificeEve, 4, "Kurban Bayramı"),
  ]);

  const byDate = new Map<string, HolidayRow>();
  for (const row of rows) {
    const existing = byDate.get(row.date);
    byDate.set(
      row.date,
      existing
        ? {
            date: row.date,
            kind: existing.kind === "FULL" || row.kind === "FULL" ? "FULL" : "HALF",
            name: `${existing.name} / ${row.name}`,
          }
        : row,
    );
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
