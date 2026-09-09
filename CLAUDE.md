# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app is

Sleep Log (睡眠ログ) — a Japanese-language sleep tracker. All UI strings are Japanese; code, comments and commit messages are English.

It is **local-only**: every record lives in `AsyncStorage` on the device. There is no account, no sync, and no backend call anywhere in the app. Anything under `server/` is unused template scaffolding (see "Dead scaffolding" below).

It ships three ways from this one codebase:

| Target | How | Notes |
|---|---|---|
| Android APK | `pnpm apk` → `build/sleep-log.apk` | sideload; attached to GitHub Releases |
| PWA | GitHub Pages on push to `main` | served under the `/sleep-log` base path |
| Web dev | `pnpm dev` | Metro web on :8081 |

## Commands

`pnpm` is **not on PATH** in this environment. Use `corepack pnpm` (the repo pins `pnpm@9.12.0` via `packageManager`). Node is v20 via nvm.

```bash
corepack pnpm install            # node-linker=hoisted (see .npmrc)
corepack pnpm check              # tsc --noEmit
corepack pnpm lint               # expo lint
corepack pnpm test               # vitest run
corepack pnpm dev                # server + Metro web
corepack pnpm apk                # release APK
corepack pnpm exec expo export --platform web   # what CI builds for Pages
```

Single test file / single case:

```bash
corepack pnpm exec vitest run tests/sleep-utils.test.ts
corepack pnpm exec vitest run tests/sleep-utils.test.ts -t "calculates sleep across midnight"
```

There is no `vitest.config.*` — vitest picks up `tests/*.test.ts` with defaults. These are plain Node tests over pure functions; there is no React Native component test setup.

**CI does not gate anything.** `.github/workflows/deploy.yml` installs, builds the web export and deploys to Pages — it does *not* run `check`, `lint` or `test`, despite what `todo.md` claims. Run those three locally before pushing to `main`.

## Architecture

### Routing

`expo-router` file-based routes with `typedRoutes: true`. `app/_layout.tsx` is the root shell: `GestureHandlerRootView` → `ThemeProvider` → `SleepDataProvider` → `Stack`. Four tabs in `app/(tabs)/`: 今日 (`index`) / 履歴 (`history`) / 分析 (`analysis`) / 設定 (`settings`), plus `app/record.tsx` (create/edit) and `app/detail/[date].tsx`.

`app/_layout.tsx` also exports an `ErrorBoundary`. Keep it. Without it a render error in a release build closes the app with nothing on screen — that is how the 1.0.0 startup crash stayed invisible.

### Data

`lib/sleep-store.tsx` (`SleepDataProvider` / `useSleepData`) is the single source of truth. One `useState` object persisted wholesale to `AsyncStorage` under `sleep-log.local-data.v1` on every change.

Records are **keyed by date**: `id === date` (`YYYY-MM-DD`), enforced in `saveRecord` and `importRecords`. One record per day, by construction — saving over an existing date replaces it. Everything read back from storage goes through `normalizeRecord`, which clamps scores to 0–10 and drops entries missing `date`/`id`/`bedTime`/`wakeTime`, so a shape change there is the migration point.

First launch with no stored data seeds `createSampleRecords()` (flagged `isSample`); the 設定 tab can remove or re-add them.

`lib/sleep-utils.ts` holds the pure logic: date keys, `timeToMinutes`, `sleepMinutesFromTimes` (handles crossing midnight), `getMetricValue`, `correlation`, chart helpers. New calculations belong here, not inlined into a screen — and this is the file that has tests.

**All dates are local, never UTC.** Use `dateKey()` / `todayKey()` / `daysFromToday()`. Slicing an ISO string (`toISOString().slice(0,10)`) shifts the day boundary and has caused a bug before.

### Theming

One palette, four hops: `theme.config.js` (the only place hex values live) → `lib/_core/theme.ts` builds `SchemeColors` / `Colors` → `constants/theme.ts` re-exports → `useColors()` in components. Never hardcode a hex in a screen; it will be wrong in one of the two schemes.

`lib/theme-provider.tsx` owns the light/dark decision (`ThemePreference` = `"system" | "light" | "dark"`, persisted separately). Two rules there are load-bearing:

1. **Never hand NativeWind `"system"`.** `nativewindColorScheme.set("system")` becomes `Appearance.setColorScheme(null)`, and RN 0.86 passes that null straight into a non-null Kotlin parameter — an instant `NullPointerException` on the native modules thread. Since `"system"` is the default preference this crashed every first launch (fixed in 1.0.1). Resolve to `"light"`/`"dark"` first, which the provider already does.
2. **Never call `Appearance.setColorScheme` at all.** This context is the source of truth; overriding RN's `Appearance` makes `useSystemColorScheme` report the pinned value, destroying the very signal "follow the device" needs. For the same reason `StatusBar` cannot use `style="auto"` — `ThemedStatusBar` derives it from the theme.

Styling is NativeWind v4 (`global.css`, `tailwind.config.js`) mixed with plain RN styles. `components/sleep-ui.tsx` is the shared kit (`Card`, `MetricCard`, `PrimaryButton`, `SegmentedControl`, `ScorePicker`, `LineChart`, `ScatterPlot`, …) — check it before building a new primitive. Charts are hand-drawn `react-native-svg`, no chart library.

### Platform splits

Metro resolves `.web.ts` over `.ts`. Paired implementations exist for `lib/csv-service` (native: FileSystem + Sharing + DocumentPicker / web: Blob download + file input), `lib/notification-service` (native: `expo-notifications`, imported lazily so Expo Go still works / web: Notification API) and `hooks/use-color-scheme`. Adding a native-only dependency means adding the `.web` counterpart too, or the Pages build breaks.

### Web / PWA specifics

`experiments.baseUrl: "/sleep-log"` in `app.config.ts` — every absolute web path is prefixed with it. `app/+html.tsx` sets the Japanese document shell and registers `public/sw.js`. The service worker is network-first for navigations on purpose (cache-first served stale HTML pointing at deleted bundle hashes) and precaches both the pretty and `.html` form of each route so deep links work offline. **Bump `SHELL_CACHE` / `RUNTIME_CACHE` version suffixes when the shell changes**, or clients keep the old one.

### Dead scaffolding

Present but unused by the app, left over from the project template: `server/`, `lib/_core/api.ts`, `lib/_core/auth.ts`, `lib/trpc.ts`, `hooks/use-auth.ts`, `app/oauth/callback.tsx`, `drizzle/`, `constants/oauth.ts`. `tests/auth.logout.test.ts` still exercises the server router, so `pnpm test` covers code the app never runs. Don't wire new features through tRPC/react-query — mounting those providers in the root layout was itself suspected of breaking startup and they were removed in 1.0.1.

`app/dev/theme-lab.tsx` is a development screen that currently ships in the production web export.

## Release process

1. Bump `version` **and** `android.versionCode` in `app.config.ts` (versionCode must increase or the APK won't install over the previous one).
2. `corepack pnpm check && corepack pnpm lint && corepack pnpm test`.
3. Build the APK — see the long-build note below. Verify it before publishing:
   `~/Android/Sdk/build-tools/36.0.0/aapt2 dump badging build/sleep-log.apk | head -1`
4. Open a PR from the working branch to `main` and merge it (this is what triggers the Pages deploy).
5. `gh release create vX.Y.Z --target "$(git rev-parse origin/main)" --title "Sleep Log X.Y.Z" --notes-file <notes> --latest <apk>`. Pass a full SHA or a branch name; an abbreviated SHA is rejected with `Release.target_commitish is invalid`. Name the asset `sleep-log-X.Y.Z.apk` to match the existing releases.

The APK is signed with the Expo template's **debug keystore** — fine for sideloading, not publishable to Play. Changing the signing key breaks upgrade-in-place for existing installs.

## Long builds and WSL

This machine is WSL2 behind a Cursor remote. A dropped connection kills the whole process tree, and `pnpm apk` takes minutes — a build started as a normal child process dies with the session. Detach it:

```bash
setsid nohup env ANDROID_HOME="$HOME/Android/Sdk" node scripts/build-apk.mjs \
  > /tmp/apk-build.log 2>&1 < /dev/null &
```

Then watch the log rather than holding the process open. `scripts/build-apk.mjs` runs Gradle with `--no-daemon`, regenerates the gitignored `android/` via `expo prebuild` when missing, and copies the result to `build/sleep-log.apk`. Gradle recovers cleanly from a killed build (`ninja: warning: premature end of file; recovering`), so an interrupted run can just be re-run.

`ANDROID_HOME` is not exported in the shell; the script falls back to `~/Android/Sdk`, which is where the SDK actually is.

## Conventions

- Path aliases `@/*` (repo root) and `@shared/*`.
- `import "@/global.css"` requires `types/globals.d.ts` (`declare module "*.css"`); TypeScript 6 errors with TS2882 without it.
- `android/`, `ios/`, `dist/`, `build/` and `*.apk` are gitignored — all generated.
- Commit messages: imperative subject, then a body explaining the *why*, including reproduction and verification steps for bug fixes. Follow the style of `9576cf3`.
