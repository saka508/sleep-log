# Sleep Log project checklist

## Completed

- [x] Japanese mobile navigation: 今日・履歴・分析・設定
- [x] Local AsyncStorage persistence without account registration
- [x] Sample records with removable sample-only action
- [x] Sleep record create/edit flow with cross-midnight duration calculation
- [x] History list, daily detail, edit, and delete flow
- [x] Analysis period switcher for 7/14/30 days
- [x] Trend charts, summary metrics, and non-diagnostic correlation notes
- [x] CSV export/import with Japanese headers and date-keyed merge
- [x] Theme preference (自動・ライト・ダーク) with persistence
- [x] Daily reminder settings with native notifications and web fallback
- [x] Unit tests for sleep calculations, chart helpers, sample data, and CSV round trips

## Bug fixes

- [x] `pnpm check` failed with TS2882 on `import "@/global.css"` (added `types/globals.d.ts`)
- [x] Home screen 7-day window used a UTC boundary while everything else is local
- [x] Correlation was shown as an absolute value, hiding the direction of the trend
- [x] Bedtime→minutes conversion was reimplemented inline instead of `getMetricValue`
- [x] Saving onto a date that already had a record overwrote it with no warning
- [x] Reminder time was discarded unless the reminder was already enabled
- [x] Sample data covered today, so a first launch showed 記録済み for the user's own day
- [x] Hardcoded `#E5E7EB` / `#F1D7D7` borders ignored the dark palette
- [x] Theme could not be returned to "follow the system" once light or dark was picked
- [x] History had no way to start a record (only the 今日 tab did)
- [x] Service worker served stale HTML after a redeploy and failed on deep links offline
- [x] Web manifest declared the wrong icon size

## Packaging

- [x] `pnpm apk` builds a sideloadable release APK (`build/sleep-log.apk`)
- [x] Drop unused expo-audio / expo-video so the APK stops asking for the
      microphone and media-playback permissions
- [x] PWA installable and offline-capable via GitHub Pages
- [x] CI runs typecheck, lint and tests before deploying

## Known gaps

- Date and time fields are free text; a picker would suit phones better
  (`keyboardType="numbers-and-punctuation"` is iOS-only).
- Release APK is signed with the Expo template's debug keystore. Fine for
  sideloading, not for Play Store submission.
- `server/`, `hooks/use-auth.ts`, `lib/_core/api|auth` and `app/oauth/callback.tsx`
  are unused template scaffolding for a local-only app.
- `app/dev/theme-lab.tsx` ships in the production web export.
- Only `lib/sleep-utils` and `lib/csv-core` have tests; the store and screens do not.
