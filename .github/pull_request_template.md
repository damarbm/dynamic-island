# Summary

Replaces the permanent two-column Expanded View with a tab bar. The Expanded View now has a System tab (CPU, RAM and network graphs) and a Calendar tab. The source tree is reorganized into `core/`, `metrics/`, `ui/` and `util/` folders, and `docs/TAB_VIEW_PLAN.md` tracks the remaining tab work.

# Changes

- `src/ui/tab-view.ts`: new reusable `TabView` with icon tabs and a single-panel content area. Panels stay mounted so their state survives tab switches.
- `src/ui/island.ts`: the Expanded View shows the `TabView` with System and Calendar panels instead of two columns. System is the default tab. The calendar still resets to the current month each time the Island expands.
- `static/stylesheet.css`: styles for the tab bar, active and hover states, and a fixed content size so the Island doesn't change dimensions between tabs. The metrics column no longer has a fixed minimum width.
- `src/core/controller.ts`: moved from `src/controller.ts`. Imports updated.
- `src/metrics/` (`sampler.ts`, `proc.ts`, `history.ts`), `src/ui/` (`calendar.ts`, `graph.ts`) and `src/util/format.ts`: moved into folders. No logic changes.
- `test/proc.test.ts`: imports updated for the new paths.
- `README.md`: describes the tabbed Expanded View, the new project layout and the file paths in "How it works". The scripts table is re-aligned.
- `docs/TAB_VIEW_PLAN.md`: new plan for the tabbed Expanded View, with the current implementation checked off and planned panels, architecture and settings listed.
- `docs/ROADMAP.md`: new roadmap. Tabbed Expanded View is marked done.
- `docs/OVERVIEW.md`: renamed from `docs/CONTEXT.md`, with one line changed.
- `docs/GNOME_SHELL_GUIDE.md`: renamed from `docs/GNOME-SHELL-GUIDE.md`, with content updates.

# Type of change

- [ ] Bug fix
- [x] New feature
- [x] Refactor or cleanup
- [ ] Styling only
- [x] Documentation
- [ ] Build or tooling

# How to test

1. `npm install`, then `make dev` (nested shell) or `make deploy` and toggle the extension in your session.
2. Hover over the Pill for about 300 ms. The Expanded View should open on the System tab with the CPU, RAM and network graphs.
3. Click the Calendar tab. Confirm the calendar shows, `‹` and `›` change month, and today is highlighted.
4. Switch back to System and confirm the graphs keep their history. The Island should not change size between tabs.
5. Move the pointer away, then hover again. The Island should reopen on the tab you last selected.

Tested so far: `npm run typecheck`, `npm test` (8 tests) and `npm run build` pass. Not yet tested in a running GNOME Shell 50 session.

# Checklist

- [x] `npm run typecheck` passes
- [x] `npm test` passes
- [x] `npm run build` succeeds
- [ ] Tested on GNOME Shell 50
- [ ] Screenshots or a screen recording attached for UI changes
- [x] README or docs updated if behavior or settings changed
- [ ] GSettings schema changes come with a default that suits existing users
