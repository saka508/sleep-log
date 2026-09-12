# 個人コンディション・データモデル（Phase 2 基盤）

## 現在の保存形式

- `AsyncStorage` の `sleep-log.local-data.v1` に、`records` と `settings` をまとめて保存する。
- 睡眠記録は `YYYY-MM-DD` の日付を `id` として使い、1日1件に制限する。
- CSVの既存列と保存キーは、後方互換性のため変更しない。
- 日付はUTCへ変換せず、端末のローカル日付を使う。

## 最初の実装単位

`DailyConditionRecord` を、1日を表す上位の読み取りモデルとして追加した。既存の
`SleepRecord` は保存時に移行せず、`dailyConditionFromSleepRecord` で次の任意領域へ
変換する。

- `sleep`
- `exercise`
- `nutrition`
- `environment`
- `subjective`

読み取りモデルには `schemaVersion: 1` を付与している。これは現在の旧形式を
置き換えるものではなく、将来の保存モデル移行時に変換先の版を識別するための
基盤である。

各領域は未入力でもよく、取得元を `manual | wearable | health` で表せる。現時点では
既存値をすべて `manual` として扱う。

## 互換性方針

この段階では新しい保存キーや自動マイグレーションを追加しない。従来の
`AsyncStorage`、CSV入出力、記録画面、履歴・分析画面はそのまま動作する。
`SleepDataProvider` が公開する `dailyConditions` だけが新しいモデルを利用するため、
次のPhaseで画面や保存処理を小さな単位で移行できる。

## 次の安全な実装単位

新しい領域だけを別キーへ保存するバージョン付きストアを追加し、まず主観状態の
`fatigue` と `muscleFatigue` を任意入力として記録できるようにする。旧キーの睡眠
データを正本として残し、エクスポート形式を拡張してから運動入力へ進む。
