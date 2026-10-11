# Üçüncü taraf kaynakları

- Oyun, harita görselleri, arazi ve SDK varlıkları: Squad / Offworld Industries ve ilgili hak sahipleri.
- Harita/layer/capture/birlik verisi kaynağı: https://squadmaps.com/ — Ekim 2026 snapshot.
- Yükseklik ve 3B sahne verisi kaynağı: https://squadcalc.app/ ve https://github.com/sh4rkman/SquadCalc — Ekim 2026 snapshot. Bina ve bitki yerleşimleri yerel paket olarak saklanır; bitki ve bazı yapı görünümleri basitleştirilmiştir.
- SquadCalc kaynak lisansı: `outputs/zerozone-haritalar/data/terrain/SQUADCALC-LICENSE.txt` (MIT Non-Commercial). Bu kaynaklardan gelen içeriğe sınırsız ticari kullanım izni verildiği varsayılmamalıdır.
- Araç fotoğrafları ve oyun ikonları: SquadCalc `public/img/vehicles/vanilla` ve `public/img/icons/ally`; Squad / Offworld Industries ve ilgili hak sahipleri. Tam kaynak, sabit commit ve dosya hash'leri `outputs/zerozone-haritalar/assets/squad/manifest.json` içindedir. SquadCalc lisansı ve oyun varlıklarının hakları geçerlidir.
- Three.js r180: `outputs/zerozone-haritalar/assets/vendor/THREE-LICENSE.txt` (MIT).
- Ek 21 araç görseli: https://squadintelligence.com/vehicles — Squad Intelligence üzerinden Squad oyun varlıkları. Dosyalar değiştirilmeden saklanır; ilgili araç sayfası, oyun kimliği, özgün dosya URL'si ve SHA-256 `outputs/zerozone-haritalar/data/vehicle-photo-sources.json` içinde kayıtlıdır. Bu atıf ek bir lisans veya ticari kullanım izni değildir; oyun varlıkları ve kaynak görseller üzerindeki haklar ilgili hak sahiplerine aittir.
- Leaflet 1.9.4: `outputs/zerozone-haritalar/assets/vendor/Leaflet-LICENSE.txt` (BSD-2-Clause).
- Montserrat: `outputs/zerozone-haritalar/assets/brand/Montserrat-OFL.txt` (SIL OFL).
- Marka ve görsel tasarım referansı: https://zerozonecommunity.com/.

Kaynakların lisans metinleri korunmuştur. Bu depo, üçüncü taraf oyun varlıkları üzerinde mülkiyet veya ek dağıtım/ticari kullanım hakkı iddia etmez.

- Zırh geometrisi, malzeme özellikleri ve mühimmat eğrileri: https://squad-armor.com/ v10.6.0 (10 Ekim 2026). Kaynak GLB Armor grupları dönüştürülmüştür; katalog kaynak/çıktı SHA-256 değerlerini korur. Oyun varlıkları Squad / Offworld Industries ve ilgili hak sahiplerinindir. Bu atıf ek lisans vermez.
- OrbitControls r180: Three.js MIT lisansı kapsamındadır.
- War Thunder koruma analizi yalnızca etkileşim/sunum referansıdır; War Thunder kodu, modeli, sesi ve hasar verileri içerilmez.

- Dokulu araç dış modelleri ve 767 albedo kaplaması: Squad Armor vehicles/textures kaynakları; hash ve eksik kaplama listesi `data/armor/exterior-manifest.json`. Haklar Squad / Offworld Industries ve ilgili hak sahiplerindedir.
- GLTFLoader, DRACOLoader ve BufferGeometryUtils: Three.js r180 MIT. Draco 1.5.7 decoder: Google, Apache-2.0; lisans `assets/vendor/draco/LICENSE.txt`.

- Fraksiyon bayrakları (18 dikdörtgen + 18 yuvarlak WebP): SquadCalc `public/img/flags/vanilla` ve `vanilla/circles` (CIV için genel `unknown.webp` ve `main_circle.webp` yedeği), sabit commit `24828d6d3081c7ce52b10ef39ec86036ebf010b5`; SquadCalc MIT Non-Commercial koşullarındadır. Görseller Squad / Offworld Industries ve ilgili hak sahiplerinin varlığıdır; atıf zorunludur. Tam kaynak ve SHA-256 değerleri `outputs/zerozone-haritalar/assets/squad/manifest.json` içindedir. Bu atıf ek lisans veya ticari kullanım izni vermez.
