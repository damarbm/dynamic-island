# Tabbed Expanded View Plan

## Goal

Replace the permanent two-column Expanded View with a scalable tab system. Calendar and System Metrics will become the first panels, with Notifications and Prayer Times planned as additional panels.

## Current Implementation

- [x] Add reusable tab navigation with System and Calendar panels.
- [x] Keep both panels mounted so their state survives tab switches.
- [x] Keep the content area dimensions stable between the current panels.
- [x] Retain the selected tab while the extension remains enabled.

## Panels

- **Calendar**: month navigation and the current date.
- **System Metrics**: CPU, RAM, and network values and graphs.
- **Notifications**: notification history and an unread-count badge.
- **Prayer Times**: daily prayer schedule based on the user's location and calculation method.

## Architecture

- [ ] Define a common panel interface with metadata, actor, activation, deactivation, and cleanup hooks.
- [ ] Keep panel logic separate from `island.ts`.
- [ ] Lazy-load expensive panels.
- [ ] Pause panel timers and background work while a panel is inactive.
- [ ] Research GNOME Shell notification integration and compatibility across Shell versions.
- [ ] Define a local or network data strategy for Prayer Times.

## Interaction and Layout

- [ ] Use compact icon tabs with tooltips and optional labels when space permits.
- [ ] Keep the Island dimensions stable when switching tabs.
- [ ] Remember the last selected tab and provide a configurable default tab.
- [ ] Support mouse and keyboard navigation, including arrow keys, Enter, and Escape.
- [ ] Support useful tab badges, such as an unread notification count.
- [ ] Add an overflow menu if the Island grows beyond four or five primary tabs.
- [ ] Make panel content responsive to narrow screens and large text scaling.

## Settings

- [ ] Add a default-tab preference.
- [ ] Allow users to enable, disable, and reorder optional tabs.
- [ ] Add location and calculation-method settings for Prayer Times.
