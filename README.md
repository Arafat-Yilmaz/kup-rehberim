# Küp Rehberim

GitHub Pages yayını için önce **[YAYINLA.md](YAYINLA.md)** dosyasını oku. Hazır `docs/` klasörünü kullan; ChatGPT hizmetine ihtiyaç yoktur.

3×3 fiziksel zekâ küpü için Türkçe, adım adım çözüm rehberi. Angular NgModule uygulaması; çözüm hesabı ayrı bir Web Worker içinde cubejs ile yapılır.

## Kullanıcı akışı

1. Telefonda web sürümünü aç; istersen ana ekrana ekle. Başlangıçta ön ve üst yüzü belirle (varsayılan yeşil ön, beyaz üst).
2. Ön, sağ, arka, sol, üst, alt yüzleri fotoğrafla tara veya renklerini elle gir. Kareleri ve yönü kontrol ederek kaydet. Her yüzün merkezinden içteki URFDLB renk eşlemesi türetilir.
3. Çözümü bul. Sistem kare sayısını, renk adetlerini, merkezleri, parça benzersizliğini, köşe yönlerini, kenar yönlerini ve permütasyon paritesini kontrol eder.
4. Sesli rehberi başlat veya hamle önizlemesini izle, fiziksel küpünde uygula ve onayla. Önceki hamle kontrolü görsel küpte ters hamleyi uygular; fiziksel küpte de tersini yapman gerekir.
5. Çözüm ve mevcut adım localStorage içinde; kırpılmış yüz fotoğrafları oturum anahtarıyla IndexedDB içinde saklanır.

## Teknik parçalar ve kararlar

| Dosya | Sorumluluk |
| --- | --- |
| src/cube.ts | Yüz/kare veri modeli, tam sayı koordinatlarıyla bağımsız hamle motoru, renk normalizasyonu, Türkçe açıklamalar |
| src/face-scanner.ts / .html | Kamera, fotoğraf yükleme, kadraj, renk düzeltme, yüz kimliği ve kayıt akışı |
| src/photo-analysis.ts | Piksel medyanları, HSV sınıflaması, güven puanı ve benzersiz merkez sayımı |
| src/photo-store.ts | Cihaz içindeki fotoğraf kayıtları (IndexedDB) |
| scripts/build-pwa.mjs | Sürümlenmiş, yalnızca uygulama kaynaklarını önbellekleyen çevrimdışı kabuk |
| src/learning.ts | Doğrulanmış çözümde her hamlenin parça etkisi, kalıcı yerleşme zamanı ve iki bölümlü hedeflerin açıklanması |
| src/solve-core.ts | Fiziksel geçerlilik kontrolü, cubejs çözüm adaptörü, çıkan çözümün bağımsız modelde doğrulanması |
| src/solver.worker.ts | Hesaplamayı ana UI thread'inden ayıran mesaj sınırı |
| src/main.ts | Angular bileşeni, giriş/rehber state'i, kullanıcı olayları, yerel kayıt ve Web Animations API ile katman dönüşleri |
| src/app.html | Renk girişi, tutuş yönergeleri, çözüm adımları ve hata ekranları |
| src/styles.css | Mobil uyumlu görünüm, CSS 3D küp, erişilebilir odak ve azaltılmış hareket desteği |
| tests/verify.cjs | Bağımsız motorla cubejs karşılaştırması, geçersiz küpler ve çözüm doğrulaması |

Bu sürümde bir sunucuya ait kullanıcı verisi veya ortak state ihtiyacı yoktur. Bu yüzden API/veritabanı eklenmedi; hesap ve geçmiş senkronizasyonu istenirse sonradan eklenebilir. Görsel model ve çözücü farklı kod yolları kullanır; testler yüz yönü uyuşmazlıklarını yakalar. Çözüm standart bir algoritmadır; dil modeli tahmini değildir ve en kısa çözüm garantisi verilmez.

## Açıklayarak öğren

Çözüm ekranındaki seçenek varsayılan olarak açıktır. Her adımda bir kenar veya köşe parçasının mevcut konumu, hamleden sonraki konumu ve hedef konumu gösterilir. Örnek parça 3D küpte mor çerçeveyle vurgulanır. Hesaplanan yolun tamamı incelenerek parçanın hangi adımda kalıcı olarak doğru yerleştiği belirlenir.

Kısa çözücünün iki bölümlü yolu açıklanır: yön/orta katman hazırlığı ve hazırlığı koruyarak son yerleştirme. Bu, başlangıç seviyesi katman katman algoritmasının uygulanması değildir. Her hamleye varsayımsal bir niyet atanmaz veya en iyi yerel hamle olduğu iddia edilmez. Hedef ve değişen konumlar gerçek çözüm durumları üzerinden hesaplanır. Doğru parça sayısı azalabilir; açıklama bunu belirtir. Önceki hamleye dönme ve sayfayı yeniden açma açıklamaları da doğru adıma taşır.

Yöntem kaynağı: https://www.kociemba.org/math/twophase.htm

## Çalıştırma

Node 22+ ve npm ile:

```
npm ci
npm test
npm run build
```

dist/ klasörünü bir statik web sunucusunda servis et. solver.worker.js uygulamayla aynı origin'den yüklenir. Fontlar dış bağlantı yoksa sistem fontuna düşer; uygulamanın çözüm işlevi dış API gerektirmez.

## Tek dosyalı taşınabilir dışa aktarım

```
npm run build
node scripts/export-portable.mjs ./tasinalabilir
```

tasinalabilir/KUP-REHBERIM.html uygulama stillerini, derlenmiş Angular kodunu ve çözüm worker'ını aynı dosyada içerir. Worker, gömülü metinden Blob URL ile başlatılır. Dış font bağımlılıkları çıkarılır. Güncel Chrome/Edge gibi bir tarayıcıda dosyayı açmak hedeflenir; kullanmak için Node.js gerekmez. Yerel dosyalar için tarayıcı depolama davranışı değişebilir.

## Sınırlar

- Kamera ve fotoğraf girişi kullanıcı hizalamasına dayanır. Perspektif düzeltmesi veya eğitilmiş bir görsel model yoktur. Parlama, gölge, renk şeması ve yanlış tutuş hataya yol açabilir; kullanıcı renk/yön kontrolü yapar. Ücretli AI API çağrısı yoktur.
- Fiziksel hamleler otomatik doğrulanmaz. Yanlış hamle yapılırsa mevcut küp renkleri yeniden girilmelidir.
- Sesli okuma yüklü Türkçe sese bağlıdır. Yerel Türkçe ses tercih edilir; uzak ses varsa internet gerekebileceği gösterilir. Ses yoksa yazılı yönergelerle devam edilir. Rehber otomatik konuşur fakat adımı otomatik ilerletmez.
- Taşınabilir dosya HTTP üzerinden Chrome'da açılarak örnek küpün 22 adımlık çözümü ve geri alma kontrol edildi. Ortamın tarayıcı politikası file:// gezinmesini engellediği için doğrudan yerel dosya açılışı burada doğrulanamadı. Kamera akışı, altı yüz okuma, aynı yüzü ikinci kez kaydetmeyi engelleme ve fotoğraf kaydını yeniden yükleme sentetik yüz fotoğraflarıyla Chrome içinde doğrulandı. Gerçek telefon kamerası, Türkçe ses kalitesi ve mobil kurulum fiziksel cihazda ayrıca denenmelidir.

## Sonraki öğrenme adımları

1. Giriş/veri modeli: neden yüz yönü ve merkezler önemli?
2. Worker: CPU yoğun iş UI thread'ini neden bloke eder?
3. Kullanıcı oturumu: localStorage'ın kapsamı ve ortak backend state farkı.
4. Kamera: yüz yakalama, renk tahmini ve kullanıcı doğrulaması.
5. Yayın: derleme çıktısı, immutable sürüm ve geri dönüş.

cubejs MIT lisanslıdır; dağıtımda public/THIRD_PARTY_LICENSES.txt korunur.

## Mobil kullanım ve kamera

Android Chrome: uygulamayı HTTPS bağlantısından aç; menüden uygulamayı yükle/ana ekrana ekle. iPhone Safari: Paylaş > Ana Ekrana Ekle. Kamera sadece kullanıcı düğmeye bastığında, mikrofon istenmeden açılır. Kamera kapanınca, sayfa arka plana gidince ve bileşen kapanınca medya track'leri durdurulur. Fotoğraflar sunucuya gönderilmez.

Kamera ortasındaki yüzde 80'lik kare, okuma alanıdır. Fotoğraf seçmede yakınlaştırma, yatay/dikey konum ve 90 derece döndürme kontrolleri vardır. Her tile'ın iç bölgesinden medyan renk alınır. Merkez rengi daha önce kaydedilen bir yüzle aynıysa yeni bir yüz olarak kaydedilemez; mevcut yüz açıkça yenilenebilir. Bir konumun merkez rengi değişirse eski kaydı kaldırmadan üstüne yazılmaz. Son çözüm öncesinde fiziksel geçerlilik kontrolü devam eder.

## Çevrimdışı kabuk

Manifest ve 192/512 piksel simgeler kurulabilir web uygulaması sağlar. Service worker sadece aynı origin'deki derlenmiş uygulama dosyalarını önbellekler; POST isteklerini, kimlik doğrulama rotalarını veya başka origin'leri yakalamaz. İlk başarılı kurulum internet gerektirir. Navigasyon ağ üzerinden denenir, bağlantı yoksa kayıtlı uygulama kabuğu kullanılır. Eski sürüm önbellekleri yeni sürüm aktive olunca temizlenir. Türkçe sesin çevrimdışı olması cihazın ses motoruna bağlıdır.
