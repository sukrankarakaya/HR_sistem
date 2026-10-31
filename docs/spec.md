# Ürün Spesifikasyonu — Personel Devam Takip ve İzin Yönetim Portalı

> **Durum:** Taslak v0.3 · **Tarih:** 2026-11-01
> Bu belge kod yazımından önce onaylanır. Kuraldaki her değişiklik önce burada güncellenir, sonra koda yansır.

---

## 1. Amaç ve Kapsam

Kağıt üzerinde tutulan giriş-çıkış ve izin takibini; telefondan kullanılan, kurulum gerektirmeyen bir PWA ile dijitalleştirmek.

**Temel ilke:** Giriş-çıkış kayıtları **onay beklemeden** işlenir ve hiçbir kayıt iz bırakmadan değişmez. Her kaydın nasıl yapıldığı (buton, manuel, düzeltme) işaretlenir; yönetici değişiklik geçmişini her zaman görür. **Yönetici onayı yalnızca izin talepleri ve tanımlı istisnalar için istenir** (bkz. 5.2).

### 1.1 MVP (Faz 1) kapsamında
- Organizasyon / şirket / personel yönetimi, davetle hesap açma, şifreli giriş
- Şirket kurulum sihirbazı: çalışma takvimi ve şirket kuralları ilk girişte belirlenir, sonradan değiştirilebilir
- Başlangıç verisi aktarımı (açılış izin bakiyesi) ve kurgusal demo verisi
- Giriş-çıkış: tek dokunuşla (otomatik saat) veya manuel saat girişiyle; uzaktan çalışan desteği
- IP doğrulama altyapısı: veri modeli ve kontrol hazır, ofis ağı tanımlanana kadar pasif
- Onaysız kayıt düzeltme (değişiklik geçmişiyle), istisnalar için onay akışı
- Geç kalma takibi ve ay kapanışı
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

Tek patron, aynı binada iki ayrı şirket, **tek ortak modem (aynı dış IP)**.

Aşağıdaki değerler pilotun başlangıç ayarlarıdır; koda gömülmez, kurulum sihirbazında girilir ve değiştirilebilir (bkz. 5.5).

| | Saint de Lumière | Dermodies |
|---|---|---|
| Personel | 2 | 7 (1'i uzaktan) |
| Hafta içi | 08:30–18:00, 60 dk mola | 08:30–18:00, 60 dk mola |
| Cumartesi | Tatil | 08:30–16:00, 60 dk mola |
| Geç kalma toleransı | 15 dk | 15 dk |
| Uzaktan çalışan | — | 1 kişi, şirketin takvimiyle aynı |
| Pazar | Tatil | Tatil |
| Net günlük | 8,5 saat | 8,5 saat (Cmt: 6,5 saat) |
| **Net haftalık** | **42,5 saat** | **49 saat** |
| İzin hesabında Cumartesi | İş günü değil | **İş günü** |

> ⚠️ **Dermodies haftalık 49 saat**, 4857 sy. İş Kanunu'ndaki 45 saatlik haftalık sınırı aşıyor. Haftada ~4 saat fazla çalışma oluşur. Sistem bunu raporda göstermeli; hukuki değerlendirme işverene/mali müşavire aittir.

---

## 3. Roller

| Rol | Yetkiler |
|---|---|
| **Personel** | Kendi giriş-çıkışı, kendi kayıtlarını düzeltme, izin talebi, kendi izin bakiyesi |
| **Yönetici (Patron)** | Organizasyondaki tüm şirketler: personel ekleme/çıkarma, onay/ret, raporlar, ofis ağı ayarları, çalışma takvimi |
| **Sistem Admini** *(Faz 3)* | SaaS seviyesi: organizasyon yönetimi. Personel verisine erişmez. |

- Pilotta tek yönetici (patron) vardır; tüm talepler ona düşer.
- **Yöneticinin kendi izin talepleri** kendisi tarafından onaylanır ve audit log'a "kendi kendine onay" olarak işaretlenir.

---

## 4. Veri Modeli (Kavramsal)

```
Organization (SaaS müşterisi / patron hesabı)
 ├── OfficeNetwork (izinli IP / CIDR listesi — birden çok şirket paylaşabilir)
 └── Company (yasal işveren: Saint de Lumière, Dermodies)
      ├── CompanySettings (tolerans, düzeltme süresi, avans izin, uzaktan onay varsayılanı ...)
      ├── WorkSchedule (geçerlilik başlangıcı + haftanın günlerine göre başlangıç, bitiş, mola)
      ├── CompanyNetwork (şirketin kullandığı ofis ağları)
      ├── PeriodClose (kapanmış aylar: kim, ne zaman kapattı)
      └── Employee
           ├── AttendanceEvent (giriş/çıkış ve düzeltme olayları — silinmez)
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
- **Ofis ağı organizasyon seviyesindedir.** Aynı modemi kullanan şirketler aynı ağ kaydını paylaşır; IP değiştiğinde tek yerden güncellenir.
- **Çalışma takvimi sürümlüdür.** Takvim değiştiğinde yeni bir `WorkSchedule` kaydı `validFrom` tarihiyle eklenir; geçmiş günler kendi tarihlerindeki takvimle hesaplanır.
- **AttendanceEvent değiştirilemez (append-only).** Düzeltme yeni bir olay olarak eklenir ve orijinali referans gösterir.
- **İzin bakiyesi saklanmaz, defterden hesaplanır.** Hak ediş, kullanım, devir ve manuel düzeltme birer `LeaveLedgerEntry` kaydıdır. Bakiye = kayıtların toplamı.
- **Tüm zamanlar UTC saklanır**, gösterim ve hesaplama `Europe/Istanbul` saat diliminde yapılır.

### 4.2 AttendanceEvent alanları
| Alan | Açıklama |
|---|---|
| `type` | `CLOCK_IN` / `CLOCK_OUT` |
| `occurredAt` | Olayın zamanı. Buton kaydında **sunucu saati**; manuel kayıt ve düzeltmede personelin girdiği saat |
| `recordedAt` | Kaydın sunucuya ulaştığı an (her zaman sunucu saati) |
| `method` | `BUTTON` (tek dokunuş) / `MANUAL` (saat elle girildi) / `CORRECTION` (mevcut kaydı düzeltir) |
| `networkCheck` | `MATCHED` / `NOT_MATCHED` / `DISABLED` (ofis ağı tanımlı değil veya uzaktan çalışan) |
| `status` | `ACTIVE` (geçerli) / `PENDING` (istisna, onay bekliyor) / `REJECTED` / `SUPERSEDED` (düzeltildi) |
| `ipAddress` | İsteğin geldiği IP (kontrol pasif olsa da saklanır) |
| `note` | Açıklama; düzeltmede zorunlu |
| `supersedesId` | Düzeltme ise, düzelttiği kaydın kimliği |

---

## 5. İş Kuralları

### 5.1 Giriş-Çıkış
| # | Kural |
|---|---|
| G1 | Personel "Giriş" / "Çıkış" butonuyla tek dokunuşla kayıt yapar (`BUTTON`). Saat sunucudan alınır; kayıt anında `ACTIVE` olur. |
| G2 | Personel saati kendisi girerek **manuel kayıt** da yapabilir (`MANUAL`); açıklama isteğe bağlıdır. Kayıt anında `ACTIVE` olur, raporda "manuel" işaretiyle görünür. |
| G3 | **IP doğrulama altyapısı:** her kayıtta IP saklanır. Personelin şirketine ofis ağı atanmamışsa `networkCheck = DISABLED`. Ağ atandığında eşleşme `MATCHED` / `NOT_MATCHED` olarak işaretlenir; `NOT_MATCHED` kayıtlar varsayılan olarak **yalnızca işaretlenir**, şirket ayarıyla onaya düşürülebilir (bkz. D4). |
| G3a | Uzaktan çalışan (`isRemote`) şirketin takvimini kullanır, buton ve manuel kayıt yapabilir; ağ kontrolü uygulanmaz (`DISABLED`). |
| G4 | Açık bir giriş varken ikinci giriş yapılamaz; giriş yokken çıkış yapılamaz (kullanıcı manuel giriş eklemeye yönlendirilir). |
| G5 | 60 saniye içindeki tekrar eden istekler yok sayılır (çift tıklama). |
| G6 | Sistem **asla** tahmini bir saatle kaydı otomatik kapatmaz. Gün sonunda açık kalan giriş "çıkış eksik" olarak işaretlenir; personel düzeltme ile tamamlar. |
| G7 | IP güvenilir proxy başlığından okunur (`X-Forwarded-For` için yalnızca bilinen proxy). İstemcinin gönderdiği IP/saat bilgisine güvenilmez. |
| G8 | Yönetici "Şu an bağlı olduğum ağı ofis ağı olarak kaydet" diyerek IP ekleyebilir. Dinamik IP değişimleri için. |

### 5.2 Kayıt Düzeltme ve Onay İstisnaları
| # | Kural |
|---|---|
| D1 | Personel kendi kayıtlarını **onay beklemeden** düzeltebilir (eksik çıkışı tamamlama, saati değiştirme). Gerekçe zorunludur. |
| D2 | Orijinal kayıt silinmez: düzeltme yeni bir `CORRECTION` kaydı olarak eklenir, eskisi `SUPERSEDED` olur. Yönetici her kaydın değişiklik geçmişini görür. |
| D3 | Yönetici, ay kapanmadan önce bir düzeltmeyi sonradan reddedebilir; ret gerekçesi zorunludur ve kayıt önceki değerine döner. |
| D4 | **Onaya düşen istisnalar** (`PENDING`): (a) **düzeltme penceresinden** (şirket ayarı, varsayılan 7 gün) daha eski bir güne ait kayıt veya düzeltme, (b) **kapanmış bir ayın** kaydına dokunan her değişiklik, (c) şirket ayarı açıksa `NOT_MATCHED` ağ kontrolü sonucu. |
| D5 | Geleceğe yönelik kayıt veya düzeltme yapılamaz. |

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
| I8 | Sisteme geçişten önceki dönem için tek bir **açılış bakiyesi** kaydı (`OPENING_BALANCE`) kullanılır; bkz. B2. |
| I9 | Onaylanmış izin iptal edilirse kullanılan günler defterde ters kayıtla iade edilir. |
| I10 | İşe giriş tarihi değişirse hak edişler yeniden hesaplanır; değişiklik audit log'a düşer. |

### 5.4 Puantaj Raporu
- Şirket ve ay seçilerek Excel alınır.
- Her personel için: gün gün giriş/çıkış, net çalışma (mola düşülmüş), izin/tatil işaretleri, geç kalma, eksik çıkış işaretleri.
- Haftalık toplam saat ve **45 saati aşan kısım** ayrı sütunda gösterilir.
- Manuel ve düzeltilmiş kayıtlar işaretli görünür; `PENDING` kayıtlar resmi toplamlara dahil edilmez.

### 5.4.1 Geç Kalma
| # | Kural |
|---|---|
| L1 | Günün ilk girişi, takvimdeki başlangıç saati + **tolerans** (şirket ayarı, pilot: 15 dk) **dahil** ise geç sayılmaz. Örn. 08:30 başlangıçta 08:45:00 zamanında, 08:45:01 geçtir. |
| L2 | Geç kalma süresi başlangıç saatinden itibaren hesaplanır (08:50 giriş → 20 dk geç). |
| L3 | İzinli veya resmi tatil olan günde geç kalma hesaplanmaz. |
| L4 | Geç kalma yalnızca raporlanır; onay veya ceza akışı tetiklemez. |

### 5.4.2 Ay Kapanışı
| # | Kural |
|---|---|
| P1 | Yönetici bir şirketin ayını "kapatır"; kapanıştan sonra o aya ait her değişiklik onaya düşer (D4-b). |
| P2 | Kapanmamış bir ay için de Excel alınabilir; dosyada "taslak" ibaresi bulunur. |
| P3 | Yönetici kapanmış bir ayı gerekçe girerek yeniden açabilir; işlem audit log'a yazılır. |

### 5.5 Şirket Kurulum Sihirbazı
| # | Kural |
|---|---|
| K1 | Yöneticinin ilk girişinde organizasyon oluşturulur ve sihirbaz başlar. Sonradan "Yeni şirket ekle" ile aynı sihirbaz açılır. |
| K2 | **Adım 1 – Şirket bilgileri:** unvan, adres, KVKK veri sorumlusu iletişim bilgisi. |
| K3 | **Adım 2 – Çalışma takvimi:** haftanın her günü için çalışılıyor mu, başlangıç, bitiş ve mola süresi. Hazır şablonlar: "Hafta içi 08:30–18:00", "Hafta içi + Cumartesi". Net günlük/haftalık saat anlık gösterilir; haftalık 45 saati aşarsa uyarı çıkar. |
| K4 | **Adım 3 – Kurallar** (önerilen varsayılanlarla gelir): geç kalma toleransı (**15 dk**), düzeltme penceresi (**7 gün**), ağ dışı kayıt onaya düşsün mü (**hayır**), manuel kayıtta açıklama zorunlu mu (**hayır**), avans izin (**kapalı**), mesai sonu hatırlatma gecikmesi (Faz 2; **15 dk**). |
| K5 | **Adım 4 – Ofis ağı (isteğe bağlı, atlanabilir):** "Şu an bağlı olduğum ağı ekle" veya organizasyonda kayıtlı bir ağı seç. Atlanırsa ağ kontrolü pasif kalır ve sonradan ayarlardan açılır. |
| K6 | **Adım 5 – Aydınlatma metni:** şablon, şirket bilgileriyle doldurulur; yönetici gözden geçirip yayınlar. |
| K7 | **Adım 6 – Personel:** tek tek veya toplu (CSV) ekleme ve davet gönderme. |
| K8 | İkinci şirket kurulurken mevcut bir şirketin ayarları kopyalanabilir. |
| K9 | Ayar değişiklikleri geçmişe etki etmez; değişiklik tarihinden itibaren geçerlidir ve audit log'a yazılır. |

### 5.6 Başlangıç Verisi ve Demo Verisi
| # | Kural |
|---|---|
| B1 | Her personel için **işe giriş tarihi** ve **doğum tarihi** zorunludur (hak ediş ve yaş istisnası için). |
| B2 | Her şirket için bir **sisteme geçiş tarihi** belirlenir. Bu tarihten önceki dönem için personel başına tek bir açılış bakiyesi (kalan gün) girilir. Sistem, işe giriş tarihinden bu yana **yasal toplam hak edişi** öneri olarak gösterir; yönetici bundan kullanılan günleri düşerek kalan bakiyeyi girer. Kalan bilinmiyorsa 0 girilebilir; personelin ekranında "açılış bakiyesi doğrulanmadı" notu görünür. |
| B3 | Geçiş tarihinden sonraki yıldönümlerinde hak edişler otomatik oluşur. |
| B4 | **Demo verisi tamamen kurgusaldır.** Gerçek çalışanların adları veya verileri kullanılmaz. Demo verisi ayrı bir "Demo Organizasyonu" altında üretilir ve gerçek verilerle karışmaz. |
| B5 | Seed betiği iki örnek şirket, kurgusal personel ve 2–3 aylık giriş-çıkış/izin geçmişi üretir (buton, manuel, eksik, düzeltilmiş ve onay bekleyen kayıt örnekleri dahil). |

---

## 6. Uç Durumlar

- Giriş unutuldu, sadece çıkış yapılmaya çalışılıyor → G4
- Gece yarısını geçen çalışma (23:50 giriş) → kayıt giriş gününe aittir
- İzin talebi mevcut bir izinle çakışıyor → reddedilir
- İzin yıl sonunu veya yıldönümünü kesiyor → gün sayımı tek talepte yapılır; bakiye talep tarihindeki değere göre kontrol edilir
- İzin günlerine resmi tatil denk geliyor → I4
- Personel izinliyken giriş-çıkış yapıyor → kayıt alınır, yöneticiye uyarı gösterilir
- Modem IP'si değişti → G3 + G8
- Personel 10 gün önceki bir günü düzeltmek istiyor → pencere dışı, onaya düşer (D4-a)
- Çalışma takvimi ay ortasında değişti → K9, takvim sürümleri (4.1)
- Açılış bakiyesi bilinmiyor → B2
- Personel işten ayrıldı → hesap pasifleşir, veriler saklama süresi boyunca korunur
- Yönetici kendi talebini onaylıyor → bkz. Roller

---

## 7. Kabul Kriterleri (Örnekler)

```gherkin
Senaryo: Tek dokunuşla giriş (ağ kontrolü pasif)
  Verilen  şirkete henüz ofis ağı atanmamış
  Ne zaman personel "Giriş" butonuna basar
  O zaman  sunucu saatiyle ACTIVE bir CLOCK_IN kaydı oluşur
  Ve       networkCheck = DISABLED, IP adresi kayıtta saklanır

Senaryo: Manuel giriş onaya düşmez
  Verilen  personel girişi unuttu, saat 10:00
  Ne zaman 08:35 saatiyle manuel giriş ekler
  O zaman  kayıt anında ACTIVE olur, method = MANUAL
  Ve       yöneticinin onay listesine hiçbir şey düşmez

Senaryo: Pencere dışı düzeltme onaya düşer
  Verilen  düzeltme penceresi 7 gün
  Ne zaman personel 10 gün önceki çıkış saatini düzeltir
  O zaman  düzeltme PENDING olur, onaylanana kadar eski kayıt geçerli kalır

Senaryo: Geç kalma toleransı
  Verilen  başlangıç 08:30, tolerans 15 dk
  O zaman  08:45:00 girişi geç sayılmaz
  Ve       08:50 girişi 20 dk geç olarak raporlanır

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

- [x] İki şirket aynı modemi kullanıyor → ofis ağı organizasyon seviyesinde (4.1)
- [x] Tüm günler 08:30'da başlıyor; saatler ayarlanabilir olmalı → kurulum sihirbazı (5.5)
- [x] Geçmiş kayıtlar yok → açılış bakiyesi (B2) ve kurgusal demo verisi (B4–B5)
- [x] Uzaktan çalışan aynı takvimde; buton ve manuel kayıt, onaysız (G3a)
- [x] Giriş-çıkışlar onaya düşmez; onay yalnızca izin ve istisnalarda (5.2)
- [x] Geç kalma toleransı 15 dk (L1)
- [ ] *(Ertelendi)* Ofis ağı ayarı: sabit IP var mı? Altyapı hazır, ayar sonra yapılacak.
- [ ] Düzeltme penceresi varsayılanı 7 gün uygun mu? (D4-a)
- [ ] Onaya düşmesi gereken başka "istisna" durumları var mı? (D4)
