# Yayın klasörü

Statik web sayfaları. Her proje kendi klasöründe, GitHub Pages ile yayınlanır.

| Proje | Açıklama | Adres |
|---|---|---|
| `ev-paneli/` | Saat, hava durumu, namaz vakitleri ve piyasa gösteren okuma ekranı | https://omerrmanav.github.io/ev-paneli/ |
| `namaz/` | Günlük namaz vakitleri ve namaz takibi (PWA) | https://omerrmanav.github.io/namaz/ |
| `arac/` | Araç yakıt, servis ve tarih takibi (PWA) | https://omerrmanav.github.io/arac/ |

Kullanıcı verisi (namaz kayıtları, araç kayıtları vb.) bu depoda tutulmaz. Yalnızca kullanıcının kendi tarayıcısında (`localStorage`) saklanır.

## Veri kaynakları
- Hava durumu: [Open-Meteo.com](https://open-meteo.com/) (CC BY 4.0, ticari olmayan kullanım)
- Namaz vakitleri: [Aladhan API](https://aladhan.com/prayer-times-api)
- Döviz ve altın: [Truncgil Finans](https://finans.truncgil.com/)
- Yakıt fiyatı (İstanbul, pompa): [Opet](https://www.opet.com.tr/akaryakit-fiyatlari) fiyat uç noktası. `.github/workflows/fuel-price.yml` günde bir kez çalışır ve `arac/fuel-price.json` dosyasını günceller. Başarısız olursa dosya değişmez.

## Uyarı
Sayfalar bilgi amaçlıdır. Veriler üçüncü taraf servislerden gelir, doğruluğu ve kesintisiz olması garanti edilmez.
Namaz vakitleri için resmî Diyanet takvimine, yakıt ve piyasa fiyatları için ilgili kurumun kendi kaynaklarına bakın.

## Gizlilik
Sayfalar kullanıcı verisi toplamaz, sunucu tarafı kod çalıştırmaz. Tercihler ve kayıtlar yalnızca kendi tarayıcıda tutulur.
Otomatik görev yalnızca herkese açık bir fiyat verisini okur ve depoya yazar; kişisel veri içermez.
