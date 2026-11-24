# Küp Rehberim — GitHub Pages yayını

Bu paket ChatGPT'den bağımsızdır. Çalışmak için ChatGPT hesabı, API anahtarı, .NET API, veritabanı veya kişisel bilgisayarının açık kalması gerekmez. Yayın tamamlandıktan sonra dosyaları GitHub sunar.

## Kod yazmadan yayınla

1. GitHub hesabında `kup-rehberim` adında **Public** bir repository oluştur. GitHub Free ile Pages için public repo kullanılır; buradaki kaynaklar herkesçe görülebilir.
2. ZIP'i bilgisayarına çıkar. `Kup-Rehberim-GitHub-Pages` klasörünün **içindeki** dosya ve klasörleri repository köküne yükle: GitHub'da **Add file > Upload files**, sürükleyip bırak, ardından **Commit changes**. ZIP dosyasının kendisini yükleme. GitHub'da `docs/index.html` yolu görünmeli; fazladan dış klasör olmamalı. Sadece yayın istiyorsan yalnız `docs` klasörünü yüklemen de yeterlidir.
3. Repository'de **Settings > Pages** sayfasına gir.
4. **Build and deployment > Source: Deploy from a branch**, **Branch: main**, **Folder: /docs** seç; **Save** düğmesine bas. Varsayılan dalın farklıysa dosyaları yüklediğin dalı seç.
5. Yayın işlemi bittikten sonra aynı sayfada çıkan **Visit site** bağlantısını aç. GitHub'a göre değişikliklerin yayınlanması 10 dakikaya kadar sürebilir. Hata olursa repository'nin **Actions** sayfasındaki `pages build and deployment` sonucuna bak.

Adres biçimi: `https://GITHUB-KULLANICI-ADIN.github.io/kup-rehberim/`
Bu yalnızca biçim örneğidir; gerçek adresi Pages ekranından kopyala.

Dosyalar önceden derlendi. İlk yayın için bilgisayarında Node.js kurulu olması gerekmez. `docs/` içeriği doğrudan statik yayına hazırdır. HTTPS üzerinden kamera kullanımında telefon kamera izni ister. Türkçe ses, telefonda/tarayıcıda bulunan seslere bağlıdır.

## Telefonda kullan

- Android Chrome: yayın bağlantısını aç, menüden **Uygulamayı yükle / Ana ekrana ekle** seç.
- iPhone Safari: yayın bağlantısını aç, **Paylaş > Ana Ekrana Ekle** seç.
- İlk açılış internete ihtiyaç duyar. Çevrimdışı hazır uyarısı çıktıktan sonra uygulama kabuğu cihazda saklanır. Tarayıcı depolaması silinirse yeniden açmak gerekir; bazı sesler internet gerektirebilir.
- Fotoğraflar ve ilerleme o tarayıcıda saklanır. Yeni GitHub adresi eski ChatGPT Sites adresinden farklı bir origin olduğu için önceki taramaların otomatik taşınmaz; küpünü yeni adreste yeniden tara.
- Her ziyaretçi uygulamayı kendi cihazında kullanır. GitHub veya ChatGPT hesabıyla oturum açmaz.

## Sonradan kodu değiştirirsen

Node.js 22.12+ veya 24 LTS ile proje klasöründe:

```sh
npm ci
npm test
npm run build:pages
```

Sonra güncel kaynaklarla birlikte yeniden oluşturulan `docs/` klasörünü de aynı repository'ye commit et/yükle. GitHub Pages otomatik olarak yeni sürümü yayınlar. Sadece kaynak dosyalarını değiştirmek hazır `docs/` yayınını yenilemez.

`src/`, `public/`, `scripts/`, `tests/`: kaynaklar ve kontroller.
`docs/`: derlenmiş yayın dosyaları, PWA manifesti, service worker ve lisans metinleri.

Bu paket hesap bilgisi, özel anahtar, kullanıcı fotoğrafı veya ChatGPT yayın yapılandırması içermez. Renk tanıma ve çözüm hesaplaması cihazda yapılır; ücretli AI API çağrısı bulunmaz.

Kaynaklar:
- https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
