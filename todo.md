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
- [x] Theme preference persistence and light/dark palette
- [x] Daily reminder settings with native notifications and web fallback
- [x] Unit tests for sleep calculations, chart helpers, sample data, and CSV round trips

## Final validation

- [x] `pnpm test`
- [x] `pnpm check`
- [x] Mobile-sized screenshots captured for home, analysis, input, and detail screens
- [ ] Reopen Expo preview after final server restart

## Non-blocking notes

- Expo reports package patch-version suggestions for SDK 54; the installed versions remain compatible enough for the current project checks.
- Expo web may show deprecation warnings for existing template shadow and pointer-events props; these do not block the app flow.
- Native-only CSV sharing and notifications are kept in platform files; web uses browser download/file input and an informational reminder fallback.
