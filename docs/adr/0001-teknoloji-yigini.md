# ADR 0001 — Teknoloji Yığını

- **Durum:** Önerildi
- **Tarih:** 2026-10-31

## Bağlam
Küçük işletmeler için telefondan kullanılan, kurulum gerektirmeyen, ileride çok kiracılı SaaS'a dönüşecek bir devam takip sistemi. Tek geliştirici, test güdümlü ilerleme, KVKK hassasiyeti.

## Karar

| Alan | Seçim | Gerekçe |
|---|---|---|
| Çatı | Next.js (App Router) + TypeScript | Ön yüz ve API tek kod tabanında |
| Veritabanı | PostgreSQL (lokalde Docker, canlıda Neon – Frankfurt) | Eşzamanlı yazma, serverless uyumu, çok kiracılı yapı |
| ORM | Prisma | Tip güvenli şema ve migration |
| Kimlik | Better Auth | Şifre + ileride passkey desteği, veri kendi veritabanımızda |
| Doğrulama | Zod | İstemci ve sunucuda ortak şema |
| Arayüz | Tailwind CSS + shadcn/ui | Hızlı, erişilebilir, mobil öncelikli |
| PWA | Serwist | `next-pwa` bakımsız |
| Tarih/saat | date-fns + date-fns-tz | `Europe/Istanbul` hesapları |
| Excel | exceljs | Puantaj çıktısı |
| Test | Vitest (birim), fast-check (izin motoru), Playwright (uçtan uca) | |
| CI | GitHub Actions: lint, typecheck, test | Testten geçmeyen kod birleştirilmez |
| Barındırma | Vercel (fra1) | Ön izleme ortamları; telefondan gerçek IP testi |

## Mimari ilke
İş kuralları (`src/domain/`) Next.js, Prisma ve tarayıcıdan bağımsız saf TypeScript fonksiyonlarıdır. Böylece birim testlerle kilitlenebilir ve framework değişse bile korunur.

## Sonuçlar
- SQLite kullanılmaz; lokal geliştirme için Docker gerekir.
- Kimlik verisi üçüncü taraf bir servise (Clerk vb.) gitmez — KVKK açısından daha sade.
