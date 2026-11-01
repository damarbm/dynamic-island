# Offline Prayer Times Plan

## Goal

Add a Prayer Times tab that searches for an Indonesian kecamatan/area, saves
its coordinates, and calculates a daily schedule locally in the system time
zone. Location search needs network access only during setup and never requests
device location permission.

## Decisions

- Use the pinned `adhan` 4.4.6 library for offline astronomical calculations.
- Search Indonesia through OpenStreetMap Nominatim with an explicit Search
  action, result selection, attribution, and a one-request-per-second limit.
- Save the selected label and coordinates; do not query again during prayer
  calculations.
- Use the system time zone; coordinates should correspond to that zone.
- Support calculation method, Asr madhab, and high-latitude rule preferences.
- Show a setup state until the user explicitly enables a configured location.
- Display Fajr, Sunrise, Dhuhr, Asr, Maghrib, and Isha, and mark the next
  actual prayer with text and styling.

## Implementation

- [x] Add a GNOME-independent calculation adapter in `src/prayer/`.
- [x] Pin Adhan and include its MIT license notice.
- [x] Add prayer location and calculation keys to the GSettings schema.
- [x] Add Indonesian area search, result selection, saved-location state, and
  calculation controls to Preferences.
- [x] Validate geocoder responses and restrict accepted results to Indonesia.
- [x] Add an accessible, stable-height `PrayerPanel`.
- [x] Add Prayer as the third Expanded View tab.
- [x] Cache the daily schedule and recalculate on local date, system time-zone,
  location, or calculation-setting changes.
- [x] Refresh immediately after screen unlock and update the next-prayer marker
  from the existing Controller timer.

## Settings

- `prayer-location-configured`: explicit enable/setup state.
- `prayer-location-name`: selected OpenStreetMap display label.
- `prayer-latitude` and `prayer-longitude`: coordinates saved from the selected
  search result.
- `prayer-calculation-method`: regional authority preset.
- `prayer-madhab`: standard/Shafi-family or Hanafi Asr calculation.
- `prayer-high-latitude-rule`: middle of night, seventh of night, or twilight
  angle.

## Verification

- [x] Golden schedule fixture for fixed coordinates and date.
- [x] Chronological ordering and next-prayer rollover.
- [x] Calculation-method and madhab differences.
- [x] Invalid/unconfigured location handling.
- [x] Indonesia-only search URL and geocoder-response validation.
- [x] High-latitude polar resolution.
- [x] Explicit time-zone formatting across daylight-saving time.
- [x] Typecheck, unit tests, production build, and schema compilation.
- [x] Nested GNOME Shell 50 enable/disable smoke test without extension errors.

## Completion Criteria

- Prayer times are calculated fully offline.
- Unconfigured users see guidance instead of a misleading `0,0` schedule.
- Preference changes and date/time-zone changes update the panel.
- The Prayer tab follows existing mouse, keyboard, and accessibility behavior.
- Existing System and Calendar tabs, sampling, and extension cleanup continue
  to work.
