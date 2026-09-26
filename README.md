# Sleep Log

睡眠時間と日中の体調を記録して、生活の傾向を振り返るアプリ。記録は端末内（AsyncStorage）だけに保存され、アカウント登録もサーバー送信もありません。

## スマホで使う

### 方法 1: Android アプリ（APK を直接インストール）

完全にローカルで動きます。ネット接続も開発サーバーも不要です。

```bash
corepack pnpm install
corepack pnpm apk        # → build/sleep-log.apk
```

生成された `build/sleep-log.apk` をスマホに転送して開き、「提供元不明のアプリ」を許可してインストールします。転送は USB、Google Drive、`adb install build/sleep-log.apk` のいずれでも構いません。

必要なもの:

- JDK 17 以上
- Android SDK（`ANDROID_HOME` を設定。未設定なら `~/Android/Sdk` を見ます）

`android/` は gitignore 対象で、無ければ `corepack pnpm apk` が `expo prebuild` で自動生成します。

生成される APK は arm64-v8a と armeabi-v7a の両方を含む約 61MB のユニバーサル版で、どの Android 端末でもインストールできます。64bit 端末しか使わないならサイズを半分ほどにできます:

```bash
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

> 署名は Expo テンプレート既定のデバッグ用キーストアです。手元で使う分には問題ありませんが、Google Play に出す場合は `android/app/build.gradle` の `signingConfigs.release` に自前のキーストアを設定してください。

### 方法 2: PWA（iPhone でも使える）

GitHub Pages にデプロイ済みのページをホーム画面に追加すると、オフラインでも起動します。

- iOS: Safari で開く → 共有 → 「ホーム画面に追加」
- Android: Chrome で開く → メニュー → 「アプリをインストール」

Service Worker が画面と静的アセットをキャッシュするため、初回アクセス後は機内モードでも動作します。

## 開発

```bash
corepack pnpm dev        # Metro + API サーバー
corepack pnpm check      # 型チェック
corepack pnpm lint
corepack pnpm test
```

Web 版を書き出す場合:

```bash
corepack pnpm exec expo export --platform web   # → dist/
```

`main` 向けの PR では、GitHub Actions が `check`、`lint`、`test`、Web export を実行します。PR から GitHub Pages へはデプロイされません。`main` への push と手動実行では、同じ検証が成功した後に GitHub Pages へデプロイされます。

## 注意

生活記録・傾向把握のためのアプリです。医学的な診断や治療の判断には使用しません。
