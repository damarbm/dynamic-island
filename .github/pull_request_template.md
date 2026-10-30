# Summary

Adds keyboard access to the Island. The Pill is focusable and opens the Expanded View with Enter, Space or Down, and focus moves to the selected tab. Tabs support Left, Right, Home and End, and Escape closes the Island and returns focus to the Pill. The calendar buttons, tabs, Pill and Metric rows get accessible names and roles, and focused controls get a visible focus ring.

# Changes

- `src/ui/island.ts`: the Pill is focusable and handles Enter, Space, Down and Escape. A keyboard-opened Island stays open while focus is inside it and closes when focus leaves without pulling focus back. The Pill exposes its time and Metric as its accessible name and an expanded state. Each Metric row is a named section whose name includes its current value. Signal handlers are disconnected in `destroy()`, and the Island is registered with Ctrl+Alt+Tab.
- `src/ui/tab-view.ts`: tabs use tab-list and tab roles, with roving focus so only the selected tab is a tab stop. Left, Right, Home, End, Enter and Space are handled here. Panels get accessible names and roles.
- `src/ui/calendar.ts`: the previous and next buttons are named `Previous month` and `Next month`. The grid and day cells have readable names, and today is marked in the name.
- `static/stylesheet.css`: a 2px focus border on the Pill, the tabs and the calendar buttons. The border is transparent when not focused, so the layout doesn't shift.
- `docs/KEYBOARD_ACCESSIBILITY_PLAN.md`: new plan for this work, including the manual checks for GNOME Shell and Orca.
- `docs/ROADMAP.md`: keyboard accessibility is ticked off.

# Type of change

- [ ] Bug fix
- [x] New feature
- [ ] Refactor or cleanup
- [x] Styling only
- [x] Documentation
- [ ] Build or tooling

# How to test

1. `npm install`, then `make dev` (nested shell) or `make deploy` and toggle the extension in your session.
2. Focus the Pill without using the pointer, for example with Tab from the top bar. Confirm it shows a white focus ring.
3. Press Enter, Space or Down. The Island should open with focus on the System tab, and stay open with the pointer elsewhere.
4. Use Left, Right, Home and End to move between tabs. Confirm the panel changes and focus follows.
5. Tab to the calendar's `‹` and `›` buttons and activate them. Confirm the month changes.
6. Press Escape from a tab and from a calendar button. The Island should close and focus should return to the Pill.
7. Tab out of the Island. It should close without pulling focus back.
8. Hover over the Pill for about 300 ms. Hover-to-open and hover-to-close should still work as before.

Tested so far: `npm run typecheck`, `npm test` (8 tests) and `npm run build` pass. Not yet tested in a running GNOME Shell 50 session, and not tested with Orca.

# Checklist

- [x] `npm run typecheck` passes
- [x] `npm test` passes
- [x] `npm run build` succeeds
- [ ] Tested on GNOME Shell 50
- [ ] Screenshots or a screen recording attached for UI changes
- [ ] README or docs updated if behavior or settings changed
- [ ] GSettings schema changes come with a default that suits existing users

Note for reviewers: `README.md` does not yet describe the keyboard controls. The plan doc and roadmap are updated.
