# Araç görselleri ve Squad ikonları — 10 Ekim 2026

Takımlar envanteri, takım karşılaştırması, İnşa lojistik listesi ve Sayaçlar araç resimleri içerir. Fotoğraflar yalnızca listede görünürken yüklenir. **230 araç adının tamamının görseli vardır:** 209'u SquadCalc'ın vanilla dosyalarıyla tam ad eşleşmesi, kalan 21'i Squad Intelligence'ın oyun içi `BP_…` araç kimliğiyle eşleştirilmiş görselleridir. Bilinmeyen yeni araçlar için **Sınıf simgesi** yedek gösterimi korunur.

FOB, HAB, rally, piyade, araç, mühimmat/destek, mayın, onarım, havan ve ağır makineli işaretleri Squad SDK ikonlarını kullanır. Ateş hattı başlangıcı seçili profile göre havan, Hell Cannon, Grad veya paletli havan simgesidir. Çizim rengi çerçevede korunur; renk destek modlarında A–E harfleri ve çizgi desenleri çalışmaya devam eder. Görseller yereldir; oyun sırasında dış site isteği gerekmez.

Kaynaklar: [SquadCalc görselleri](https://github.com/sh4rkman/SquadCalc/tree/master/public/img) ve [Squad Intelligence araçları](https://squadintelligence.com/vehicles); oyun varlıkları Squad / Offworld Industries ve ilgili hak sahipleri. SquadCalc README harita ve marker ikonlarını Squad SDK'ya atfeder. Kaynak dosyalar değiştirilmeden alınmıştır; yanlışlıkla `.webp` adını taşıyan PNG'lerin yalnızca yerel uzantısı düzeltilmiştir. Toplam 275 dosyanın kaynak adresleri ve SHA-256 değerleri [manifest.json](assets/squad/manifest.json) içindedir. SquadCalc dosyalarının sabit Git commit'i korunur; 21 ek görselin araç kimlikleri, kaynak sayfaları ve 1920×1080 boyutları ayrıca [vehicle-photo-sources.json](data/vehicle-photo-sources.json) içinde kayıtlıdır. Mevcut üçüncü taraf lisans koşulları geçerlidir.

Kontrol: tüm 275 resim görüntü çözücüyle açıldı; ek 21 görsel toplu önizlemede incelendi. Dosya hash'leri ve 230 ad eşlemesi otomatik testte denetlendi. Görsel doğrulama araçların mevcut oyun sürümünde hangi layerlarda kullanılabildiğinin doğrulanması değildir. Yeni arayüzün gerçek tarayıcı görsel kontrolü bu oturumda bağlantı bulunamadığından tamamlanamadı; DOM testleri gerçek ekran testi yerine geçmez.


## Fraksiyon bayrakları

Planlayıcının 18 fraksiyon kodu (ADF, AFU, BAF, CAF, CIV, CRF, GFI, IMF, MEI, PLA, PLAAGF, PLANMC, RGF, TLF, USA, USMC, VDV, WPMC) için oyun içi bayraklar yerel olarak saklanır: `assets/squad/flags/<KOD>.webp` (dikdörtgen, 512×256) ve `assets/squad/flags/circle/<KOD>.webp` (yuvarlak, 256×256; CIV hariç). Toplam 36 dosyanın kaynak adresi, bayt sayısı ve SHA-256 değeri [manifest.json](assets/squad/manifest.json) içindedir.

- Kaynak depo: https://github.com/sh4rkman/SquadCalc
- Sabit commit: `24828d6d3081c7ce52b10ef39ec86036ebf010b5` (SquadCalc `master` ucu ile aynıdır; manifestteki mevcut commit)
- Kaynak yol: dikdörtgen `public/img/flags/vanilla/<KOD>.webp`, yuvarlak `public/img/flags/vanilla/circles/<KOD>.webp`. Dosyalar değiştirilmeden alınmıştır.
- CIV yedeği: SquadCalc'ta CIV bayrağı yoktur. `CIV.webp` genel `public/img/flags/unknown.webp` dosyasıdır; yuvarlak `circle/CIV.webp` ise `unknown` yuvarlak sürümü olmadığından genel `public/img/flags/main_circle.webp` dosyasıdır (128×128). İkisi de gerçek bir CIV bayrağı değil, yer tutucudur.
- Lisans: SquadCalc kodu MIT Non-Commercial koşullarındadır. Bayrak görselleri Squad / Offworld Industries ve ilgili hak sahiplerinin varlığıdır; atıf zorunludur. Bu kullanım ek bir lisans veya ticari kullanım izni vermez, ticari kullanım izni verilmiş sayılmaz.
