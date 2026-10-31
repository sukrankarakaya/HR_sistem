# Personel Devam Takip ve İzin Yönetim Portalı (PWA)

Küçük işletmeler için kağıtsız, donanımsız ve Türk İş Kanunu'na hazır devam takibi.

- **Ofis Wi-Fi ile giriş-çıkış:** Ek cihaz yok; telefondan tek dokunuş, IP ile doğrulama.
- **Kontrollü esneklik:** Tek dokunuş veya manuel kayıt, onay beklemeden; her değişiklik izli, yönetici geçmişi görür.
- **Şeffaf izin bakiyesi:** Kıdem baremleri, yaş istisnası, resmi tatiller ve şirketin çalışma günleri otomatik hesaplanır.
- **Tek panel, birden çok şirket:** Bir patron, birden fazla şirketin onaylarını ve puantajını tek yerden yönetir.
- **Ay sonu tek tık:** Şirket bazında Excel puantaj dökümü.

## Durum
🚧 Faz 0 — Spec ve proje iskeleti hazır; Faz 1 geliştirmesi başlıyor.

## Geliştirme
Gereksinimler: Node.js 22+, PostgreSQL ([Postgres.app](https://postgresapp.com) önerilir)

```bash
cp .env.example .env   # DATABASE_URL'i düzenleyin
npm install            # Prisma istemcisini de üretir
npm run db:migrate     # şemayı veritabanına uygular
npm run dev            # http://localhost:3000
npm test               # birim testler
npm run test:coverage  # src/domain için %90 kapsam şartı
npm run lint
npm run typecheck
```

İş kuralları `src/domain/` altında, framework'ten bağımsız saf TypeScript olarak yazılır ve her kural `docs/spec.md`'deki numarasıyla (ör. I2) testlerde referans alınır.

## Belgeler
- [Ürün spesifikasyonu](docs/spec.md)
- [Mimari karar kayıtları](docs/adr/)

## Yol Haritası
- **Faz 0:** Spec, mimari kararlar, CI iskeleti
- **Faz 1 (MVP):** Personel ve giriş, kurulum sihirbazı, giriş-çıkış (IP altyapısıyla), kayıt düzeltme, geç kalma, izin motoru, onay paneli, Excel puantaj
- **Faz 2:** Push bildirimleri, e-posta onayı, passkey cihaz bağlama, fazla mesai, PDF, izin takvimi
- **Faz 3:** Self-servis SaaS, abonelik, mali müşavir paneli
