# Keyboard Accessibility Plan

## Goal

Make every Island feature usable without a pointer and expose useful names and
state to GNOME Shell's accessibility stack. Keyboard users must be able to open
the Island, move between tabs and calendar controls, understand current Metric
values, and close the Island without relying on hover.

## Current Gaps

- The Pill and outer Island cannot receive keyboard focus, so keyboard users
  cannot open the Expanded View.
- Expansion is controlled only by pointer hover. Moving focus into the Island
  would not keep it open, and there is no focus-restoration path when it closes.
- Tab buttons are focusable and named, but they do not implement tab semantics,
  arrow-key navigation, Home/End navigation, or an exposed selected state.
- Calendar navigation buttons are focusable but are named only `‹` and `›`.
- Metric names, current values, graphs, calendar headings, and tab panels do not
  provide a deliberate accessibility representation.
- There is no common Escape handler for closing the Expanded View.

## Interaction Model

- Treat the Pill as the Island's keyboard trigger. `Enter`, `Space`, or
  `ArrowDown` opens the Expanded View and moves focus to the selected tab.
- Track whether the Expanded View was opened by hover or by keyboard. A
  keyboard-opened Island remains open while the pointer is elsewhere.
- `Tab` and `Shift+Tab` follow the normal focus order through the selected tab's
  controls. Hidden tab panels and their controls must not enter the focus order.
- Within the tab list:
  - `Left`/`Right` select and focus the previous/next tab, wrapping at the ends.
  - `Home`/`End` select and focus the first/last tab.
  - `Enter`/`Space` activate the focused tab.
- `Escape` from anywhere inside the Expanded View closes it and restores focus
  to the Pill.
- If focus leaves the Island through normal `Tab` navigation, close a
  keyboard-opened Island without stealing focus back. Pointer hover may keep a
  hover-opened Island visible.
- Pointer behavior remains unchanged: delayed hover opens the Island and
  leaving it collapses an Island that is not being held open by keyboard focus.

## Implementation

### 1. Separate expansion state from hover

- In `src/ui/island.ts`, replace the hover-only decision with explicit open
  reasons, such as pointer hover and keyboard interaction.
- Keep `_expand()` and `_collapse()` as the single animation paths, but make
  them idempotent so overlapping pointer and keyboard events cannot start
  conflicting transitions.
- Cancel pending hover timers when keyboard activation opens or Escape closes
  the Island.
- Listen for key-focus changes so focus moving among descendants keeps the
  Island open, while focus leaving can release the keyboard-open reason.
- Store whether closure should restore focus; only Escape and explicit keyboard
  closure should return focus to the Pill.
- Disconnect all new stage/focus/key signal handlers in `destroy()`.

### 2. Add a keyboard-operable Pill

- Make the Pill reactive and focusable, with button semantics and a visible
  `:focus` style in `static/stylesheet.css`.
- Give it a concise dynamic accessible name containing the date, time, and Pill
  Metric, and expose whether the Island is expanded when the available St/Atk
  API supports that state.
- Handle `Enter`, `Space`, and `ArrowDown` to open the Island and transfer focus
  to the selected tab.
- Ensure keyboard focus does not alter sizing or interfere with the existing
  width and expansion animations.

### 3. Implement tab-list keyboard behavior

- In `src/ui/tab-view.ts`, retain the ordered panel IDs in addition to the
  existing maps.
- Expose methods for focusing the selected tab and selecting/focusing a tab by
  relative or absolute position.
- Handle `Left`, `Right`, `Home`, `End`, `Enter`, and `Space`, consuming only
  keys owned by the tab list.
- Apply tab and tab-panel accessibility roles where GNOME Shell supports them.
  Keep each tab's existing accessible name, expose the active tab's selected
  state, and associate each panel with its tab if the API provides the needed
  relationship.
- Use roving focus: the selected tab is the tab stop, while arrow keys move the
  active tab. Hidden panels must remain hidden from both keyboard focus and the
  accessibility tree.
- Preserve the current selected tab across close/reopen cycles.

### 4. Name calendar controls and content

- In `src/ui/calendar.ts`, replace symbol-only accessibility names with
  `Previous month` and `Next month` while retaining the visible symbols.
- Update the month heading's accessible text whenever the shown month changes.
- Expose the current weekday/full date and calendar grid as readable content,
  but do not make non-interactive date cells keyboard stops.
- Give date cells unambiguous accessible labels including month, day, and year;
  identify today's date in its label or state.

### 5. Expose Metrics without duplicating noise

- In `src/ui/island.ts`, make each Metric row a named accessibility group and
  update its accessible description/name with the same formatted value shown
  on screen.
- Treat graph actors as visual supplements rather than separate focusable
  controls. Hide them from the accessibility tree if necessary so screen
  readers announce each Metric once.
- Keep live updates non-disruptive: do not move focus or announce every
  one-second sample automatically. Current values should be read when users
  navigate to or inspect the Metric group.

### 6. Add focus styling

- Add a clear keyboard focus treatment for the Pill, tabs, and calendar
  navigation buttons in `static/stylesheet.css`.
- Do not rely on color alone: use a border, outline-equivalent, or inset
  highlight that remains visible against the open and collapsed backgrounds.
- Verify that focus styling does not change actor dimensions and cause the
  Island to jump.

## Verification

### Automated checks

- Run `npm run typecheck`, `npm test`, and `npm run build`.
- If tab-index/key mapping is extracted into a GNOME-independent helper, add
  unit tests for wrapping, Home/End, unknown keys, and an empty/invalid target.

### Manual GNOME Shell checks

- From the top bar, focus the Pill without using the pointer; confirm its focus
  indicator and accessible name contain the current Pill information.
- Open with `Enter`, `Space`, and `ArrowDown`; confirm focus lands on the
  selected tab and the Island stays open with the pointer elsewhere.
- Navigate tabs with arrows and Home/End; confirm selection, visible panel,
  focus, and assistive-technology state remain synchronized.
- Use `Tab`/`Shift+Tab` to reach Calendar navigation, activate both month
  buttons, and confirm their spoken names and the updated month are clear.
- Press `Escape` from a tab and from each panel control; confirm the Island
  closes and focus returns to the Pill.
- Tab out normally; confirm focus continues to the next Shell control and the
  Island closes without pulling focus back.
- Mix pointer and keyboard input during opening/collapse animations; confirm
  there are no stuck-open states, duplicate animations, or lost focus.
- With Orca enabled, inspect the Pill, tabs, panels, calendar, and all Metrics;
  confirm names are meaningful, selected/expanded state is conveyed, graphs
  are not announced redundantly, and live Metric updates do not cause repeated
  unsolicited speech.
- Disable and re-enable the extension after using keyboard navigation; confirm
  no stale handlers, focus errors, or GNOME Shell log warnings remain.

## Completion Criteria

- Every interactive Island control is reachable, operable, and visibly focused
  using only the keyboard.
- The Island can be opened, navigated, and closed without pointer hover.
- Escape behavior and focus restoration are consistent from anywhere inside
  the Expanded View.
- Controls, panels, dates, and Metrics have meaningful accessible names and
  states, with no duplicate graph announcements.
- Existing hover behavior, animations, tab persistence, and Metric refresh
  behavior continue to work.
