## Summary

Adds a calendar to the Expanded View and shows the date in the Pill. The default Pill Metric changes from CPU to network speed. Adds `make watch` for rebuilding and restarting a nested GNOME Shell on save.

## Changes

- `src/calendar.ts`: new month calendar with the full date, a month header with previous/next buttons, a Sunday-first grid, and today highlighted.
- `src/island.ts`: the Expanded View is now two columns, the calendar on the left and the CPU, RAM and network graphs on the right. The calendar resets to the current month each time the Island expands.
- `src/format.ts`: new `formatDate` helper.
- `src/controller.ts`: the Pill shows `Tue, Oct 27 · 10:17` before the Pill Metric.
- `static/schemas/...gschema.xml`: default `pill-metric` changed from `cpu` to `network`.
- `static/stylesheet.css`: styles for the calendar, the day circles, and the metrics column.
- `scripts/watch.mjs` and `make watch` / `npm run watch`: rebuild and restart the nested shell when `src/` or `static/` changes. Only the nested shell started by the script is killed.
- `README.md`, `Makefile`, `package.json`: document and wire up the new commands and defaults.
- `.github/pull_request_template.md`: this template.

## Type of change

- [ ] Bug fix
- [x] New feature
- [ ] Refactor or cleanup
- [x] Styling only
- [ ] Documentation
- [x] Build or tooling

## How to test

1. `npm install`, then `make dev` (nested shell) or `make deploy` and toggle the extension in your session.
2. Hover over the Pill for about 300 ms and check the calendar and graphs appear side by side.
3. Use `‹` and `›` to change month. Confirm today is highlighted and the day circles are centered.
4. Confirm the Pill shows the date, time and network speed.
5. Run `make watch`, edit `static/stylesheet.css` and confirm the nested shell restarts.

Tested so far: `npm run typecheck` passes. Not yet tested in a running GNOME Shell 50 session.

## Checklist

- [x] `npm run typecheck` passes
- [ ] `npm test` passes (not changed, `src/proc.ts` is untouched)
- [ ] `npm run build` succeeds
- [ ] Tested on GNOME Shell 50
- [ ] Screenshots or a screen recording attached for UI changes
- [x] README or docs updated if behavior or settings changed
- [x] GSettings schema changes come with a default that suits existing users

Note for reviewers: users who already have `pill-metric` set to `cpu` in dconf keep CPU. The new default applies only when the key was never set.
