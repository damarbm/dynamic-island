# Summary

Adds a Prayer tab that calculates Fajr, Sunrise, Dhuhr, Asr, Maghrib and Isha offline from a saved Indonesian location. Location search runs once from Preferences through OpenStreetMap Nominatim. After the user picks a result, the coordinates and label are saved and later schedules are calculated locally with the pinned `adhan` 4.4.6 library in the system time zone. Until a location is enabled, the tab shows a setup prompt instead of a schedule.

# Changes

- `src/prayer/schedule.ts`: offline schedule from saved coordinates, method, Asr madhab and high-latitude rule. Marks the next prayer, and rolls to tomorrow's Fajr after Isha.
- `src/prayer/geocoder.ts`: builds an Indonesia-only Nominatim search URL and accepts only valid Indonesian results.
- `src/prayer/config.ts`: method, madhab and high-latitude choices, plus guards for stored values.
- `src/ui/prayer-panel.ts`: Prayer panel with a setup state, the place name and date, six rows, and a highlighted next prayer. Rows have accessible names.
- `src/ui/island.ts`: Prayer is the third Expanded View tab.
- `src/core/controller.ts`: caches today's and tomorrow's schedule and recalculates when the date, time zone, location or calculation settings change. Refreshes after the screen unlocks.
- `src/prefs.ts`: enable switch, area search with a one-request-per-second limit, result picker, and calculation controls. Search uses Soup and does not request location permission.
- `static/schemas/...gschema.xml`: prayer location and calculation keys. `prayer-location-configured` defaults to `false`.
- `static/stylesheet.css`: styles for the prayer list, setup state and next-prayer marker.
- `package.json` and `package-lock.json`: pin `adhan` 4.4.6 and add the Soup type package.
- `scripts/build.mjs`: copies `THIRD_PARTY_NOTICES.md` into `dist/`.
- `THIRD_PARTY_NOTICES.md`: MIT license notice for bundled `adhan` 4.4.6.
- `README.md` and `static/metadata.json`: describe the Prayer tab, the search attribution and the new source layout.
- `docs/PRAYER_TIME_PLAN.md`: plan for this work.
- `docs/ROADMAP.md`: prayer times are ticked off. Click-to-toggle is also ticked, and the responsive Expanded View item is removed.
- `docs/TAB_VIEW_PLAN.md`: Prayer is recorded as a current panel, and the Notifications panel is dropped from the plan.
- `test/prayer.test.ts` and `test/geocoder.test.ts`: schedule fixture, next-prayer rollover, method and madhab differences, invalid locations, Indonesia-only search parsing, high latitude and time-zone formatting.

# Type of change

- [ ] Bug fix
- [x] New feature
- [ ] Refactor or cleanup
- [x] Styling only
- [x] Documentation
- [x] Build or tooling

# How to test

1. `npm install`, then `make dev` (nested shell) or `make deploy` and toggle the extension in your session.
2. Open the extension preferences. Search for a kecamatan or area with at least 3 characters, pick the matching result and press Use Selected Location.
3. Hover over the Pill and open the Prayer tab. Confirm the saved place, the six times and a Next marker on the upcoming prayer.
4. Turn off Enable Prayer Times. The tab should return to "Set your location in Preferences" and should not show a schedule for `0, 0`.
5. Change the calculation method or Asr method and confirm the times update without another search.
6. Open System and Calendar and confirm those tabs still work.

Tested so far: `npm run typecheck` passes, `npm test` passes (17 tests), and `npm run build` succeeds. Not yet tested in a running GNOME Shell 50 session. Location search itself was not exercised against Nominatim.

# Checklist

- [x] `npm run typecheck` passes
- [x] `npm test` passes
- [x] `npm run build` succeeds
- [ ] Tested on GNOME Shell 50
- [ ] Screenshots or a screen recording attached for UI changes
- [x] README or docs updated if behavior or settings changed
- [x] GSettings schema changes come with a default that suits existing users

Note for reviewers: the new prayer keys default to an unconfigured location, so existing installs stay on the setup prompt until the user saves one.
