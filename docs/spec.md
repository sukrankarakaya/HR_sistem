# Ürün Spesifikasyonu — Personel Devam Takip ve İzin Yönetim Portalı

> **Durum:** Taslak v0.1 · **Tarih:** 2026-10-31
> Bu belge kod yazımından önce onaylanır. Kuraldaki her değişiklik önce burada güncellenir, sonra koda yansır.

---

## 1. Amaç ve Kapsam

Kağıt üzerinde tutulan giriş-çıkış ve izin takibini; telefondan kullanılan, kurulum gerektirmeyen bir PWA ile dijitalleştirmek.

**Temel ilke:** Sistem hiçbir giriş-çıkışı engellemez; ancak **doğrulanmamış hiçbir kayıt yönetici onayı olmadan resmi kayda geçmez.**

### 1.1 MVP (Faz 1) kapsamında
- Organizasyon / şirket / personel yönetimi, davetle hesap açma, şifreli giriş
- IP doğrulamalı giriş-çıkış, doğrulanmamış kayıt akışı, uzaktan çalışan kuralı
- Düzeltme talepleri ve tek ekranda yönetici onayı
- Yasal izin hak ediş motoru, devir (açılış) bakiyesi, izin talebi ve onayı
- Şirket bazında aylık puantaj Excel çıktısı (haftalık toplam saat dahil)
- KVKK aydınlatma metni onayı ve denetim kaydı (audit log)

### 1.2 MVP kapsamı dışında (Faz 2+)
- Push bildirimleri ve "Hâlâ mesaide misin?" kontrolü
- E-posta bildirimleri ve e-postadan onay
- Passkey ile cihaz bağlama
- Detaylı fazla mesai hesabı (zamlı ücret / serbest zaman), PDF çıktısı, ortak izin takvimi
- Self-servis şirket kaydı, abonelik/ödeme, mali müşavir paneli

---

## 2. Pilot Müşteri Profili

Tek patron, aynı binada iki ayrı şirket.

| | Saint de Lumière | Dermodies |
|---|---|---|
| Personel | 2 | 7 (1'i uzaktan) |
| Hafta içi | 08:30–18:00, 60 dk mola | 08:30–18:00, 60 dk mola |
| Cumartesi | Tatil | 08:30–16:00, 60 dk mola *(başlangıç saati teyit edilecek)* |
| Pazar | Tatil | Tatil |
| Net günlük | 8,5 saat | 8,5 saat (Cmt: 6,5 saat) |
| **Net haftalık** | **42,5 saat** | **49 saat** |
| İzin hesabında Cumartesi | İş günü değil | **İş günü** |

> ⚠️ **Dermodies haftalık 49 saat**, 4857 sy. İş Kanunu'ndaki 45 saatlik haftalık sınırı aşıyor. Haftada ~4 saat fazla çalışma oluşur. Sistem bunu raporda göstermeli; hukuki değerlendirme işverene/mali müşavire aittir.

---

## 3. Roller

| Rol | Yetkiler |
|---|---|
| **Personel** | Kendi giriş-çıkışı, kendi kayıtları, düzeltme talebi, izin talebi, kendi izin bakiyesi |
| **Yönetici (Patron)** | Organizasyondaki tüm şirketler: personel ekleme/çıkarma, onay/ret, raporlar, ofis ağı ayarları, çalışma takvimi |
| **Sistem Admini** *(Faz 3)* | SaaS seviyesi: organizasyon yönetimi. Personel verisine erişmez. |

- Pilotta tek yönetici (patron) vardır; tüm talepler ona düşer.
- **Yöneticinin kendi kayıtları** doğrulanmamışsa otomatik onaylanmaz; audit log'a "kendi kendine onay" olarak işaretlenir.

---

## 4. Veri Modeli (Kavramsal)

```
Organization (SaaS müşterisi / patron hesabı)
 └── Company (yasal işveren: Saint de Lumière, Dermodies)
      ├── WorkSchedule (haftanın günlerine göre başlangıç, bitiş, mola)
      ├── OfficeNetwork (izinli IP / CIDR listesi)
      └── Employee
           ├── AttendanceEvent (giriş/çıkış olayı — silinmez)
           ├── CorrectionRequest (düzeltme talebi)
           ├── LeaveRequest (izin talebi)
           └── LeaveLedgerEntry (izin defteri — bakiye bundan hesaplanır)

User (giriş yapan kişi; bir Employee ve/veya Organization yöneticisi)
Holiday (resmi tatiller; tam gün / yarım gün)
LeaveType (yıllık, ücretsiz, rapor, evlilik, ölüm, babalık ...)
ConsentRecord (KVKK aydınlatma metni onayı: kim, hangi sürüm, ne zaman)
AuditLog (her değişiklik: kim, ne, ne zaman, eski/yeni değer)
```

### 4.1 Önemli tasarım kararları
- **Çok kiracılı (multi-tenant) yapı ilk günden.** Her tabloda `organizationId` bulunur; tüm sorgular buna göre filtrelenir.
- **Personel tek bir şirkete bağlıdır.** Raporlar şirket bazında alınır.
- **AttendanceEvent değiştirilemez (append-only).** Düzeltme yeni bir olay olarak eklenir ve orijinali referans gösterir.
- **İzin bakiyesi saklanmaz, defterden hesaplanır.** Hak ediş, kullanım, devir ve manuel düzeltme birer `LeaveLedgerEntry` kaydıdır. Bakiye = kayıtların toplamı.
- **Tüm zamanlar UTC saklanır**, gösterim ve hesaplama `Europe/Istanbul` saat diliminde yapılır.

### 4.2 AttendanceEvent alanları
| Alan | Açıklama |
|---|---|
| `type` | `CLOCK_IN` / `CLOCK_OUT` |
| `occurredAt` | Olayın zamanı. Normal kayıtta **sunucu saati**; beyan kayıtta personelin girdiği saat |
| `recordedAt` | Kaydın sunucuya ulaştığı an (her zaman sunucu saati) |
| `method` | `OFFICE_NETWORK` / `MANUAL` / `REMOTE` / `CORRECTION` |
| `status` | `VERIFIED` / `PENDING` / `APPROVED` / `REJECTED` |
| `ipAddress` | İsteğin geldiği IP |
| `note` | Doğrulanmamış veya manuel kayıtta zorunlu açıklama |
| `supersedesId` | Düzeltme ise, düzelttiği kaydın kimliği |

---

## 5. İş Kuralları

### 5.1 Giriş-Çıkış
| # | Kural |
|---|---|
| G1 | İstek IP'si şirketin `OfficeNetwork` listesindeyse kayıt `VERIFIED` olarak anında resmi kayda geçer. |
| G2 | IP eşleşmezse kayıt **reddedilmez**; personelden açıklama istenir, kayıt `PENDING` olur ve yönetici onayına düşer. |
| G3 | `isRemote` işaretli personel `REMOTE` yöntemiyle kayıt yapar. Kişiye özel ayar: otomatik onay **veya** yönetici onayı. |
| G4 | Açık bir giriş varken ikinci giriş yapılamaz; giriş yokken çıkış yapılamaz (kullanıcıya "Düzeltme talebi oluştur" yönlendirmesi yapılır). |
| G5 | 60 saniye içindeki tekrar eden istekler yok sayılır (çift tıklama). |
| G6 | Sistem **asla** tahmini bir saatle kaydı otomatik kapatmaz. Gün sonunda açık kalan giriş "çıkış eksik" olarak işaretlenir. |
| G7 | IP güvenilir proxy başlığından okunur (`X-Forwarded-For` için yalnızca bilinen proxy). İstemcinin gönderdiği IP/saat bilgisine güvenilmez. |
| G8 | Yönetici "Şu an bağlı olduğum ağı ofis ağı olarak kaydet" diyerek IP ekleyebilir. Dinamik IP değişimleri için. |

### 5.2 Düzeltme Talebi
| # | Kural |
|---|---|
| D1 | Personel eksik/yanlış bir kayıt için doğru saati ve gerekçesini girer. |
| D2 | Onaylanana kadar orijinal kayıt (veya eksiklik) geçerli kalır; onayda yeni `CORRECTION` olayı eklenir. |
| D3 | Geleceğe yönelik düzeltme yapılamaz. Geriye dönük sınır: **içinde bulunulan ay + önceki ayın puantajı kapanana kadar** *(teyit edilecek)*. |
| D4 | Ret durumunda gerekçe zorunludur ve personele gösterilir. |

### 5.3 İzin Hak Ediş Motoru (4857 sy. Kanun md. 53–56)
| # | Kural |
|---|---|
| I1 | Hak ediş, işe giriş tarihinin **her yıldönümünde** topluca doğar. İlk yıl dolmadan yasal hak yoktur. |
| I2 | Tamamlanan hizmet yılı *n* için: **1 ≤ n ≤ 5 → 14 gün**, **5 < n < 15 → 20 gün**, **n ≥ 15 → 26 gün**. |
| I3 | Hak ediş tarihinde **18 yaş ve altı veya 50 yaş ve üstü** olanlara en az **20 gün** verilir. |
| I4 | İzin süresi, talep aralığındaki **şirketin çalışma günleri** sayılarak hesaplanır; hafta tatili ve resmi tatiller düşülür. (Dermodies'te Cumartesi düşülmez, Saint'te düşülür.) |
| I5 | Ramazan ve Kurban Bayramı arifeleri ile 28 Ekim **yarım gün** tatildir; bu günler izinde **0,5 gün** sayılır. |
| I6 | Bakiye yetersizse talep oluşturulamaz. *(Avans izin: kapalı, şirket ayarı olarak ileride açılabilir.)* |
| I7 | Yıllık izin dışındaki türler (ücretsiz, rapor, evlilik, ölüm, babalık) yıllık izin bakiyesinden **düşülmez**. |
| I8 | Pilot başlangıcında her personel için **açılış bakiyesi** (devir) manuel girilir ve defterde `OPENING_BALANCE` olarak görünür. |
| I9 | Onaylanmış izin iptal edilirse kullanılan günler defterde ters kayıtla iade edilir. |
| I10 | İşe giriş tarihi değişirse hak edişler yeniden hesaplanır; değişiklik audit log'a düşer. |

### 5.4 Puantaj Raporu
- Şirket ve ay seçilerek Excel alınır.
- Her personel için: gün gün giriş/çıkış, net çalışma (mola düşülmüş), izin/tatil işaretleri, eksik/beyan kayıt işaretleri.
- Haftalık toplam saat ve **45 saati aşan kısım** ayrı sütunda gösterilir.
- `PENDING` kayıtlar raporda ayrıca işaretlenir; resmi toplamlara dahil edilmez.

---

## 6. Uç Durumlar

- Giriş unutuldu, sadece çıkış yapılmaya çalışılıyor → G4
- Gece yarısını geçen çalışma (23:50 giriş) → kayıt giriş gününe aittir
- İzin talebi mevcut bir izinle çakışıyor → reddedilir
- İzin yıl sonunu veya yıldönümünü kesiyor → gün sayımı tek talepte yapılır; bakiye talep tarihindeki değere göre kontrol edilir
- İzin günlerine resmi tatil denk geliyor → I4
- Personel izinliyken giriş-çıkış yapıyor → kayıt alınır, yöneticiye uyarı gösterilir
- Modem IP'si değişti → G2 + G8
- Personel işten ayrıldı → hesap pasifleşir, veriler saklama süresi boyunca korunur
- Yönetici kendi talebini onaylıyor → bkz. Roller

---

## 7. Kabul Kriterleri (Örnekler)

```gherkin
Senaryo: Ofis ağından giriş
  Verilen  Saint personeli ofis IP'sinden bağlı
  Ne zaman "Giriş" butonuna basar
  O zaman  VERIFIED bir CLOCK_IN kaydı sunucu saatiyle oluşur

Senaryo: İnternet kesintisinde mobil veriden giriş
  Verilen  personelin IP'si ofis listesinde değil
  Ne zaman "Giriş" butonuna basar ve açıklama girer
  O zaman  PENDING kayıt oluşur ve yöneticinin onay listesine düşer

Senaryo: Dermodies'te Cumartesi içeren izin
  Verilen  Dermodies personeli, Pazartesi–Cumartesi (6 gün) izin ister, aralıkta tatil yok
  O zaman  bakiyeden 6 gün düşülür

Senaryo: Saint'te aynı aralık
  Verilen  Saint personeli aynı Pazartesi–Cumartesi aralığını ister
  O zaman  bakiyeden 5 gün düşülür

Senaryo: Yaş istisnası
  Verilen  3. yıldönümünde 51 yaşında olan personel
  O zaman  bu yıl için 20 gün hak ediş kaydı oluşur
```

---

## 8. KVKK

- Her şirket ayrı veri sorumlusudur; şirkete özel aydınlatma metni, ilk girişte okunup onaylanır (`ConsentRecord`).
- **Toplanmayan veri:** GPS/konum, sağlık teşhisi, rapor belgesi içeriği.
- **Toplanan veri:** ad-soyad, iş e-postası, işe giriş ve doğum tarihi (izin hesabı için), giriş-çıkış zamanları, IP adresi.
- Sunucu ve veritabanı AB bölgesinde (Frankfurt). Yurt dışı aktarım yükümlülükleri yayın öncesi hukuki teyitle netleştirilecek.
- İşten ayrılan personelin verisi yasal saklama süresi sonunda anonimleştirilir *(süre teyit edilecek)*.
- Tüm yönetici işlemleri audit log'a yazılır.

---

## 9. Açık Sorular

- [ ] İki şirket aynı modemi / aynı dış IP'yi mi kullanıyor? Ofisin sabit IP'si var mı?
- [ ] Dermodies Cumartesi başlangıç saati 08:30 mu?
- [ ] Uzaktan çalışan personelin çalışma saatleri ve onay kuralı (otomatik / onaylı)?
- [ ] Mevcut kağıt kayıtlar: işe giriş tarihleri ve bu yıl kullanılan izinler hazır mı?
- [ ] Geç kalma toleransı var mı (ör. 10 dk)?
- [ ] Düzeltme talebi için geriye dönük süre sınırı (D3)?
