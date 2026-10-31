/**
 * Bir yıldönümünde doğan yıllık ücretli izin gün sayısı (4857 sy. İş Kanunu md. 53).
 *
 * @param completedYears Yıldönümünde tamamlanan hizmet yılı
 * @param ageAtAnniversary Yıldönümü tarihindeki yaş
 * @see docs/spec.md 5.3 — I1, I2, I3
 */
export function annualLeaveDays(
  completedYears: number,
  ageAtAnniversary: number,
): number {
  assertNonNegativeInteger(completedYears, "completedYears");
  assertNonNegativeInteger(ageAtAnniversary, "ageAtAnniversary");

  // I1: ilk yıl dolmadan yasal hak yoktur
  if (completedYears < 1) return 0;

  // I2: 1–5 yıl (5 dahil) 14, 5'ten fazla 15'ten az 20, 15 ve üstü 26 gün
  const bySeniority =
    completedYears <= 5 ? 14 : completedYears < 15 ? 20 : 26;

  // I3: 18 yaş ve altı ile 50 yaş ve üstü en az 20 gün
  const isAgeException = ageAtAnniversary <= 18 || ageAtAnniversary >= 50;
  return isAgeException ? Math.max(bySeniority, 20) : bySeniority;
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} negatif olmayan bir tam sayı olmalı: ${value}`);
  }
}
