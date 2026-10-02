---
name: Sleep Log task
about: Define one bounded, reviewable autonomous-development task for Sleep Log
title: "[Task] "
labels: ""
assignees: ""
---

## 目的

<!-- ユーザーにとって何が改善されるか。1つの安全な作業単位に限定する。 -->

## 背景

<!-- 現状、問題の再現条件、確認済み事実と未確認事項を分けて書く。 -->

## 完成条件

- [ ]
- [ ]

## 変更してよい範囲

<!-- ファイル、画面、純粋ロジック、文書などを具体的に列挙する。 -->

## 変更してはいけないもの

- [ ] アプリの既存保存データを無断で変換・削除しない
- [ ] 対象外の未追跡・他作業ファイルを変更、削除、stage、commitしない
- [ ]

## テスト条件

- [ ] `corepack pnpm check`
- [ ] `corepack pnpm lint`
- [ ] `corepack pnpm test`
- [ ] `corepack pnpm exec expo export --platform web`
- [ ] `git diff --check`
- [ ] このタスク固有の回帰ケース:

## UI確認

<!-- UIに変更がなければ「変更なし」と明記する。ある場合は対象画面、320/360/390/412px、ダークモード、実機/PWA確認を記す。 -->

## 人間確認が必要な条件

<!-- 保存形式、migration、CSV列の意味/順序、外部送信、Health/位置情報、削除、ロードマップ変更、大きなUI方向転換など。なければ「なし」と明記する。 -->

## 正本との関連

- `docs/DEVELOPMENT_PLAN.md`:
- `docs/SPEC.md`:
- `docs/DECISIONS.md`:
- `AGENTS.md` または既存ルールとの整合:

## 関連Issue / PR

<!-- `Closes #123`、依存Issue、既存PR、関連commitを記す。 -->
